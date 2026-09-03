import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM } from "jsdom";

async function setup(fetchImpl) {
  const source = await readFile(
    new URL("../public/feedback-widget.js", import.meta.url),
    "utf8",
  ).catch(() => "");
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    runScripts: "outside-only",
    url: "https://unmumble.online/practice?tab=learning",
  });
  dom.window.URL.createObjectURL = () => "blob:feedback-preview";
  dom.window.URL.revokeObjectURL = () => {};
  if (fetchImpl) dom.window.fetch = fetchImpl;
  dom.window.eval(source);
  return dom;
}

test("feedback widget opens an accessible three-category form", async () => {
  const dom = await setup();
  const button = dom.window.document.querySelector("[data-feedback-open]");
  assert.ok(button, "feedback trigger is rendered");
  button.click();

  const dialog = dom.window.document.querySelector('[role="dialog"]');
  assert.ok(dialog);
  assert.equal(dialog.hidden, false);
  assert.equal(dialog.getAttribute("aria-modal"), "true");
  assert.equal(dom.window.document.querySelectorAll('select[name="category"] option').length, 3);
  assert.ok(dom.window.document.querySelector('textarea[name="message"]'));
  const image = dom.window.document.querySelector('input[name="image"]');
  assert.equal(image.type, "file");
  assert.equal(image.accept, "image/jpeg,image/png,image/webp");
  assert.equal(image.required, false);
  assert.ok(dom.window.document.querySelector('input[name="website"]'));
});

test("feedback widget posts the report with automatic page context and shows success", async () => {
  const calls = [];
  const dom = await setup(async (...args) => {
    calls.push(args);
    return Response.json({ ok: true, id: "feedback-1" }, { status: 201 });
  });
  dom.window.document.querySelector("[data-feedback-open]").click();
  dom.window.document.querySelector('select[name="category"]').value = "idea";
  dom.window.document.querySelector('textarea[name="message"]').value = "Add keyboard shortcuts.";
  const imageInput = dom.window.document.querySelector('input[name="image"]');
  const image = new dom.window.File(["image bytes"], "screen.png", { type: "image/png" });
  Object.defineProperty(imageInput, "files", { configurable: true, value: [image] });

  const form = dom.window.document.querySelector("[data-feedback-form]");
  form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "/api/feedback");
  assert.equal(calls[0][1].method, "POST");
  assert.equal(calls[0][1].headers, undefined);
  assert.ok(calls[0][1].body instanceof dom.window.FormData);
  assert.equal(calls[0][1].body.get("category"), "idea");
  assert.equal(calls[0][1].body.get("message"), "Add keyboard shortcuts.");
  assert.equal(calls[0][1].body.get("pageUrl"), "https://unmumble.online/practice?tab=learning");
  assert.equal(calls[0][1].body.get("website"), "");
  assert.equal(calls[0][1].body.get("image").name, "screen.png");
  assert.equal(dom.window.document.querySelector("[data-feedback-status]").textContent, "Thanks — feedback received.");
  assert.equal(dom.window.document.querySelector('textarea[name="message"]').value, "");
});

test("feedback widget previews a selected image and lets the user remove it", async () => {
  const dom = await setup();
  const input = dom.window.document.querySelector('input[name="image"]');
  const image = new dom.window.File(["image bytes"], "screen.png", { type: "image/png" });
  Object.defineProperty(input, "files", { configurable: true, value: [image] });

  input.dispatchEvent(new dom.window.Event("change", { bubbles: true }));

  const preview = dom.window.document.querySelector("[data-feedback-image-preview]");
  assert.equal(preview.hidden, false);
  assert.match(dom.window.document.querySelector("[data-feedback-image]").src, /blob:feedback-preview$/);
  assert.equal(dom.window.document.querySelector("[data-feedback-image-name]").textContent, "screen.png");

  dom.window.document.querySelector("[data-feedback-image-remove]").click();
  assert.equal(preview.hidden, true);
});

test("feedback widget rejects a selected image larger than 5 MB before upload", async () => {
  const dom = await setup(() => assert.fail("an oversized image must not be uploaded"));
  const input = dom.window.document.querySelector('input[name="image"]');
  const image = new dom.window.File([
    new Uint8Array((5 * 1024 * 1024) + 1),
  ], "huge.png", { type: "image/png" });
  Object.defineProperty(input, "files", { configurable: true, value: [image] });

  input.dispatchEvent(new dom.window.Event("change", { bubbles: true }));

  assert.equal(
    dom.window.document.querySelector("[data-feedback-status]").textContent,
    "Keep the image under 5 MB.",
  );
  assert.equal(dom.window.document.querySelector("[data-feedback-image-preview]").hidden, true);
});

test("feedback widget rejects a selected file that is not JPEG, PNG, or WebP", async () => {
  const dom = await setup(() => assert.fail("an unsupported file must not be uploaded"));
  const input = dom.window.document.querySelector('input[name="image"]');
  const file = new dom.window.File(["notes"], "notes.txt", { type: "text/plain" });
  Object.defineProperty(input, "files", { configurable: true, value: [file] });

  input.dispatchEvent(new dom.window.Event("change", { bubbles: true }));

  assert.equal(
    dom.window.document.querySelector("[data-feedback-status]").textContent,
    "Attach a JPEG, PNG, or WebP image.",
  );
  assert.equal(dom.window.document.querySelector("[data-feedback-image-preview]").hidden, true);
});

test("feedback widget keeps the report editable when submission fails", async () => {
  const dom = await setup(async () => Response.json(
    { error: "Could not save the feedback. Try again." },
    { status: 500 },
  ));
  dom.window.document.querySelector("[data-feedback-open]").click();
  const message = dom.window.document.querySelector('textarea[name="message"]');
  message.value = "Replay stopped.";
  dom.window.document.querySelector("[data-feedback-form]").dispatchEvent(
    new dom.window.Event("submit", { bubbles: true, cancelable: true }),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(message.value, "Replay stopped.");
  assert.equal(
    dom.window.document.querySelector("[data-feedback-status]").textContent,
    "Could not save the feedback. Try again.",
  );
  assert.equal(dom.window.document.querySelector(".feedback-submit").disabled, false);
});
