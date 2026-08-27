import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

test("saved video schema and migration add account resume metadata", async () => {
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
  const names = await readdir(new URL("../drizzle/", import.meta.url));
  const migrationName = names.find((name) => name.startsWith("0011_"));
  const migration = migrationName
    ? await readFile(new URL(`../drizzle/${migrationName}`, import.meta.url), "utf8")
    : "";

  assert.match(schema, /resumeSeconds: real\("resume_seconds"\)\.notNull\(\)\.default\(0\)/);
  assert.match(schema, /resumeCaptionId: text\("resume_caption_id"\)\.notNull\(\)\.default\(""\)/);
  assert.match(schema, /resumeCaptionText: text\("resume_caption_text"\)\.notNull\(\)\.default\(""\)/);
  assert.match(schema, /progressUpdatedAt: text\("progress_updated_at"\)/);
  assert.match(migration, /ALTER TABLE [`]saved_videos[`] ADD [`]resume_seconds[`] real DEFAULT 0 NOT NULL/);
  assert.match(migration, /ALTER TABLE [`]saved_videos[`] ADD [`]progress_updated_at[`] text/);
});

test("video API round-trips optional progress and preserves it when omitted", async () => {
  const route = await readFile(new URL("../app/api/videos/route.ts", import.meta.url), "utf8");

  assert.match(route, /readVideoProgressInput\(payload\.progress\)/);
  assert.match(route, /resume_seconds/);
  assert.match(route, /resume_caption_id/);
  assert.match(route, /resume_caption_text/);
  assert.match(route, /progress_updated_at/);
  assert.match(route, /progressProvided/);
  assert.match(route, /WHERE user_id = \? AND youtube_video_id = \?/);
});

test("new saved videos persist a required restore query and hide legacy rows", async () => {
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
  const names = await readdir(new URL("../drizzle/", import.meta.url));
  const migrationName = names.find((name) => name.startsWith("0014_"));
  const migration = migrationName
    ? await readFile(new URL(`../drizzle/${migrationName}`, import.meta.url), "utf8")
    : "";
  const route = await readFile(new URL("../app/api/videos/route.ts", import.meta.url), "utf8");

  assert.match(schema, /restoreQuery: text\("restore_query"\)\.notNull\(\)\.default\(""\)/);
  assert.match(migration, /ALTER TABLE [`]saved_videos[`] ADD [`]restore_query[`] text DEFAULT '' NOT NULL/);
  assert.match(route, /restore_query/);
  assert.match(route, /const restoreQuery = cleanText\(payload\.restoreQuery, 240\)/);
  assert.match(route, /!originQuery \|\| !restoreQuery/);
  assert.match(route, /restore_query <> ''/);
});

test("new saved videos persist a measured restore anchor and hide rows without one", async () => {
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
  const names = await readdir(new URL("../drizzle/", import.meta.url));
  const migrationName = names.find((name) => name.startsWith("0015_"));
  const migration = migrationName
    ? await readFile(new URL(`../drizzle/${migrationName}`, import.meta.url), "utf8")
    : "";
  const route = await readFile(new URL("../app/api/videos/route.ts", import.meta.url), "utf8");

  assert.match(schema, /restoreAnchorSeconds: real\("restore_anchor_seconds"\)\.notNull\(\)\.default\(-1\)/);
  assert.match(migration, /ALTER TABLE [`]saved_videos[`] ADD [`]restore_anchor_seconds[`] real DEFAULT -1 NOT NULL/);
  assert.match(route, /restore_anchor_seconds/);
  assert.match(route, /const restoreAnchorTime = validVideoTime\(payload\.restoreAnchorTime\)/);
  assert.match(route, /typeof value === "string" && !value\.trim\(\)/);
  assert.match(route, /restoreAnchorTime === null/);
  assert.match(route, /restore_anchor_seconds >= 0/);
});
