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
