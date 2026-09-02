import { readdirSync, readFileSync, statSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createVocabularyRepository } from "../lib/vocabulary/repository.ts";
import { createAiChatRepository } from "../lib/ai-chat/repository.ts";
import { createChatWithVocabularyOpening } from "../lib/ai-chat/chat-creation.ts";
import { mapCatalogRows, mapPhraseRows } from "../lib/catalog/catalog-api.ts";
import { CONNECTED_SPEECH_MECHANISMS, PRACTICE_FORMATS } from "../lib/catalog/connected-speech-catalog.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

class BenchmarkD1Statement {
  constructor(database, sql, bindings, metrics) {
    this.database = database;
    this.sql = sql;
    this.bindings = bindings || [];
    this.metrics = metrics;
  }

  bind(...bindings) {
    return new BenchmarkD1Statement(this.database, this.sql, bindings, this.metrics);
  }

  _record(start, rowsReturned = 0) {
    const elapsedMs = performance.now() - start;
    this.metrics.statementCount += 1;
    this.metrics.totalQueryTimeMs += elapsedMs;
    this.metrics.statements.push({
      sql: this.sql.replace(/\s+/g, " ").trim().slice(0, 100),
      timeMs: elapsedMs,
      rows: rowsReturned,
    });
  }

  async first() {
    const start = performance.now();
    const row = this.database.prepare(this.sql).get(...this.bindings) || null;
    this._record(start, row ? 1 : 0);
    return row;
  }

  async all() {
    const start = performance.now();
    const rows = this.database.prepare(this.sql).all(...this.bindings);
    this._record(start, rows.length);
    return { results: rows, success: true, meta: {} };
  }

  async run() {
    const start = performance.now();
    const result = this.database.prepare(this.sql).run(...this.bindings);
    this._record(start, 0);
    return { results: [], success: true, meta: { changes: Number(result.changes) } };
  }
}

class BenchmarkD1Database {
  constructor(database) {
    this.database = database;
    this.metrics = {
      statementCount: 0,
      totalQueryTimeMs: 0,
      statements: [],
    };
  }

  reset() {
    this.metrics = {
      statementCount: 0,
      totalQueryTimeMs: 0,
      statements: [],
    };
  }

  prepare(sql) {
    return new BenchmarkD1Statement(this.database, sql, [], this.metrics);
  }

  async batch(statements) {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const results = statements.map((s) => {
        const start = performance.now();
        const stmt = this.database.prepare(s.sql);
        let res;
        if (stmt.columns().length > 0) {
          const rows = stmt.all(...s.bindings);
          s._record(start, rows.length);
          res = { results: rows, success: true, meta: {} };
        } else {
          const r = stmt.run(...s.bindings);
          s._record(start, 0);
          res = { results: [], success: true, meta: { changes: Number(r.changes) } };
        }
        return res;
      });
      this.database.exec("COMMIT");
      return results;
    } catch (err) {
      this.database.exec("ROLLBACK");
      throw err;
    }
  }
}

function initDb() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  for (const file of readdirSync(join(root, "drizzle")).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort()) {
    sqlite.exec(readFileSync(join(root, "drizzle", file), "utf8"));
  }
  return sqlite;
}

function seedData(sqlite) {
  sqlite.exec(`
    INSERT INTO users (id, email, display_name, created_at, updated_at)
    VALUES ('user-bench', 'bench@example.com', 'Benchmark User', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z');
  `);

  const insertPhrase = sqlite.prepare(`
    INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, '', 'preset', ?, 'pick', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z')
  `);
  const insertAnalysis = sqlite.prepare(`
    INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
    VALUES (?, 'atom', ?, ?, ?, ?, NULL, 1)
  `);
  const insertMechanism = sqlite.prepare(`
    INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
    VALUES (?, ?, ?)
  `);

  const mechs = ["linking", "reduction", "elision", "coalescence"];
  for (let i = 1; i <= 50; i++) {
    const id = `phrase-${i}`;
    insertPhrase.run(id, `phrase text number ${i}`, `[pattern] ${i}`, `/ipa/ ${i}`, `translation ${i}`, i);
    insertAnalysis.run(id, i, `[pattern] ${i}`, `/ipa/ ${i}`, `query ${i}`);
    for (let m = 0; m < (i % 3) + 1; m++) {
      insertMechanism.run(id, mechs[m], m);
    }
  }

  const insertProgress = sqlite.prepare(`
    INSERT INTO phrase_progress (user_id, phrase_id, status, created_at, updated_at)
    VALUES ('user-bench', ?, ?, ?, ?)
  `);
  const insertMeaning = sqlite.prepare(`
    INSERT INTO phrase_meanings (id, user_id, phrase_id, translation, normalized_translation, context, created_at, updated_at)
    VALUES (?, 'user-bench', ?, ?, ?, '', ?, ?)
  `);

  const statuses = ["to_learn", "learning_now", "learnt"];
  for (let i = 1; i <= 30; i++) {
    const phraseId = `phrase-${i}`;
    const status = statuses[i % 3];
    const ts = new Date(Date.parse("2026-09-01T10:00:00.000Z") + i * 60000).toISOString();
    insertProgress.run(phraseId, status, ts, ts);
    insertMeaning.run(`meaning-${i}-1`, phraseId, `personal translation 1 for ${i}`, `personal translation 1 for ${i}`, ts, ts);
    insertMeaning.run(`meaning-${i}-2`, phraseId, `personal translation 2 for ${i}`, `personal translation 2 for ${i}`, ts, ts);
  }

  const insertVideo = sqlite.prepare(`
    INSERT INTO saved_videos (id, user_id, youtube_video_id, origin_query, restore_query, restore_anchor_seconds, created_at, updated_at)
    VALUES (?, 'user-bench', ?, 'query', 'restore', 15.5, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z')
  `);
  for (let i = 1; i <= 20; i++) {
    insertVideo.run(`video-${i}`, `yt-id-${i}`);
  }
}

