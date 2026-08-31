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

  await renderInteractiveText({ text, onWordActivate: () => {} }, async ({ host }) => {
    const surface = host.firstElementChild;
    assert.equal(surface.textContent, text);
    assert.deepEqual(
      [...surface.querySelectorAll("[data-interactive-english-word]")].map((word) => word.textContent),
      ["Hello", "Don't", "café"],
    );
    assert.equal(surface.querySelectorAll("[data-interactive-english-word]").length, 3);
  });
});

test("assistant Markdown renders CommonMark and GFM without exposing raw HTML", async () => {
  const text = [
    "Отлично: **as far as I know** и *I was gonna say*.",
    "",
    "- ~~Old wording~~",
    "- `fixed phrase`",
    "",
    "<script>alert('unsafe')</script>",
  ].join("\n");

  await renderInteractiveText({
    text,
    markdown: true,
    onWordActivate: () => {},
  }, async ({ host }) => {
    const surface = host.firstElementChild;
    assert.equal(surface.querySelector("strong")?.textContent, "as far as I know");
    assert.equal(surface.querySelector("em")?.textContent, "I was gonna say");
    assert.equal(surface.querySelector("del")?.textContent, "Old wording");
    assert.equal(surface.querySelector("code")?.textContent, "fixed phrase");
    assert.equal(surface.querySelectorAll("li").length, 2);
    assert.equal(surface.querySelector("script"), null);
    assert.doesNotMatch(surface.textContent, /\*\*|alert\('unsafe'\)/u);
  });
});

test("interactive words inside Markdown use clean visible text for actions", async () => {
  const actions = [];

  await renderInteractiveText({
    text: "Use **get away** now.",
    markdown: true,
    onWordActivate: (word, context, details) => actions.push({ word, context, details }),
  }, async ({ dom, host }) => {
    const get = [...host.querySelectorAll("[data-interactive-english-word]")]
      .find((element) => element.textContent === "get");
    assert.equal(get.closest("strong")?.textContent, "get away");

    await act(async () => {
      get.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    });
  });

  assert.deepEqual(actions, [{
    word: "get",
    context: "Use get away now.",
    details: {
      start: "Use ".length,
      end: "Use get".length,
      anchor: { left: 0, top: 0, right: 0, bottom: 0 },
    },
  }]);
});

test("selection-only rendering preserves mixed-script text without per-word tab stops", async () => {
  const text = "Please get away — пожалуйста, уйди.";

  await renderInteractiveText({ text, onPhraseSelect: () => {} }, async ({ host }) => {
    const surface = host.firstElementChild;
    assert.equal(surface.textContent, text);
    assert.equal(surface.querySelectorAll('[role="button"], [tabindex="0"]').length, 0);
    assert.equal(surface.querySelectorAll("[data-interactive-english-word]").length, 0);
  });
});

test("touch selection reports a complete mixed-language range", async () => {
  const text = "Please get away — пожалуйста, уйди now.";
  const actions = [];

  await renderInteractiveText({
    text,
    onPhraseSelect: (phrase, context) => actions.push({ phrase, context }),
  }, async ({ dom, host }) => {
    const surface = host.firstElementChild;
    const selected = "get away — пожалуйста, уйди";
    const start = text.indexOf(selected);
    const selection = dom.window.getSelection();
    const range = dom.window.document.createRange();
    range.setStart(surface.firstChild, start);
    range.setEnd(surface.firstChild, start + selected.length);
    selection.removeAllRanges();
    selection.addRange(range);

    await act(async () => {
      surface.dispatchEvent(new dom.window.Event("touchend", { bubbles: true }));
      await new Promise((resolve) => dom.window.requestAnimationFrame(resolve));
    });
  });

  assert.deepEqual(actions, [{ phrase: "get away — пожалуйста, уйди", context: text }]);
});

test("clicking an English word reports the word with the exact message context", async () => {
  const text = "Hello, мир — get away now.";
  const actions = [];

  await renderInteractiveText({
    text,
    onWordActivate: (word, context, details) => actions.push({ word, context, details }),
  }, async ({ dom, host }) => {
    const word = [...host.querySelectorAll("[data-interactive-english-word]")]
      .find((element) => element.textContent === "get");
    assert.equal(word.getAttribute("role"), "button");
    assert.equal(word.tabIndex, -1);
    assert.equal(word.getAttribute("aria-label"), "Actions for word get");

    await act(async () => {
      word.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    });
  });

  assert.deepEqual(actions, [{
    word: "get",
    context: text,
    details: {
      start: text.indexOf("get"),
      end: text.indexOf("get") + 3,
      anchor: { left: 0, top: 0, right: 0, bottom: 0 },
    },
  }]);
});

