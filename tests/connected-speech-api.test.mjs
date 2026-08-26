import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  mapCatalogRows,
  mapPhraseRows,
} from "../lib/catalog/catalog-api.ts";

const catalogRow = {
  id: "s001",
  text: "tell him",
  pattern: "[tell him]",
  ipa: "telɪm",
  translation: "",
  context: "",
  source_type: "preset",
  catalog_order: 1,
  status: "pick",
  created_at: "2026-08-26T00:00:00.000Z",
  updated_at: "2026-08-26T00:00:00.000Z",
  analysis_kind: "atom",
  analysis_rank: 1,
  analysis_pattern: "[tell him]",
  analysis_ipa: "telɪm",
  analysis_search_query: "tell him",
  analysis_alternate_query: null,
  mechanism: "elision",
  mechanism_order: 0,
};

test("catalog rows become one analyzed card with ordered mechanisms", () => {
  const cards = mapCatalogRows([
    { ...catalogRow, mechanism: "linking", mechanism_order: 1 },
    catalogRow,
  ]);

  assert.equal(cards.length, 1);
  assert.deepEqual(cards[0], {
    id: "s001",
    text: "tell him",
    sourceType: "catalog",
    analysis: {
      kind: "atom",
      rank: 1,
      pattern: "[tell him]",
      ipa: "telɪm",
      searchQuery: "tell him",
      alternateQuery: null,
      mechanisms: ["elision", "linking"],
    },
  });
});

test("account phrase mapping keeps custom and legacy analysis explicitly null", () => {
  const custom = {
    ...catalogRow,
    id: "custom-1",
    source_type: "custom",
    analysis_kind: null,
    analysis_rank: null,
    analysis_pattern: null,
    analysis_ipa: null,
    analysis_search_query: null,
    analysis_alternate_query: null,
    mechanism: null,
    mechanism_order: null,
  };
  const legacy = { ...custom, id: "preset-6", source_type: "preset" };

  const phrases = mapPhraseRows([custom, legacy]);

  assert.equal(phrases[0].analysis, null);
  assert.equal(phrases[0].sourceType, "custom");
  assert.equal(phrases[1].analysis, null);
  assert.equal(phrases[1].sourceType, "legacy");
});

test("public catalog route is read-only D1 projection without account state", async () => {
  const route = await readFile(new URL("../app/api/catalog/route.ts", import.meta.url), "utf8");

  assert.match(route, /export async function GET/);
  assert.doesNotMatch(route, /export async function (?:POST|PATCH|PUT|DELETE)/);
  assert.match(route, /FROM catalog_phrase_analysis AS analysis/);
  assert.match(route, /Cache-Control.*public, max-age=300/s);
  assert.doesNotMatch(route, /getCurrentUser|phrase_progress|owner_id/);
});

test("custom phrase creation rejects catalog metadata and stores no fabricated grouping", async () => {
  const route = await readFile(new URL("../app/api/phrases/route.ts", import.meta.url), "utf8");

  assert.match(route, /containsCatalogMetadata/);
  assert.match(route, /Catalog analysis cannot be supplied for a custom phrase/);
  assert.doesNotMatch(route, /bind\(id, text, "\[" \+ text \+ "\]"/);
});