export async function runBenchmarks() {
  const sqlite = initDb();
  seedData(sqlite);
  const db = new BenchmarkD1Database(sqlite);

  const results = {};

  // BENCHMARK 1: Flow A - GET /api/phrases (optimized with json_group_array)
  {
    db.reset();
    const start = performance.now();
    const phraseProjection = `
      SELECT
        p.id, p.text, p.pattern, p.ipa,
        COALESCE(NULLIF(p.translation, ''), fallback_meaning.translation, '') AS translation,
        CASE
          WHEN p.translation <> '' THEN p.context
          ELSE COALESCE(fallback_meaning.context, p.context)
        END AS context,
        p.source_type, p.catalog_order,
        COALESCE(progress.status, 'pick') AS status,
        p.created_at, p.updated_at,
        analysis.kind AS analysis_kind,
        analysis.rank AS analysis_rank,
        analysis.pattern AS analysis_pattern,
        analysis.ipa AS analysis_ipa,
        analysis.search_query AS analysis_search_query,
        analysis.alternate_query AS analysis_alternate_query,
        CASE WHEN count(mechanisms.mechanism) > 0
          THEN json_group_array(json_array(mechanisms.mechanism, mechanisms.display_order))
          ELSE '[]'
        END AS mechanisms_json
      FROM phrases AS p
      LEFT JOIN phrase_progress AS progress
        ON progress.phrase_id = p.id AND progress.user_id = ?
      LEFT JOIN phrase_meanings AS fallback_meaning
        ON fallback_meaning.id = (
          SELECT candidate.id
          FROM phrase_meanings AS candidate
          WHERE candidate.user_id = ? AND candidate.phrase_id = p.id
          ORDER BY candidate.created_at, candidate.id
          LIMIT 1
        )
      LEFT JOIN catalog_phrase_analysis AS analysis
        ON analysis.phrase_id = p.id AND analysis.active = 1
      LEFT JOIN phrase_mechanisms AS mechanisms
        ON mechanisms.phrase_id = p.id
      WHERE p.source_type = 'preset' OR p.owner_id = ?
      GROUP BY p.id
      ORDER BY
        CASE WHEN COALESCE(progress.status, 'pick') = 'pick' THEN 0 ELSE 1 END,
        CASE WHEN COALESCE(progress.status, 'pick') = 'pick' THEN p.catalog_order END ASC,
        p.updated_at DESC
    `;

    const queryResult = await db.prepare(phraseProjection).bind("user-bench", "user-bench", "user-bench").all();
    const mapped = mapPhraseRows(queryResult.results);
    const payload = JSON.stringify({ phrases: mapped });
    const elapsed = performance.now() - start;

    results.flowPhrases = {
      name: "Flow A: GET /api/phrases",
      statements: db.metrics.statementCount,
      d1QueryTimeMs: Number(db.metrics.totalQueryTimeMs.toFixed(3)),
      totalTimeMs: Number(elapsed.toFixed(3)),
      d1RowsTransferred: queryResult.results.length,
      phrasesCount: mapped.length,
      jsonPayloadBytes: Buffer.byteLength(payload, "utf8"),
    };
  }

  // BENCHMARK 2: Flow B - GET /api/catalog (optimized with json_group_array)
  {
    db.reset();
    const start = performance.now();
    const queryResult = await db.prepare(`
      SELECT
        phrases.id,
        phrases.text,
        analysis.kind AS analysis_kind,
        analysis.rank AS analysis_rank,
        analysis.pattern AS analysis_pattern,
        analysis.ipa AS analysis_ipa,
        analysis.search_query AS analysis_search_query,
        analysis.alternate_query AS analysis_alternate_query,
        CASE WHEN count(mechanisms.mechanism) > 0
          THEN json_group_array(json_array(mechanisms.mechanism, mechanisms.display_order))
          ELSE '[]'
        END AS mechanisms_json
      FROM catalog_phrase_analysis AS analysis
      INNER JOIN phrases ON phrases.id = analysis.phrase_id
      LEFT JOIN phrase_mechanisms AS mechanisms ON mechanisms.phrase_id = phrases.id
      WHERE analysis.active = 1
      GROUP BY phrases.id
      ORDER BY
        CASE analysis.kind WHEN 'atom' THEN 1 WHEN 'lexicon' THEN 2 ELSE 3 END,
        analysis.rank
    `).all();

    const cards = mapCatalogRows(queryResult.results);
    const payload = JSON.stringify({
      cards,
      formats: PRACTICE_FORMATS,
      mechanisms: CONNECTED_SPEECH_MECHANISMS,
    });
    const elapsed = performance.now() - start;

    results.flowCatalog = {
      name: "Flow B: GET /api/catalog",
      statements: db.metrics.statementCount,
      d1QueryTimeMs: Number(db.metrics.totalQueryTimeMs.toFixed(3)),
      totalTimeMs: Number(elapsed.toFixed(3)),
      d1RowsTransferred: queryResult.results.length,
      cardsCount: cards.length,
      jsonPayloadBytes: Buffer.byteLength(payload, "utf8"),
    };
  }

  // BENCHMARK 3: Flow C - Vocabulary listPage and search
  {
    db.reset();
    const start = performance.now();
    const repo = createVocabularyRepository(db);
    const page = await repo.listPage("user-bench", { category: "all", limit: 20 });
    const searchResult = await repo.search("user-bench", "phrase", 10);
    const elapsed = performance.now() - start;

    results.flowVocabulary = {
      name: "Flow C: Vocabulary listPage(20) + search(10)",
      statements: db.metrics.statementCount,
      d1QueryTimeMs: Number(db.metrics.totalQueryTimeMs.toFixed(3)),
      totalTimeMs: Number(elapsed.toFixed(3)),
      pageEntries: page.entries.length,
      searchResults: searchResult.length,
    };
  }

  // BENCHMARK 4: Flow D - Chat Creation with 3 targets
  {
    db.reset();
    let idGen = 0;
    const repoOptions = {
      createId: (k) => `chat-id-${k}-${++idGen}`,
      now: () => "2026-09-02T12:00:00.000Z",
    };
    const chatRepo = createAiChatRepository(db, repoOptions);
    const vocabRepo = createVocabularyRepository(db, repoOptions);

    const start = performance.now();
    const chat = await createChatWithVocabularyOpening({
      chatRepository: chatRepo,
      vocabularyRepository: vocabRepo,
      userId: "user-bench",
      targets: [
        { source: "saved", phraseId: "phrase-1", meaningMode: "all_saved" },
        { source: "saved", phraseId: "phrase-2", meaningMode: "selected", selectedMeaningId: "meaning-2-1" },
        { source: "saved", phraseId: "phrase-3", meaningMode: "explore" },
      ],
    });
    const elapsed = performance.now() - start;

    results.flowChatCreation = {
      name: "Flow D: createChatWithVocabularyOpening (3 targets)",
      statements: db.metrics.statementCount,
      d1QueryTimeMs: Number(db.metrics.totalQueryTimeMs.toFixed(3)),
      totalTimeMs: Number(elapsed.toFixed(3)),
      chatId: chat.id,
    };
  }

  // BENCHMARK 5: Flow E - GET /api/videos
  {
    db.reset();
    const start = performance.now();
    const queryResult = await db.prepare(`
      SELECT id, youtube_video_id, origin_phrase_id, origin_query, restore_query, restore_anchor_seconds,
        origin_caption, language, accent,
        resume_seconds, resume_caption_id, resume_caption_text, progress_updated_at, created_at, updated_at
      FROM saved_videos
      WHERE user_id = ? AND restore_query <> '' AND restore_anchor_seconds >= 0
      ORDER BY updated_at DESC, id ASC
      LIMIT 200
    `).bind("user-bench").all();
    const elapsed = performance.now() - start;

    results.flowVideos = {
      name: "Flow E: GET /api/videos (20 videos)",
      statements: db.metrics.statementCount,
      d1QueryTimeMs: Number(db.metrics.totalQueryTimeMs.toFixed(3)),
      totalTimeMs: Number(elapsed.toFixed(3)),
      videosCount: queryResult.results.length,
    };
  }

  // BENCHMARK 6: Bundle sizes
  {
    const assetsDir = join(root, "dist/client/assets");
    const assets = {};
    let totalClientJsBytes = 0;
    let totalCssBytes = 0;

    for (const file of readdirSync(assetsDir)) {
      const filePath = join(assetsDir, file);
      const size = statSync(filePath).size;
      assets[file] = size;
      if (file.endsWith(".js")) totalClientJsBytes += size;
      if (file.endsWith(".css")) totalCssBytes += size;
    }

    results.bundles = {
      name: "Client Bundle Assets",
      totalClientJsBytes,
      totalCssBytes,
      assets,
    };
  }

  return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const res = await runBenchmarks();
  console.log(JSON.stringify(res, null, 2));
}
