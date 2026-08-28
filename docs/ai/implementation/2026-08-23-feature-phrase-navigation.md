---
phase: implementation
title: Implementation Guide
description: Technical implementation notes, patterns, and code guidelines
---

# Implementation Guide

## Development Setup

- Worktree: `feature-phrase-navigation-fix`, based on the merged phrase
  navigation commit `e6cc2bf`; the branch remains local until fresh gates pass.
- Dependencies were installed with `npm ci`.
- Repository checks are `npm test`, `npx tsc --noEmit`, `npm run lint`,
  `git diff --check`, and `npx ai-devkit@latest lint --feature
  phrase-navigation`.
- The branch remains local until the post-sync gates pass. The adjacent
  Google-auth task is now merged, satisfying the user's push condition.

## Code Structure

- `public/caption-navigation.js`: small browser-safe pure helper module for
  finite timing validation, idempotent timeline upserts, cached-neighbor lookup,
  and relative Previous/Next seek calculations.
- `public/trainer.html`: existing trainer controller, YouGlish event wiring,
  controls, asynchronous navigation state, and provider fallback UI.
- `wrangler.preview.jsonc` and `wrangler.production.jsonc`: explicit built
  artifact deployment targets with separate Worker/D1 bindings.
- `scripts/deploy-worker.mjs`: target-checked deploy entry point; production is
  opt-in through `ALLOW_PRODUCTION_DEPLOY=1`.
- `tests/rendered-html.test.mjs`: rendered-source contracts, inline-script
  syntax validation, and deterministic helper tests.

## Implementation Notes

### Caption timeline

- `onCaptionChange` accepts an opaque provider `id` and only records an entry
  when `current_time` is finite and non-negative.
- Entries are scoped to the current YouGlish video, sorted by start time, and
  updated idempotently when the same ID is observed again.
- Player-state transitions retain the last known in-caption time across a pause,
  so a cached target does not assume the user paused exactly at the caption
  start.
- The timeline is cleared on query/source/saved-example/video changes. Timing
  and caption text are never persisted to localStorage or D1.

### Previous/next navigation

- A cached neighbor is reached with a relative `widget.move(delta)` derived
  from observed start times, then selected immediately from the local timeline.
  The provider callback can reconcile the display later, but it is not required
  to unlock the button.
- An unobserved neighbor is not discovered by repeated movement. The relevant
  button stays disabled until normal playback observes the caption.
- One navigation movement may be in flight. The synchronous guard prevents
  overlapping click handlers, and a movement error blocks that direction until
  fresh caption evidence resets the boundary state.
- The controls never call `widget.previous()`/`widget.next()` and never treat
  a fixed five-second rewind as phrase navigation.
- If a movement fails, the corresponding direction is blocked until a fresh
  caption observation resets the boundary state.
- When `state.source` is `tatoeba`, the timed caption-navigation group and
  `repeatCaptionBtn` are hidden. Whole-track previous/next, replay, and native
  audio controls remain available.

### Repeat current caption

- `Повтор фразы` is a native toggle with `aria-pressed` and a visibly accented
  pressed state.
- `onCaptionConsumed` is accepted only for the active opaque caption ID. The
  native search caption calls `widget.replay()`.
- A timestamped or manually selected caption is resolved by calling
  `widget.close()`, replacing only the widget mount inside
  `youglishWidgetHost`, and constructing a fresh `YG.Widget`. The outer page,
  URL, history, and other controls remain intact. The new widget's initial fetch
  uses `"<caption> #<video id> :r"`. Repeat remains pressed while the
  controller verifies the same video and normalized first-caption text, then
  makes the native search result the repeat target.
- `repeatCaptionSearchText` removes provider-search punctuation while retaining
  Unicode letters, digits, and apostrophes. The expected value remains the full
  original caption; only the search query is relaxed.
- Each widget instance has a monotonically increasing generation and guarded
  event handlers. Late callbacks from a closed iframe are ignored instead of
  being routed into the replacement's repeat state.
- Reusing `widget.fetch()` inside an actively playing widget is deliberately not
  used: the live provider returned `YG.Error.TIMEOUT (3)`, while initial fetch on
  a fresh widget consistently opened the same caption and video.
- A 750 ms confirmation guard separates a stale post-Replay callback from a
  manual iframe seek. Only the first mismatched caption is retained; a timely
  target callback cancels it, otherwise it is resolved through the same exact
  video-constrained fetch.
- Repeat has bounded resolution timers, never derives a media duration, and
  never uses `widget.move()` for looping. Search rejection, zero results,
  wrong-video results, timeout, and context reset fail closed with visible status.

### Deployment target isolation

- `wrangler.jsonc` names the `preview` environment explicitly, but deployment
  uses dedicated configs because the Vinext-generated config omits the source
  environment details.
- `deploy-worker.mjs` refuses unknown targets and `--config`/`--env`/`--name`
  overrides, verifies the selected Worker name and required build artifacts,
  and blocks production without an explicit opt-in variable.

## Integration Points

- The helper script is loaded before the existing inline trainer controller.
- YouGlish remains an embedded cross-origin widget; the implementation uses
  native initial fetch/replay, `move` for Previous/Next, caption events, player
  state, and existing track controls.
- Tatoeba keeps its existing audio-track controls; timed caption-navigation and
  phrase-repeat controls are hidden because the source has no timed chunks.
- No server route, database schema, binding, secret, or auth behavior changed.

## Error Handling

- Missing helper, missing `move`, missing/invalid `current_time`, or provider
  event drift leaves YouGlish phrase controls disabled with an explicit
  explanation. Tatoeba hides those controls because it has no timed chunks.
- Movement exceptions are caught, the failed direction is blocked, and repeat
  is disabled rather than retried indefinitely.
- Caption navigation status is updated after a local cached target or movement
  failure; existing video navigation remains available independently.

## Performance Considerations

- Idle playback has no polling or interval.
- Cached navigation performs one relative movement and one local state update.
- Timeline data is kept only for the active video and is bounded by observed
  caption events.

## Security Notes

- No provider credentials, OAuth material, or new network endpoint was added.
- The implementation does not inspect the cross-origin iframe or call private
  YouGlish endpoints.

## Known Provider Boundary

`current_time` is observed in the current widget build but is not listed as a
stable property in the public YouGlish API documentation. If the provider stops
forwarding usable timing or changes event ordering, exact controls fail closed;
the branch does not claim a provider-level guarantee.
