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

test("Library and Practice cards reuse one compact Practice action", async () => {
  const workspace = await readFile(new URL("../app/components/phrase-workspace.tsx", import.meta.url), "utf8");

  assert.match(workspace, /function PracticeAction\(\{ onClick \}: \{ onClick: \(\) => void \}\)/);
  assert.equal((workspace.match(/<PracticeAction onClick=\{\(\) => openPhrase\(phrase\)\} \/>/g) ?? []).length, 1);
  assert.doesNotMatch(workspace, /practice-action/);
});

test("To Learn cards move to Learning Now and remain removable", async () => {
  const workspace = await readFile(new URL("../app/components/phrase-workspace.tsx", import.meta.url), "utf8");

  assert.match(workspace, /phrase\.status === "to_learn" && <button[^\n]*>Move to Learning Now<\/button>/);
  assert.doesNotMatch(workspace, />Start Learning<\/button>/);
  assert.match(workspace, /\{phrase\.status !== "pick" && <button className="secondary"/);
});

test("custom phrases are added from every Practice tab into To Learn", async () => {
  const workspace = await readFile(new URL("../app/components/phrase-workspace.tsx", import.meta.url), "utf8");

  assert.match(workspace, /\{surface === "practice" && <form className="add-form custom-phrase-form" onSubmit=\{addCustom\}>/);
  assert.doesNotMatch(workspace, /\{surface === "library" && <form className="add-form custom-phrase-form"/);
  assert.match(workspace, /const nextPhrase: Phrase = \{[\s\S]*?status: nextStatus,[\s\S]*?\};/);
  assert.match(workspace, /setActiveTab\(nextStatus\)/);
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

test("SearchIcon component is unified across Library and Practice with no legacy unicode search characters", async () => {
  const workspace = await readFile(new URL("../app/components/phrase-workspace.tsx", import.meta.url), "utf8");

  // Verify SearchIcon component definition with Heroicons outline vector path
  assert.match(workspace, /function SearchIcon\(\{[\s\S]*?size = 18/);
  assert.match(workspace, /m21 21-5\.197-5\.197m0 0A7\.5 7\.5 0 1 0 5\.196 5\.196a7\.5 7\.5 0 0 0 10\.607 10\.607Z/);

  // Verify SearchIcon is used in Library search field, Practice search field, and Practice mobile search button
  assert.match(workspace, /<SearchIcon className="search-field-icon" size=\{17\} \/>/);
  assert.match(workspace, /<SearchIcon className="search-field-icon desktop-only" size=\{17\} \/>/);
  assert.match(workspace, /<SearchIcon size=\{19\} \/>/);

  // Verify no legacy unicode telephone recorder / search character ⌕ remains
  assert.doesNotMatch(workspace, /⌕/);
});

test("MobileFilterButton component is reused across Library and Practice with active count badge", async () => {
  const workspace = await readFile(new URL("../app/components/phrase-workspace.tsx", import.meta.url), "utf8");

  // Verify MobileFilterButton definition
  assert.match(workspace, /function MobileFilterButton\(\{[\s\S]*?activeCount,[\s\S]*?onClick,[\s\S]*?\}\)/);
  assert.match(workspace, /activeCount > 0 \? \([\s\S]*?<span className="filter-count-badge">\{activeCount\}<\/span>/);

  // Verify activeFiltersCount calculates for both surfaces
  assert.match(workspace, /const activeFiltersCount = surface === "library"[\s\S]*?\? \(1 \+ selectedMechanisms\.size\)[\s\S]*?: \(selectedMechanisms\.size \+ \(practiceSources\.size < 2 \? 1 : 0\)\);/);

  // Verify MobileFilterButton is invoked in both Library and Practice
  const filterButtonCalls = workspace.match(/<MobileFilterButton\s+activeCount=\{activeFiltersCount\}\s+onClick=\{\(\) => setMobileFilterOpen\(true\)\}\s*\/>/g);
  assert.equal(filterButtonCalls?.length, 2, "MobileFilterButton must be used in both Library and Practice");
});

test("Library preserves added phrases with green checkmark badge and suppresses undo banner", async () => {
  const workspace = await readFile(new URL("../app/components/phrase-workspace.tsx", import.meta.url), "utf8");

  // Verify added phrases are not filtered out of the catalog
  assert.match(workspace, /if \(surface === "library"\) \{\s+if \(phrase\.analysis\?\.kind === activeFormat\)/);
  assert.doesNotMatch(workspace, /if \(phrase\.status === "pick" && phrase\.analysis\?\.kind === activeFormat\)/);

  // Verify green Added badges are rendered on Library when status !== 'pick'
  assert.match(workspace, /className="catalog-added-badge desktop-only"/);
  assert.match(workspace, /className="catalog-added-badge-mobile mobile-only"/);

  // Verify notice banner is suppressed on Library
  assert.match(workspace, /\{notice && surface !== "library" && \(/);
});

test("Practice mobile toolbar renders search, add, and filter action group", async () => {
  const workspace = await readFile(new URL("../app/components/phrase-workspace.tsx", import.meta.url), "utf8");

  assert.match(workspace, /className="practice-single-input-row"/);
  assert.match(workspace, /className="practice-icon-btn practice-search-icon-btn mobile-only"/);
  assert.match(workspace, /className=\{`practice-icon-btn practice-add-icon-btn mobile-only\$\{practiceSearch\.trim\(\) \? " has-text" : ""\}`\}/);
});

test("Mobile bottom sheet positions mechanism explanation tooltips within bounds without horizontal overflow", async () => {
  const globals = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  // Must target .bottom-sheet .mechanism-popover (not non-existent .sheet-panel)
  assert.match(globals, /\.bottom-sheet \.mechanism-popover\s*\{[\s\S]*?left:\s*auto\s*!important[\s\S]*?right:\s*(-?[0-9]+px)\s*!important[\s\S]*?width:\s*min\(260px,\s*calc\(100vw\s*-\s*48px\)\)\s*!important/);
  assert.match(globals, /\.bottom-sheet \.mechanism-popover::before\s*\{[\s\S]*?left:\s*auto\s*!important[\s\S]*?right:\s*([0-9]+px)\s*!important/);
  assert.doesNotMatch(globals, /\.sheet-panel \.mechanism-popover/);
});


