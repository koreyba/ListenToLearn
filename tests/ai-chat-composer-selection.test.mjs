import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";

const selectionModule = await import("../lib/ai-chat/composer-selection.ts").catch(() => ({}));

test("composer caret stays at the same character when moving between editors", () => {
  assert.equal(typeof selectionModule.readComposerSelection, "function");
  assert.equal(typeof selectionModule.restoreComposerSelection, "function");

  const dom = new JSDOM("<textarea id='compact'></textarea><textarea id='expanded'></textarea>");
  const compact = dom.window.document.querySelector("#compact");
  const expanded = dom.window.document.querySelector("#expanded");
  compact.value = "1234";
  expanded.value = compact.value;
  compact.focus();
  compact.setSelectionRange(2, 2);

  const saved = selectionModule.readComposerSelection(compact);
  selectionModule.restoreComposerSelection(expanded, saved);

  assert.equal(dom.window.document.activeElement, expanded);
  assert.equal(expanded.selectionStart, 2);
  assert.equal(expanded.selectionEnd, 2);
  dom.window.close();
});
