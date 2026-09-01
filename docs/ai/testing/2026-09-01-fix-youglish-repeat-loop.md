---
phase: testing
title: YouGlish Repeat Loop Testing
description: Provider-sequence contracts for the Trainer Repeat toggle
---

# YouGlish Repeat Loop Testing

## Harness

`tests/helpers/trainer-harness.mjs` now hosts the shared jsdom Trainer harness
with the fake YouGlish widget. It records ordered widget commands, exposes the
caption text, the status line, and source buttons, and can override trainer
constants such as `REPEAT_OVERSHOOT_TIMEOUT_MS`.

## Scenarios (`tests/youglish-repeat-loop.test.mjs`)

Every scenario feeds the provider's real sequence: `onCaptionConsumed(N)`
followed by `onCaptionChange(N + 1)` with a playback position.

- The return seek is anchored to the consumed caption's cached start and stays
  identical across fifteen cycles; it never collapses into a sub-second loop.
- The caption after the looped one is cached as a neighbor but never shown or
  looped; a landing shortly before the target waits for it.
- Unexpected landings are corrected at most twice before the loop follows the
  playing caption.
- The seek lag is calibrated from the reported landing and shifts later
  returns by the averaged difference.
- A caption first seen mid-way adopts the earlier natural boundary as its start.
- An untimed first caption loops with a timed return once its duration has been
  measured; without a measurement it falls back to `replay()` without
  pause/play churn.
- The return waits for the configured tail margin after the caption switch.
- The toggle survives a video change (timed and untimed first caption), a
  caption without a timestamp, a source switch and back, and can be enabled
  before any caption arrives; only the user turns it off.
- Previous, Next, and Replay retarget the loop; a Next click issued after the
  consumed callback wins over the pending return; a controlled Next never arms.
- Duplicate consumed callbacks arm one return; a timed fallback covers a
  consumed callback without a following caption callback.
- The local trace records `repeat.*` events without provider identifiers.

## Completion gates

- `node --test tests/*.test.mjs`: passed, 661/661.
- `npx eslint` on the changed JavaScript and test files: passed;
  `tsc --noEmit`, `npm run build`, and `npm run test:worker`: passed.
- Live widget check on localhost with `captionTrace=1`: timed captions and an
  untimed first caption each looped five consecutive cycles landing at the same
  position, with the seek lag calibrating to about 0.28 s.
