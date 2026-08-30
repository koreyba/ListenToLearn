import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";

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
const proposalModule = await server.environments.ssr.runner.import(
  "/app/components/ai-chat-write-proposal.tsx",
).catch(() => ({}));

test.after(async () => server.close());

async function renderProposal(props, inspect) {
  assert.equal(
    typeof proposalModule.AiChatWriteProposal,
    "function",
    "AiChatWriteProposal must be exported",
  );
  const dom = new JSDOM("<div id='root'></div>", {
    pretendToBeVisual: true,
    url: "http://127.0.0.1/chat",
  });
  const previousGlobals = {
    document: globalThis.document,
    HTMLElement: globalThis.HTMLElement,
    Node: globalThis.Node,
    window: globalThis.window,
    actEnvironment: globalThis.IS_REACT_ACT_ENVIRONMENT,
  };
  Object.assign(globalThis, {
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
    window: dom.window,
    IS_REACT_ACT_ENVIRONMENT: true,
  });

  const host = document.querySelector("#root");
  const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(
      proposalModule.AiChatWriteProposal,
      props,
    )));
    await inspect({ dom, host, root });
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    Object.assign(globalThis, {
      document: previousGlobals.document,
      HTMLElement: previousGlobals.HTMLElement,
      Node: previousGlobals.Node,
      window: previousGlobals.window,
      IS_REACT_ACT_ENVIRONMENT: previousGlobals.actEnvironment,
    });
  }
}

const items = [
  { id: "uncanny", text: "uncanny", translation: "strange or mysterious" },
  { id: "break-even", text: "break even", translation: "cover the costs" },
];

test("a pending write proposal is an accessible inline confirmation", async () => {
  const actions = [];

  await renderProposal({
    proposalId: "proposal-1",
    operation: "add_vocabulary_entries",
    items,
    status: "pending",
    onConfirm: (proposalId) => actions.push(["confirm", proposalId]),
    onCancel: (proposalId) => actions.push(["cancel", proposalId]),
  }, async ({ host }) => {
    const card = host.querySelector("section");
    assert.ok(card);
    assert.equal(card.getAttribute("role"), null);
    assert.equal(card.getAttribute("aria-modal"), null);
    assert.equal(card.getAttribute("aria-busy"), "false");
    assert.equal(card.querySelector("h3")?.textContent, "Add to vocabulary");
    assert.equal(card.querySelector(".ai-chat-write-proposal-count")?.textContent, "2 entries");
    assert.deepEqual(
      [...card.querySelectorAll("li")].map((item) => item.textContent),
      ["uncannystrange or mysterious", "break evencover the costs"],
    );

    const status = card.querySelector('[role="status"]');
    assert.equal(status?.getAttribute("aria-live"), "polite");
    assert.match(status?.textContent || "", /Review 2 entries before adding them/u);

    const buttons = [...card.querySelectorAll("button")];
    assert.deepEqual(buttons.map((button) => button.textContent), ["Cancel", "Confirm"]);
    for (const button of buttons) {
      assert.equal(button.type, "button");
      assert.equal(button.style.minHeight, "44px");
      assert.equal(button.disabled, false);
    }

    await act(async () => buttons[1].click());
    await act(async () => buttons[0].click());
  });

  assert.deepEqual(actions, [
    ["confirm", "proposal-1"],
    ["cancel", "proposal-1"],
  ]);
});

test("a long proposal expands inline while exposing its disclosure state", async () => {
  const longItems = [
    ...items,
    { id: "serendipity", text: "serendipity", translation: "a happy accident" },
    { id: "hit-the-road", text: "hit the road", translation: "leave" },
    { id: "wrap-up", text: "wrap up", translation: "finish" },
  ];

  await renderProposal({
    proposalId: "proposal-long",
    operation: "add_vocabulary_entries",
    items: longItems,
    status: "pending",
    onConfirm() {},
    onCancel() {},
  }, async ({ host }) => {
    const list = host.querySelector("ol");
    const toggle = host.querySelector(".ai-chat-write-proposal-toggle");
    assert.equal(list?.querySelectorAll("li").length, 3);
    assert.equal(toggle?.textContent, "Show 2 more");
    assert.equal(toggle?.getAttribute("aria-expanded"), "false");
    assert.equal(toggle?.getAttribute("aria-controls"), list?.id);
    assert.equal(toggle?.style.minHeight, "44px");

    await act(async () => toggle.click());
    assert.equal(list?.querySelectorAll("li").length, 5);
    assert.equal(toggle?.textContent, "Show fewer");
    assert.equal(toggle?.getAttribute("aria-expanded"), "true");

    await act(async () => toggle.click());
    assert.equal(list?.querySelectorAll("li").length, 3);
    assert.equal(toggle?.getAttribute("aria-expanded"), "false");
  });
});

test("busy and terminal proposal states announce truthful non-actionable results", async () => {
  const actions = [];
  const cases = [
    {
      status: "busy",
      ariaBusy: "true",
      role: "status",
      message: "Applying change…",
      buttons: ["Cancel", "Applying…"],
    },
    {
      status: "confirmed",
      ariaBusy: "false",
      role: "status",
      message: "1 entry added · 1 already saved.",
      buttons: [],
      result: {
        entries: [
          { text: "uncanny", state: "added" },
          { text: "break even", state: "already_saved" },
        ],
      },
    },
    {
      status: "cancelled",
      ariaBusy: "false",
      role: "status",
      message: "Proposal cancelled. No vocabulary changes were made.",
      buttons: [],
    },
    {
      status: "failed",
      ariaBusy: "false",
      role: "alert",
      message: "The provider rejected this proposal.",
      buttons: [],
    },
  ];

  for (const state of cases) {
    await renderProposal({
      proposalId: `proposal-${state.status}`,
      operation: "add_vocabulary_entries",
      items,
      result: state.result,
      status: state.status,
      errorMessage: state.status === "failed" ? state.message : undefined,
      onConfirm: (proposalId) => actions.push(["confirm", proposalId]),
      onCancel: (proposalId) => actions.push(["cancel", proposalId]),
    }, async ({ host }) => {
      const card = host.querySelector("section");
      const region = card.querySelector(`[role="${state.role}"]`);
      const buttons = [...card.querySelectorAll(".ai-chat-write-proposal-actions button")];
      assert.equal(card.getAttribute("aria-busy"), state.ariaBusy);
      assert.equal(region?.getAttribute("aria-live"), state.role === "alert" ? "assertive" : "polite");
      assert.equal(region?.textContent, state.message);
      assert.deepEqual(buttons.map((button) => button.textContent), state.buttons);

      for (const button of buttons) {
        assert.equal(button.disabled, true);
        await act(async () => button.click());
      }
    });
  }

  assert.deepEqual(actions, []);
});

test("meaning and category proposals use operation-specific copy", async () => {
  const cases = [
    {
      operation: "add_vocabulary_meaning",
      title: "Add meaning",
      pending: "Review this meaning before adding it.",
    },
    {
      operation: "update_vocabulary_meaning",
      title: "Update meaning",
      pending: "Review this meaning change.",
    },
    {
      operation: "set_vocabulary_category",
      title: "Change learning status",
      pending: "Review this learning-status change.",
    },
  ];

  for (const item of cases) {
    await renderProposal({
      proposalId: `proposal-${item.operation}`,
      operation: item.operation,
      items: [{ id: "entry-1", text: "uncanny", translation: "загадочный" }],
      status: "pending",
    }, async ({ host }) => {
      assert.equal(host.querySelector("h3")?.textContent, item.title);
      assert.equal(host.querySelector('[role="status"]')?.textContent, item.pending);
    });
  }
});
