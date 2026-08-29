import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";

const componentModule = await import("../app/components/interactive-english-text.ts").catch(() => ({}));

async function renderInteractiveText(props, inspect) {
  const dom = new JSDOM("<div id='root'></div>", { pretendToBeVisual: true });
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousNode = globalThis.Node;
  const previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.Node = dom.window.Node;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  const host = dom.window.document.querySelector("#root");
  const root = createRoot(host);
  try {
    await act(async () => {
      root.render(createElement(componentModule.InteractiveEnglishText, props));
    });
    await inspect({ dom, host });
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
    globalThis.Node = previousNode;
    globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  }
}

test("message rendering preserves exact text and wraps only English words", async () => {
  const text = "  Hello, мир! Don't 42 café.\n";

  await renderInteractiveText({ text }, async ({ host }) => {
    const surface = host.firstElementChild;
    assert.equal(surface.textContent, text);
    assert.deepEqual(
      [...surface.querySelectorAll("[data-interactive-english-word]")].map((word) => word.textContent),
      ["Hello", "Don't", "café"],
    );
    assert.equal(surface.querySelectorAll("[data-interactive-english-word]").length, 3);
  });
});

test("clicking an English word reports the word with the exact message context", async () => {
  const text = "Hello, мир — get away now.";
  const actions = [];

  await renderInteractiveText({
    text,
    onWordActivate: (word, context) => actions.push({ word, context }),
  }, async ({ dom, host }) => {
    const word = [...host.querySelectorAll("[data-interactive-english-word]")]
      .find((element) => element.textContent === "get");
    assert.equal(word.getAttribute("role"), "button");
    assert.equal(word.tabIndex, 0);
    assert.equal(word.getAttribute("aria-label"), "Translate word get");

    await act(async () => {
      word.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    });
  });

  assert.deepEqual(actions, [{ word: "get", context: text }]);
});

test("English word activation supports Enter and Space without reacting to other keys", async () => {
  const actions = [];

  await renderInteractiveText({
    text: "Hello мир",
    onWordActivate: (word) => actions.push(word),
  }, async ({ dom, host }) => {
    const word = host.querySelector("[data-interactive-english-word]");
    for (const key of ["Enter", " ", "ArrowRight"]) {
      const event = new dom.window.KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key,
      });
      await act(async () => word.dispatchEvent(event));
      assert.equal(event.defaultPrevented, key === "Enter" || key === " ");
    }
  });

  assert.deepEqual(actions, ["Hello", "Hello"]);
});

test("clicking a word in a long response reports a bounded nearby context", async () => {
  const text = `${"Old context. ".repeat(120)}Use serendipity here. ${"Later context. ".repeat(120)}`;
  const actions = [];

  await renderInteractiveText({
    text,
    onWordActivate: (word, context) => actions.push({ word, context }),
  }, async ({ dom, host }) => {
    const word = [...host.querySelectorAll("[data-interactive-english-word]")]
      .find((element) => element.textContent === "serendipity");
    await act(async () => {
      word.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    });
  });

  assert.equal(actions[0].word, "serendipity");
  assert.ok([...actions[0].context].length <= 1_000);
  assert.match(actions[0].context, /Use serendipity here/u);
});

test("phrase selection fires only inside one message and leaves the browser selection intact", async () => {
  const text = "Use get away now.";
  const phraseActions = [];
  const wordActions = [];

  await renderInteractiveText({
    text,
    onPhraseSelect: (phrase, context) => phraseActions.push({ phrase, context }),
    onWordActivate: (word) => wordActions.push(word),
  }, async ({ dom, host }) => {
    const surface = host.firstElementChild;
    const words = [...surface.querySelectorAll("[data-interactive-english-word]")];
    const get = words.find((word) => word.textContent === "get");
    const away = words.find((word) => word.textContent === "away");
    const selection = dom.window.getSelection();
    const range = dom.window.document.createRange();
    range.setStart(get.firstChild, 0);
    range.setEnd(away.firstChild, away.textContent.length);
    selection.removeAllRanges();
    selection.addRange(range);

    await act(async () => {
      surface.dispatchEvent(new dom.window.MouseEvent("mouseup", { bubbles: true }));
      away.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    });
    assert.equal(selection.toString(), "get away");

    const outside = dom.window.document.createElement("span");
    outside.textContent = " another message";
    host.appendChild(outside);
    const crossingRange = dom.window.document.createRange();
    crossingRange.setStart(get.firstChild, 0);
    crossingRange.setEnd(outside.firstChild, outside.textContent.length);
    selection.removeAllRanges();
    selection.addRange(crossingRange);
    await act(async () => {
      surface.dispatchEvent(new dom.window.MouseEvent("mouseup", { bubbles: true }));
    });
  });

  assert.deepEqual(phraseActions, [{ phrase: "get away", context: text }]);
  assert.deepEqual(wordActions, []);
});

test("repeated phrase selection uses the context of the selected occurrence", async () => {
  const text = "First use: get away quietly. Second use: please get away now.";
  const actions = [];

  await renderInteractiveText({
    text,
    onPhraseSelect: (phrase, context) => actions.push({ phrase, context }),
  }, async ({ dom, host }) => {
    const surface = host.firstElementChild;
    const words = [...surface.querySelectorAll("[data-interactive-english-word]")];
    const gets = words.filter((word) => word.textContent === "get");
    const aways = words.filter((word) => word.textContent === "away");
    const selection = dom.window.getSelection();
    const range = dom.window.document.createRange();
    range.setStart(gets[1].firstChild, 0);
    range.setEnd(aways[1].firstChild, aways[1].textContent.length);
    selection.removeAllRanges();
    selection.addRange(range);

    await act(async () => {
      surface.dispatchEvent(new dom.window.MouseEvent("mouseup", { bubbles: true }));
    });
  });

  assert.deepEqual(actions, [{
    phrase: "get away",
    context: "Second use: please get away now.",
  }]);
});
