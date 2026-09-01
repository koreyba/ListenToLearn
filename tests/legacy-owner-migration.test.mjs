import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const LEGACY_EMAIL = "koreybadenis@gmail.com";
const LEGACY_ID = `legacy:${LEGACY_EMAIL}`;
const CURRENT_USER = {
  subject: "access-user",
  email: LEGACY_EMAIL,
  name: "Legacy owner",
};

class CountingSQLiteD1Statement {
  constructor(database, sql, bindings = [], counter) {
    this.database = database;
    this.sql = sql;
    this.bindings = bindings;
    this.counter = counter;
  }

  bind(...bindings) {
    return new CountingSQLiteD1Statement(
      this.database,
      this.sql,
      bindings,
      this.counter,
    );
  }

  execute() {
    this.counter.count += 1;
    const statement = this.database.prepare(this.sql);
    if (statement.columns().length > 0) {
      return { results: statement.all(...this.bindings), success: true, meta: {} };
    }
    const result = statement.run(...this.bindings);
    return {
      results: [],
      success: true,
      meta: { changes: Number(result.changes) },
    };
  }

  async first() {
    this.counter.count += 1;
    return this.database.prepare(this.sql).get(...this.bindings) || null;
  }

  async run() {
    return this.execute();
  }
}

class CountingSQLiteD1Database {
  constructor(database) {
    this.database = database;
    this.counter = { count: 0 };
    this.failAtBatchIndex = null;
  }

  get statementCount() {
    return this.counter.count;
  }

  prepare(sql) {
    return new CountingSQLiteD1Statement(this.database, sql, [], this.counter);
  }

  async batch(statements) {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const results = statements.map((statement, index) => {
        if (index === this.failAtBatchIndex) {
          throw new Error("Simulated legacy migration batch failure.");
        }
        return statement.execute();
      });
      this.database.exec("COMMIT");
      return results;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
}

function createFixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  for (const migration of readdirSync(join(root, "drizzle"))
    .filter((name) => /^\d{4}_.+\.sql$/u.test(name))
    .sort()) {
    sqlite.exec(readFileSync(join(root, "drizzle", migration), "utf8"));
  }
  sqlite.exec(`
    UPDATE users
    SET email = '${LEGACY_EMAIL}', display_name = 'Legacy owner',
      created_at = '2026-08-23T10:00:00.000Z',
      updated_at = '2026-08-23T10:00:00.000Z'
    WHERE id = '${LEGACY_ID}';

    INSERT INTO phrases (
      id, text, pattern, translation, context, source_type, owner_id, status,
      created_at, updated_at
    ) VALUES (
      'legacy-phrase', 'break even', 'break even', 'окупаться', '', 'custom',
      '${LEGACY_ID}', 'pick', '2026-08-23T10:00:00.000Z',
      '2026-08-23T10:00:00.000Z'
    );

    INSERT INTO phrase_progress (user_id, phrase_id, status, created_at, updated_at)
    VALUES ('${LEGACY_ID}', 'legacy-phrase', 'learning_now',
      '2026-08-23T10:00:00.000Z', '2026-08-23T10:00:00.000Z');

    INSERT INTO phrase_examples (
      id, user_id, phrase_id, provider, external_id, query, caption, accent,
      metadata, created_at
    ) VALUES (
      'legacy-example', '${LEGACY_ID}', 'legacy-phrase', 'youglish', 'video-1',
      'break even', 'We broke even.', 'us', '{}', '2026-08-23T10:00:00.000Z'
    );

    INSERT INTO saved_videos (
      id, user_id, youtube_video_id, origin_phrase_id, origin_query, restore_query,
      restore_anchor_seconds, origin_caption, language, accent, created_at, updated_at
    ) VALUES (
      'legacy-video', '${LEGACY_ID}', 'abcdefghijk', 'legacy-phrase', 'break even',
      'break even', 4.5, 'We broke even.', 'english', 'us',
      '2026-08-23T10:00:00.000Z', '2026-08-23T10:00:00.000Z'
    );

    INSERT INTO integration_secrets (
      id, user_id, provider, ciphertext, iv, encryption_version, created_at, updated_at
    ) VALUES (
      'legacy-secret', '${LEGACY_ID}', 'deepl', 'ciphertext', 'iv', 2,
      '2026-08-23T10:00:00.000Z', '2026-08-23T10:00:00.000Z'
    );
  `);
  const database = new CountingSQLiteD1Database(sqlite);
  globalThis.__legacyOwnerMigrationDatabase = database;
  return { database, sqlite };
}

