import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("feedback widget loads on both React pages and the standalone trainer", async () => {
  const [layout, globals, trainer, styles] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../public/trainer.html", import.meta.url), "utf8"),
    readFile(new URL("../public/feedback-widget.css", import.meta.url), "utf8").catch(() => ""),
  ]);

  assert.match(layout, /<Script src="\/feedback-widget\.js" strategy="afterInteractive" \/>/);
  assert.match(globals, /@import "\.\.\/public\/feedback-widget\.css";/);
  assert.match(trainer, /<link rel="stylesheet" href="\/feedback-widget\.css" \/>/);
  assert.match(trainer, /<script src="\/feedback-widget\.js" defer><\/script>/);
  assert.match(styles, /\.feedback-trigger/);
  assert.match(styles, /\.feedback-dialog/);
  assert.match(styles, /\.feedback-image-preview/);
  assert.match(styles, /@media \(max-width: 760px\)/);
});
