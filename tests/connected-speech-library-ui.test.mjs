import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { mergeGuestCatalog } from "../lib/catalog/guest-catalog.ts";

const analysis = {
  kind: "atom",
  rank: 1,
  pattern: "[tell him]",
  ipa: "telɪm",
  searchQuery: "tell him",
  alternateQuery: null,
  mechanisms: ["elision"],
};

test("guest catalog merge preserves reused status, active legacy and text-only custom phrases", () => {
  const phrases = mergeGuestCatalog({
    version: 2,
    statuses: { "preset-0": "learning_now", "preset-6": "to_learn" },
    customPhrases: [{
      id: "guest-custom-1",
      text: "my own phrase",
      pattern: "[my own phrase]",
      ipa: "",
      context: "",
      translation: "",
      status: "to_learn",
      createdAt: "2026-08-26T00:00:00.000Z",
      updatedAt: "2026-08-26T00:00:00.000Z",
    }],
    savedExamples: [],
    savedVideos: [],
  }, [{ id: "preset-0", text: "tell him", sourceType: "catalog", analysis }], [{
    id: "preset-6",
    text: "you're gonna have to do it",
    pattern: "[you're gonna] [have to] [do it]",
    ipa: "jərgənə hæftə duːɪt",
  }]);

  assert.equal(phrases.find((phrase) => phrase.id === "preset-0")?.status, "learning_now");
  assert.equal(phrases.find((phrase) => phrase.id === "preset-6")?.sourceType, "legacy");
  assert.equal(phrases.find((phrase) => phrase.id === "guest-custom-1")?.analysis, null);
});

test("guest catalog merge hides untouched retired presets from discovery", () => {
  const phrases = mergeGuestCatalog({
    version: 2,
    statuses: {},
    customPhrases: [],
    savedExamples: [],
    savedVideos: [],
  }, [{ id: "preset-0", text: "tell him", sourceType: "catalog", analysis }], [{
    id: "preset-6",
    text: "legacy",
    pattern: "[legacy]",
    ipa: "leɡəsi",
  }]);

  assert.deepEqual(phrases.map((phrase) => phrase.id), ["preset-0"]);
});

test("dedicated Library exposes formats, mechanisms, search and Add with Undo", async () => {
  const [home, library, workspace, navigation] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/library/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/phrase-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/site-navigation.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(home, /<SiteNavigation active="home"/);
  assert.match(home, /href="\/library"/);
  assert.doesNotMatch(home, /<PhraseWorkspace/);
  assert.match(library, /<PhraseWorkspace surface="library"/);
  assert.match(navigation, /href: "\/library", label: "Library"/);
  assert.match(workspace, /CONNECTED_SPEECH_MECHANISMS/);
  assert.match(workspace, /PRACTICE_FORMATS/);
  assert.match(workspace, /Search the catalog/);
  assert.match(workspace, /Add to Learn/);
  assert.match(workspace, />Undo</);
});

test("Practice omits fabricated analysis placeholders for custom and legacy phrases", async () => {
  const workspace = await readFile(new URL("../app/components/phrase-workspace.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(workspace, /Transcription will appear later/);
  assert.match(workspace, /phrase\.analysis &&/);
  assert.match(workspace, /Your phrase/);
});

test("account custom form keeps an existing catalog card analyzed when text already matches", async () => {
  const workspace = await readFile(new URL("../app/components/phrase-workspace.tsx", import.meta.url), "utf8");

  const reuseBranch = workspace.indexOf("if (data.created === false && data.id)");
  const customProjection = workspace.indexOf("const nextPhrase: Phrase");
  assert.ok(reuseBranch >= 0, "existing account phrases need a dedicated reuse branch");
  assert.ok(reuseBranch < customProjection, "reuse must happen before projecting a new custom phrase");
  assert.match(workspace.slice(reuseBranch, customProjection), /\.\.\.phrase,[\s\S]*?status: nextStatus/);
});

test("stored sorting is restored only when the current surface supports it", async () => {
  const workspace = await readFile(new URL("../app/components/phrase-workspace.tsx", import.meta.url), "utf8");

  assert.match(workspace, /const storedSortOptions = surface === "library" \? catalogSortOptions : practiceSortOptions/);
  assert.match(workspace, /storedSortOptions\.some\(\(option\) => option\.value === stored\)/);
});