async function compileAuth() {
  const result = await build({
    absWorkingDir: root,
    bundle: true,
    entryPoints: ["lib/auth.ts"],
    format: "esm",
    platform: "node",
    target: "node24",
    write: false,
    plugins: [{
      name: "legacy-owner-migration-test-boundary",
      setup(esbuild) {
        esbuild.onResolve({ filter: /^@\/db$/ }, (args) => ({
          path: args.path,
          namespace: "legacy-owner-migration-test",
        }));
        esbuild.onLoad({ filter: /.*/, namespace: "legacy-owner-migration-test" }, () => ({
          contents: `
            export function getD1() {
              return globalThis.__legacyOwnerMigrationDatabase;
            }
          `,
          loader: "ts",
        }));
      },
    }],
  });
  const source = result.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

const auth = await compileAuth();

test("ordinary ensureUser stays a single-statement upsert and leaves legacy data untouched", async () => {
  const { database, sqlite } = createFixture();

  await auth.ensureUser(CURRENT_USER);

  assert.equal(database.statementCount, 1);
  assert.equal(
    sqlite.prepare("SELECT owner_id FROM phrases WHERE id = 'legacy-phrase'").get().owner_id,
    LEGACY_ID,
  );
  assert.ok(sqlite.prepare("SELECT id FROM users WHERE id = ?").get(LEGACY_ID));
});

test("the explicit legacy-owner migration moves all legacy data once and is idempotent", async () => {
  const { database, sqlite } = createFixture();
  await auth.ensureUser(CURRENT_USER);

  assert.equal(await auth.migrateLegacyOwnerData(CURRENT_USER), true);
  assert.equal(database.statementCount, 12);
  assert.equal(sqlite.prepare("SELECT owner_id FROM phrases WHERE id = 'legacy-phrase'").get().owner_id, CURRENT_USER.subject);
  assert.equal(sqlite.prepare("SELECT user_id FROM phrase_progress WHERE phrase_id = 'legacy-phrase'").get().user_id, CURRENT_USER.subject);
  assert.equal(sqlite.prepare("SELECT user_id FROM phrase_examples WHERE id = 'migrated-legacy-example'").get().user_id, CURRENT_USER.subject);
  assert.equal(sqlite.prepare("SELECT user_id FROM saved_videos WHERE id = 'migrated-legacy-video'").get().user_id, CURRENT_USER.subject);
  assert.equal(sqlite.prepare("SELECT user_id FROM integration_secrets WHERE id = 'migrated-legacy-secret'").get().user_id, CURRENT_USER.subject);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM users WHERE id = ?").get(LEGACY_ID).count, 0);

  assert.equal(await auth.migrateLegacyOwnerData(CURRENT_USER), false);
  assert.equal(database.statementCount, 13);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM phrase_examples").get().count, 1);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM saved_videos").get().count, 1);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM integration_secrets").get().count, 1);
});

test("a failed explicit migration rolls back without deleting legacy data", async () => {
  const { database, sqlite } = createFixture();
  await auth.ensureUser(CURRENT_USER);
  database.failAtBatchIndex = 5;

  await assert.rejects(
    auth.migrateLegacyOwnerData(CURRENT_USER),
    /Simulated legacy migration batch failure/u,
  );

  assert.ok(sqlite.prepare("SELECT id FROM users WHERE id = ?").get(LEGACY_ID));
  assert.equal(sqlite.prepare("SELECT owner_id FROM phrases WHERE id = 'legacy-phrase'").get().owner_id, LEGACY_ID);
  assert.equal(sqlite.prepare("SELECT user_id FROM phrase_progress WHERE phrase_id = 'legacy-phrase'").get().user_id, LEGACY_ID);
  assert.equal(sqlite.prepare("SELECT user_id FROM phrase_examples WHERE id = 'legacy-example'").get().user_id, LEGACY_ID);
  assert.equal(sqlite.prepare("SELECT user_id FROM saved_videos WHERE id = 'legacy-video'").get().user_id, LEGACY_ID);
  assert.equal(sqlite.prepare("SELECT user_id FROM integration_secrets WHERE id = 'legacy-secret'").get().user_id, LEGACY_ID);
});

test("session lifecycle invokes migration before exposing a session, while AI routes do not", () => {
  const worker = readFileSync(join(root, "worker/index.ts"), "utf8");
  const messagesRoute = readFileSync(
    join(root, "app/api/ai/chats/[chatId]/messages/route.ts"),
    "utf8",
  );

  assert.match(worker, /import \{ ensureUser, migrateLegacyOwnerData \} from "@\/lib\/auth"/u);
  assert.match(
    worker,
    /await ensureUser\(identity\);[\s\S]*?await migrateLegacyOwnerData\(identity\);[\s\S]*?await issueAppSession/u,
  );
  assert.match(
    worker,
    /pathname === "\/api\/session"[\s\S]*?resolveAppSession\(request, sessionStore\)[\s\S]*?migrateLegacyOwnerData\(identity\)[\s\S]*?optionalSessionResponse/u,
  );
  assert.doesNotMatch(messagesRoute, /migrateLegacyOwnerData/u);
});