test("English word activation supports Enter and Space without reacting to unrelated keys", async () => {
  const actions = [];

  await renderInteractiveText({
    text: "Hello мир",
    onWordActivate: (word) => actions.push(word),
  }, async ({ dom, host }) => {
    const word = host.querySelector("[data-interactive-english-word]");
    for (const key of ["Enter", " ", "Escape"]) {
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

test("English words expose one roving tab stop per message", async () => {
  await renderInteractiveText({
    text: "One two three",
    onWordActivate: () => {},
  }, async ({ dom, host }) => {
    const words = [...host.querySelectorAll("[data-interactive-english-word]")];
    assert.deepEqual(words.map((word) => word.tabIndex), [0, -1, -1]);

    words[0].focus();
    const next = new dom.window.KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "ArrowRight",
    });
    await act(async () => words[0].dispatchEvent(next));

    assert.equal(next.defaultPrevented, true);
    assert.equal(dom.window.document.activeElement, words[1]);
    assert.deepEqual(words.map((word) => word.tabIndex), [-1, 0, -1]);
  });
});

test("a mobile long press never activates an interactive word", async () => {
  const actions = [];

  await renderInteractiveText({
    text: "Hold this word",
    onWordActivate: (word) => actions.push(word),
  }, async ({ dom, host }) => {
    const word = host.querySelector("[data-interactive-english-word]");
    const touchStart = new dom.window.Event("touchstart", { bubbles: true });
    const touchEnd = new dom.window.Event("touchend", { bubbles: true });
    const click = new dom.window.MouseEvent("click", { bubbles: true });
    Object.defineProperty(touchStart, "timeStamp", { value: 0 });
    Object.defineProperty(touchEnd, "timeStamp", { value: 600 });
    Object.defineProperty(click, "timeStamp", { value: 601 });
    await act(async () => {
      word.dispatchEvent(touchStart);
      word.dispatchEvent(touchEnd);
      word.dispatchEvent(click);
      await new Promise((resolve) => dom.window.requestAnimationFrame(resolve));
    });
  });

  assert.deepEqual(actions, []);
});

test("a mobile range selection reports the phrase and suppresses the synthetic word click", async () => {
  const phraseActions = [];
  const wordActions = [];
  const text = "Please get away now";

  await renderInteractiveText({
    text,
    onPhraseSelect: (phrase) => phraseActions.push(phrase),
    onWordActivate: (word) => wordActions.push(word),
  }, async ({ dom, host }) => {
    const words = [...host.querySelectorAll("[data-interactive-english-word]")];
    const get = words.find((word) => word.textContent === "get");
    const away = words.find((word) => word.textContent === "away");
    const selection = dom.window.getSelection();
    const range = dom.window.document.createRange();

    await act(async () => {
      get.dispatchEvent(new dom.window.Event("touchstart", { bubbles: true }));
      range.setStart(get.firstChild, 0);
      range.setEnd(away.firstChild, away.textContent.length);
      selection.removeAllRanges();
      selection.addRange(range);
      away.dispatchEvent(new dom.window.Event("touchend", { bubbles: true }));
      away.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
      await new Promise((resolve) => dom.window.requestAnimationFrame(resolve));
    });
  });

  assert.deepEqual(phraseActions, ["get away"]);
  assert.deepEqual(wordActions, []);
});

test("a later short tap replaces a lingering mobile range with the newly tapped word", async () => {
  const phraseActions = [];
  const wordActions = [];

  await renderInteractiveText({
    text: "Select get away, then practise",
    onPhraseSelect: (phrase) => phraseActions.push(phrase),
    onWordActivate: (word) => wordActions.push(word),
  }, async ({ dom, host }) => {
    const surface = host.firstElementChild;
    const words = [...surface.querySelectorAll("[data-interactive-english-word]")];
    const get = words.find((word) => word.textContent === "get");
    const away = words.find((word) => word.textContent === "away");
    const practise = words.find((word) => word.textContent === "practise");
    const selection = dom.window.getSelection();
    const range = dom.window.document.createRange();
    range.setStart(get.firstChild, 0);
    range.setEnd(away.firstChild, away.textContent.length);
    selection.removeAllRanges();
    selection.addRange(range);

    const selectionEnd = new dom.window.Event("touchend", { bubbles: true });
    Object.defineProperty(selectionEnd, "timeStamp", { value: 1_000 });
    await act(async () => {
      away.dispatchEvent(selectionEnd);
      await new Promise((resolve) => dom.window.requestAnimationFrame(resolve));
    });

    const touchStart = new dom.window.Event("touchstart", { bubbles: true });
    const touchEnd = new dom.window.Event("touchend", { bubbles: true });
    const click = new dom.window.MouseEvent("click", { bubbles: true });
    Object.defineProperty(touchStart, "timeStamp", { value: 2_100 });
    Object.defineProperty(touchEnd, "timeStamp", { value: 2_200 });
    Object.defineProperty(click, "timeStamp", { value: 2_201 });
    await act(async () => {
      practise.dispatchEvent(touchStart);
      practise.dispatchEvent(touchEnd);
      practise.dispatchEvent(click);
      await new Promise((resolve) => dom.window.requestAnimationFrame(resolve));
    });
  });

  assert.deepEqual(phraseActions, ["get away"]);
  assert.deepEqual(wordActions, ["practise"]);
});

test("a later click replaces a lingering desktop range with the newly clicked word", async () => {
  const phraseActions = [];
  const wordActions = [];

  await renderInteractiveText({
    text: "Select get away, then practise",
    onPhraseSelect: (phrase) => phraseActions.push(phrase),
    onWordActivate: (word) => wordActions.push(word),
  }, async ({ dom, host }) => {
    const surface = host.firstElementChild;
    const words = [...surface.querySelectorAll("[data-interactive-english-word]")];
    const get = words.find((word) => word.textContent === "get");
    const away = words.find((word) => word.textContent === "away");
    const practise = words.find((word) => word.textContent === "practise");
    const selection = dom.window.getSelection();
    const range = dom.window.document.createRange();
    range.setStart(get.firstChild, 0);
    range.setEnd(away.firstChild, away.textContent.length);
    selection.removeAllRanges();
    selection.addRange(range);

    await act(async () => {
      surface.dispatchEvent(new dom.window.MouseEvent("mouseup", { bubbles: true }));
      practise.dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true }));
      practise.dispatchEvent(new dom.window.MouseEvent("mouseup", { bubbles: true }));
      practise.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    });
  });

  assert.deepEqual(phraseActions, ["get away"]);
  assert.deepEqual(wordActions, ["practise"]);
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
    onWordActivate: () => {},
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
