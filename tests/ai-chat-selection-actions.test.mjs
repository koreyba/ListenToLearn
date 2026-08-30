import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";

test("translation and vocabulary actions always use the latest selected text", async () => {
  const rootDirectory = new URL("..", import.meta.url).pathname;
  const server = await createServer({
    appType: "custom",
    configFile: false,
    logLevel: "silent",
    plugins: [react()],
    resolve: { alias: { "@": rootDirectory } },
    root: rootDirectory,
    server: { middlewareMode: true },
  });
  const { ChatSelectionActions } = await server.environments.ssr.runner.import(
    "/app/components/ai-chat-selection-actions.tsx",
  );
  const dom = new JSDOM("<div id='root'></div>", {
    pretendToBeVisual: true,
    url: "http://127.0.0.1/chat",
  });
  const previousGlobals = {
    document: globalThis.document,
    fetch: globalThis.fetch,
    HTMLElement: globalThis.HTMLElement,
    Node: globalThis.Node,
    window: globalThis.window,
    actEnvironment: globalThis.IS_REACT_ACT_ENVIRONMENT,
  };
  const calls = [];
  let slowRequestAborted = false;
  Object.assign(globalThis, {
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
    window: dom.window,
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async (url, init = {}) => {
      const body = JSON.parse(String(init.body || "{}"));
      calls.push({ url, body });
      if (url === "/api/translate" && body.text === "slow") {
        return new Promise((resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            slowRequestAborted = true;
            reject(new DOMException("Aborted", "AbortError"));
          }, { once: true });
          void resolve;
        });
      }
      return url === "/api/translate"
        ? Response.json({ translation: `ru:${body.text}` })
        : Response.json({ status: "to_learn", translationPending: false });
    },
  });

  const host = document.querySelector("#root");
  const root = createRoot(host);
  const selection = (text) => ({
    messageId: "message-1",
    text,
    context: `Context for ${text}.`,
    anchor: { left: 10, top: 300, right: 50, bottom: 320 },
  });
  const renderSelection = async (text) => act(async () => {
    root.render(createElement(ChatSelectionActions, {
      onDismiss() {},
      selection: selection(text),
    }));
  });
  const click = async (label) => act(async () => {
    const button = [...document.querySelectorAll("button")]
      .find((candidate) => candidate.textContent === label);
    assert.ok(button, `${label} button is rendered`);
    button.click();
    await Promise.resolve();
    await Promise.resolve();
  });

  try {
    await renderSelection("first");
    await click("Translate");
    assert.equal(document.querySelector(".ai-chat-selection-translation strong")?.textContent, "ru:first");

    await renderSelection("second");
    assert.equal(document.querySelector("blockquote")?.textContent, "second");
    assert.equal(document.querySelector(".ai-chat-selection-translation"), null);

    await click("Translate");
    await click("Add to learning");
    assert.equal(document.querySelector(".ai-chat-selection-translation strong")?.textContent, "ru:second");
    assert.deepEqual(calls, [
      {
        url: "/api/translate",
        body: { text: "first", context: "Context for first." },
      },
      {
        url: "/api/translate",
        body: { text: "second", context: "Context for second." },
      },
      {
        url: "/api/phrases",
        body: {
          text: "second",
          context: "Context for second.",
          translation: "ru:second",
        },
      },
    ]);

    await renderSelection("slow");
    await click("Translate");
    await renderSelection("fresh");
    assert.equal(slowRequestAborted, true);
    assert.equal(document.querySelector(".ai-chat-selection-translation"), null);
    await click("Translate");
    assert.equal(document.querySelector(".ai-chat-selection-translation strong")?.textContent, "ru:fresh");
    assert.deepEqual(calls.slice(-2).map((call) => call.body.text), ["slow", "fresh"]);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    Object.assign(globalThis, {
      document: previousGlobals.document,
      fetch: previousGlobals.fetch,
      HTMLElement: previousGlobals.HTMLElement,
      Node: previousGlobals.Node,
      window: previousGlobals.window,
      IS_REACT_ACT_ENVIRONMENT: previousGlobals.actEnvironment,
    });
    await server.close();
  }
});

test("a late translation from an old selection cannot replace the fresh translation when abort is ignored", async () => {
  const rootDirectory = new URL("..", import.meta.url).pathname;
  const server = await createServer({
    appType: "custom",
    configFile: false,
    logLevel: "silent",
    plugins: [react()],
    resolve: { alias: { "@": rootDirectory } },
    root: rootDirectory,
    server: { middlewareMode: true },
  });
  const { ChatSelectionActions } = await server.environments.ssr.runner.import(
    "/app/components/ai-chat-selection-actions.tsx",
  );
  const dom = new JSDOM("<div id='root'></div>", {
    pretendToBeVisual: true,
    url: "http://127.0.0.1/chat",
  });
  const previousGlobals = {
    document: globalThis.document,
    fetch: globalThis.fetch,
    HTMLElement: globalThis.HTMLElement,
    Node: globalThis.Node,
    window: globalThis.window,
    actEnvironment: globalThis.IS_REACT_ACT_ENVIRONMENT,
  };
  const calls = [];
  let resolveSlowTranslation;
  Object.assign(globalThis, {
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
    window: dom.window,
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async (url, init = {}) => {
      const body = JSON.parse(String(init.body || "{}"));
      calls.push({ url, body });
      if (url === "/api/translate" && body.text === "slow") {
        return new Promise((resolve) => {
          resolveSlowTranslation = resolve;
        });
      }
      return Response.json({ translation: `ru:${body.text}` });
    },
  });

  const host = document.querySelector("#root");
  const root = createRoot(host);
  const renderSelection = async (text) => act(async () => {
    root.render(createElement(ChatSelectionActions, {
      onDismiss() {},
      selection: {
        messageId: "message-1",
        text,
        context: `Context for ${text}.`,
        anchor: { left: 10, top: 300, right: 50, bottom: 320 },
      },
    }));
  });
  const translate = async () => act(async () => {
    const button = [...document.querySelectorAll("button")]
      .find((candidate) => candidate.textContent === "Translate");
    assert.ok(button, "Translate button is rendered");
    button.click();
    await Promise.resolve();
    await Promise.resolve();
  });

  try {
    await renderSelection("slow");
    await translate();
    assert.equal(typeof resolveSlowTranslation, "function");

    await renderSelection("fresh");
    await translate();
    assert.equal(document.querySelector(".ai-chat-selection-translation strong")?.textContent, "ru:fresh");

    await act(async () => {
      resolveSlowTranslation(Response.json({ translation: "ru:slow" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    assert.equal(document.querySelector("blockquote")?.textContent, "fresh");
    assert.equal(document.querySelector(".ai-chat-selection-translation strong")?.textContent, "ru:fresh");
    assert.deepEqual(calls.map((call) => call.body.text), ["slow", "fresh"]);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    Object.assign(globalThis, {
      document: previousGlobals.document,
      fetch: previousGlobals.fetch,
      HTMLElement: previousGlobals.HTMLElement,
      Node: previousGlobals.Node,
      window: previousGlobals.window,
      IS_REACT_ACT_ENVIRONMENT: previousGlobals.actEnvironment,
    });
    await server.close();
  }
});
