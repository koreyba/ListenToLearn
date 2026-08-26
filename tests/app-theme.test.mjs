import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the shared app theme owns the Forest and Clay grid backdrop", async () => {
  const theme = await readFile(new URL("../public/app-theme.css", import.meta.url), "utf8");

  assert.match(theme, /--app-sage: #afc1a3/);
  assert.match(theme, /--app-clay: #c88767/);
  assert.match(theme, /--app-grid-line: rgba\(255, 255, 255, \.025\)/);
  assert.match(theme, /--app-grid-size: 76px/);
  assert.match(theme, /linear-gradient\(var\(--app-grid-line\) 1px, transparent 1px\)/);
  assert.match(theme, /radial-gradient\(circle at 72% 42%, rgba\(200, 135, 103, \.12\), transparent 25rem\)/);
  assert.match(theme, /radial-gradient\(circle at 24% 72%, rgba\(175, 193, 163, \.1\), transparent 28rem\)/);
  assert.match(theme, /background-attachment: fixed/);
});

test("every application surface loads the shared app theme", async () => {
  const [globals, trainer] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../public/trainer.html", import.meta.url), "utf8"),
  ]);

  assert.match(globals, /@import "\.\.\/public\/app-theme\.css"/);
  assert.match(trainer, /<link rel="stylesheet" href="\/app-theme\.css" \/>/);
});

test("page styles consume the shared theme instead of redefining it", async () => {
  const globals = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.doesNotMatch(globals, /--bg: #/);
  assert.doesNotMatch(globals, /rgba\(75, 153, 190, \.14\)/);
  assert.match(globals, /--landing-lime: var\(--app-sage\)/);
  assert.match(globals, /--landing-blue: var\(--app-clay\)/);
  assert.match(globals, /\.landing-page \{[^}]*background: transparent;/s);
});

test("navigation and content cards use the shared surface tokens", async () => {
  const [globals, navigation] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../public/site-navigation.css", import.meta.url), "utf8"),
  ]);

  for (const selector of ["phrase-card", "integration-card", "video-stage", "video-card"]) {
    assert.match(globals, new RegExp(`\\.${selector} \\{[^}]*background: var\\(--app-card-background\\)`, "s"));
  }
  assert.match(navigation, /\.site-navigation \{[^}]*background: var\(--app-nav-background\)/s);
  assert.doesNotMatch(`${globals}\n${navigation}`, /#3f7d96|#c8efff|#79d6ff/i);
});

test("interface typography stays readable while landing headings keep their display face", async () => {
  const [theme, globals, navigation] = await Promise.all([
    readFile(new URL("../public/app-theme.css", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../public/site-navigation.css", import.meta.url), "utf8"),
  ]);

  assert.match(theme, /--app-ui-font: Inter, ui-sans-serif, system-ui/);
  assert.match(theme, /--app-display-font: "Avenir Next", Avenir/);
  assert.match(theme, /body \{[^}]*font-family: var\(--app-ui-font\)/s);
  assert.match(globals, /--landing-display-font: var\(--app-display-font\)/);
  assert.match(navigation, /\.site-brand \{[^}]*font-weight: 800/s);
  assert.match(navigation, /\.site-primary-link \{[^}]*font-weight: 700/s);
});

test("interface titles stay neutral while sage is only an active marker", async () => {
  const [theme, navigation] = await Promise.all([
    readFile(new URL("../public/app-theme.css", import.meta.url), "utf8"),
    readFile(new URL("../public/site-navigation.css", import.meta.url), "utf8"),
  ]);

  assert.match(theme, /--app-text: #f4f5f6/);
  assert.match(theme, /--app-muted: #a7adb2/);
  assert.match(navigation, /\.site-brand\[aria-current="page"\] \{ color: var\(--text\); \}/);
  assert.match(navigation, /\.site-primary-link\[aria-current="page"\] \{[^}]*color: var\(--text\);[^}]*box-shadow: inset 0 -2px 0 var\(--app-sage\)/s);
  assert.match(navigation, /\.site-account-link:hover \{[^}]*color: var\(--text\)/s);
});
