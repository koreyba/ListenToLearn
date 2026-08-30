import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const PRACTICE_DEMO_ID_PREFIX = "demo-virtual-";
export const PRACTICE_DEMO_GUEST_STATE_FILE = ".wrangler/practice-demo-guest-state.json";

function normalizeCount(count) {
  if (!Number.isInteger(count) || count < 1 || count > 1000) {
    throw new RangeError("Demo phrase count must be an integer from 1 to 1000.");
  }
  return count;
}

function sqlText(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function createPracticeDemoData(count = 200) {
  const safeCount = normalizeCount(count);
  const cards = Array.from({ length: safeCount }, (_, index) => {
    const position = index + 1;
    const padded = String(position).padStart(4, "0");
    const text = position === safeCount
      ? `Needle at the end ${position}`
      : position % 7 === 0
      ? `Demo phrase ${position} with a deliberately longer connected speech example`
      : `Demo phrase ${position}`;
    return {
      id: `${PRACTICE_DEMO_ID_PREFIX}${padded}`,
      text,
      pattern: position % 7 === 0
        ? `[demo phrase ${position}] [with a longer rhythm group]`
        : `[demo phrase ${position}]`,
      ipa: `demo-${position}`,
      kind: "stack",
      rank: 10_000 + position,
      mechanism: "reduction",
      catalogOrder: 10_000 + position,
    };
  });

  return {
    cards,
    guestState: {
      version: 2,
      statuses: Object.fromEntries(cards.map((card) => [card.id, "learning_now"])),
      customPhrases: [],
      savedExamples: [],
      savedVideos: [],
    },
  };
}

export function createPracticeDemoSeedSql(count = 200) {
  const { cards } = createPracticeDemoData(count);
  const phraseValues = cards.map((card) => (
    `(${sqlText(card.id)}, ${sqlText(card.text)}, ${sqlText(card.pattern)}, ${sqlText(card.ipa)}, '', '', 'preset', ${card.catalogOrder}, NULL, 'pick', datetime('now'), datetime('now'))`
  )).join(",\n");
  const analysisValues = cards.map((card) => (
    `(${sqlText(card.id)}, ${sqlText(card.kind)}, ${card.rank}, ${sqlText(card.pattern)}, ${sqlText(card.ipa)}, ${sqlText(card.text)}, NULL, 1)`
  )).join(",\n");
  const mechanismValues = cards.map((card) => (
    `(${sqlText(card.id)}, ${sqlText(card.mechanism)}, 0)`
  )).join(",\n");
  const statements = [
    "PRAGMA foreign_keys = ON;",
    `INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ${phraseValues}
ON CONFLICT(id) DO UPDATE SET text = excluded.text, pattern = excluded.pattern, ipa = excluded.ipa, source_type = 'preset', catalog_order = excluded.catalog_order;`,
    `INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ${analysisValues}
ON CONFLICT(phrase_id) DO UPDATE SET kind = excluded.kind, rank = excluded.rank, pattern = excluded.pattern, ipa = excluded.ipa, search_query = excluded.search_query, alternate_query = NULL, active = 1;`,
    `INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ${mechanismValues}
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;`,
  ];

  return `${statements.join("\n")}\n`;
}

export function createPracticeDemoResetSql() {
  const fixturePattern = `${PRACTICE_DEMO_ID_PREFIX}%`;
  return [
    "PRAGMA foreign_keys = ON;",
    `DELETE FROM phrase_progress WHERE phrase_id LIKE ${sqlText(fixturePattern)};`,
    `DELETE FROM phrase_mechanisms WHERE phrase_id LIKE ${sqlText(fixturePattern)};`,
    `DELETE FROM catalog_phrase_analysis WHERE phrase_id LIKE ${sqlText(fixturePattern)};`,
    `DELETE FROM phrases WHERE id LIKE ${sqlText(fixturePattern)};`,
    "",
  ].join("\n");
}

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const wranglerBin = join(projectRoot, "node_modules", "wrangler", "bin", "wrangler.js");
const localD1 = ["d1", "execute", "DB", "--local", "--config", "wrangler.jsonc"];

function runWrangler(args) {
  const result = spawnSync(process.execPath, [wranglerBin, ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (result.stdout) process.stderr.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error(`Wrangler exited with status ${result.status}.`);
  }
}

function parseCount(rawCount) {
  return normalizeCount(rawCount === undefined ? 200 : Number(rawCount));
}

export async function runPracticeDemoCli([action = "seed", rawCount] = []) {
  if (!new Set(["seed", "reset"]).has(action)) {
    throw new Error("Usage: practice-demo-data.mjs <seed [count]|reset>");
  }

  runWrangler(["d1", "migrations", "apply", "DB", "--local", "--config", "wrangler.jsonc"]);
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "unmumble-practice-demo-"));
  const sqlFile = join(temporaryDirectory, `${action}.sql`);
  const guestStatePath = resolve(projectRoot, PRACTICE_DEMO_GUEST_STATE_FILE);

  try {
    if (action === "reset") {
      await writeFile(sqlFile, createPracticeDemoResetSql(), "utf8");
      runWrangler([...localD1, "--file", sqlFile]);
      await rm(guestStatePath, { force: true });
      process.stdout.write("Removed local Practice demo rows. Clear guest data in the browser to remove imported demo progress.\n");
      return;
    }

    const count = parseCount(rawCount);
    const demo = createPracticeDemoData(count);
    await writeFile(sqlFile, createPracticeDemoSeedSql(count), "utf8");
    runWrangler([...localD1, "--file", sqlFile]);
    await mkdir(dirname(guestStatePath), { recursive: true });
    await writeFile(guestStatePath, `${JSON.stringify(demo.guestState, null, 2)}\n`, "utf8");
    process.stdout.write(`Seeded ${count} local demo catalog phrases.\n`);
    process.stdout.write(`Reusable Practice guest state: ${guestStatePath}\n`);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  runPracticeDemoCli(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
