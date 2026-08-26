import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM } from "jsdom";

const controller = await readFile(new URL("../public/theme-controller.js", import.meta.url), "utf8");

function setup({ systemDark = false, storedTheme } = {}) {
  const dom = new JSDOM(
    '<!doctype html><html><head><meta name="theme-color" content="#000000"></head><body><button data-theme-toggle type="button"><span data-theme-icon></span></button></body></html>',
    { runScripts: "outside-only", url: "https://unmumble.online/" },
  );
  const listeners = new Map();
  dom.window.matchMedia = () => ({
    matches: systemDark,
    addEventListener: (name, listener) => listeners.set(name, listener),
  });
  if (storedTheme) dom.window.localStorage.setItem("unmumble:theme", storedTheme);
  dom.window.eval(controller);
  dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded"));
  return { dom, button: dom.window.document.querySelector("[data-theme-toggle]"), listeners };
}

test("theme defaults to the operating system and exposes the next action", () => {
  const { dom, button } = setup({ systemDark: true });

  assert.equal(dom.window.document.documentElement.dataset.theme, "dark");
  assert.equal(button.getAttribute("aria-pressed"), "true");
  assert.equal(button.getAttribute("aria-label"), "Switch to light theme");
  assert.equal(dom.window.document.querySelector('meta[name="theme-color"]').getAttribute("content"), "#0d1116");
});

test("saved preference wins and toggling persists the explicit choice", () => {
  const { dom, button } = setup({ systemDark: true, storedTheme: "light" });

  assert.equal(dom.window.document.documentElement.dataset.theme, "light");
  button.click();
  assert.equal(dom.window.document.documentElement.dataset.theme, "dark");
  assert.equal(dom.window.localStorage.getItem("unmumble:theme"), "dark");
  assert.equal(button.getAttribute("aria-label"), "Switch to light theme");
});

test("theme preference synchronizes from another tab", () => {
  const { dom } = setup({ storedTheme: "dark" });

  dom.window.dispatchEvent(new dom.window.StorageEvent("storage", {
    key: "unmumble:theme",
    newValue: "light",
  }));
  assert.equal(dom.window.document.documentElement.dataset.theme, "light");
});
