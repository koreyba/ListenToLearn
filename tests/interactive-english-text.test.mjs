import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";

const interactiveText = await import("../lib/interactive-english-text.ts").catch(() => ({}));

test("English tokenization preserves all text while isolating clickable words", () => {
  const source = "“Don't re-enter café,” — сказал.";
  const segments = interactiveText.segmentInteractiveEnglishText(source);

  assert.equal(segments.map((segment) => segment.text).join(""), source);
  assert.deepEqual(
    segments.filter((segment) => segment.kind === "word").map((segment) => segment.text),
    ["Don't", "re-enter", "café"],
  );
  assert.deepEqual(
    segments.map(({ kind, start, end }) => ({ kind, start, end })),
    [
      { kind: "text", start: 0, end: 1 },
      { kind: "word", start: 1, end: 6 },
      { kind: "text", start: 6, end: 7 },
      { kind: "word", start: 7, end: 15 },
      { kind: "text", start: 15, end: 16 },
      { kind: "word", start: 16, end: 21 },
      { kind: "text", start: 21, end: source.length },
    ],
  );
});

test("phrase selection is accepted only when it is bounded inside one message", () => {
  const dom = new JSDOM("<p id='one'>Use <b>get away</b> now.</p><p id='two'>Another message.</p>");
  const document = dom.window.document;
  const first = document.querySelector("#one");
  const second = document.querySelector("#two");
  const selection = dom.window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(first.querySelector("b"));
  selection.removeAllRanges();
  selection.addRange(range);

  assert.equal(interactiveText.readInteractiveSelection(first, selection, 20), "get away");
  assert.equal(interactiveText.readInteractiveSelection(second, selection, 20), "");
  assert.equal(interactiveText.readInteractiveSelection(first, selection, 4), "");
});

test("translation context stays bounded around a selection in a long message", () => {
  const prefix = "Earlier unrelated sentence. ".repeat(60);
  const selected = "serendipity";
  const suffix = " Later unrelated sentence.".repeat(60);
  const source = `${prefix}The discovery was pure ${selected} for the team.${suffix}`;
  const start = source.indexOf(selected);

  const context = interactiveText.interactiveEnglishContext(
    source,
    start,
    start + selected.length,
    1_000,
  );

  assert.ok([...context].length <= 1_000);
  assert.match(context, /pure serendipity for the team/u);
});

test("an async translation result belongs only to the same selected text and context", () => {
  const current = { text: "run", context: "She can run a company." };

  assert.equal(
    interactiveText.matchesInteractiveSelection(
      current,
      "run",
      "She can run a company.",
    ),
    true,
  );
  assert.equal(
    interactiveText.matchesInteractiveSelection(
      current,
      "run",
      "She can run five kilometres.",
    ),
    false,
  );
});
