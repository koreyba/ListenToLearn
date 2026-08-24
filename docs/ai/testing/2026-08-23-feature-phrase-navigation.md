---
phase: testing
title: Testing Strategy
description: Define testing approach, test cases, and quality assurance
---

# Testing Strategy

## Test Coverage Goals

- Cover every new branch in timing detection, timeline upsert, cached-neighbor
  selection, movement errors, repeat-off, and provider fallback.
- Keep the existing rendered HTML, TypeScript, lint, build, and diff gates green.
- Use a deterministic fake `YG.Widget` for controller behavior; use a live
  YouGlish smoke check only for provider compatibility, not as the sole test.

## Unit Tests

The current project uses rendered-source tests, so the first layer asserts the
browser contract and parses the inline script:

- [x] Trainer exposes `repeatCaptionBtn`, `aria-pressed`, and timing-aware
  caption controls.
- [x] Trainer registers `onCaptionConsumed` and `onPlayerStateChange`, reads
  `event.current_time`, and never labels `move(-5)` as caption navigation.
- [x] Inline JavaScript remains syntactically valid.

`tests/rendered-html.test.mjs` also loads `public/caption-navigation.js` in a
deterministic VM and covers finite-time rejection, opaque-ID idempotent upsert,
timestamp ordering, adjacent lookup, relative seek deltas, and repeat delta
fallbacks.

`tests/deployment-config.test.mjs` verifies that preview has an explicit Worker
name and preview D1 binding, and that production deployment is opt-in.

Controller scenarios to cover with a fake widget/event harness:

- [ ] A valid caption event is stored once; duplicate IDs refresh observation
  time without duplicating the timeline.
- [x] Cached previous/next uses the same video and updates the local target
  without waiting for a duplicate caption event.
- [x] An unobserved neighbor leaves the corresponding direction disabled.
- [ ] First/last caption disables the corresponding direction.
- [ ] Missing/invalid `current_time` disables exact controls without calling
  `move(-5)`.
- [ ] A source/video reset or newer command leaves controls consistent.
- [ ] Repeat handles only the active caption ID, and repeat-off prevents the
  next consumed event from seeking.
- [ ] Repeat failure on an unexpected caption disables repeat rather than
  continuing an unsafe loop.

## Integration Tests

- [ ] Existing video previous/next calls remain `widget.previous()`/
  `widget.next()` and are not intercepted by caption navigation.
- [ ] Caption navigation resets on `onVideoChange`, source switching, query
  changes, and saved-example changes.
- [x] Tatoeba keeps its audio-track controls and hides timed caption actions;
  the rendered-source contract covers both visibility decisions and whole-track
  previous/next controls.
- [ ] Translation selection and `+ To Learn` still use the latest caption after
  a successful phrase navigation.

## End-to-End Tests

- [ ] In a live YouGlish widget that emits finite `current_time`, play two or
  more captions, navigate back/forward through already observed captions, and
  confirm the visible caption and video ID stay aligned without a busy wait.
- [ ] Enable repeat on a short caption, observe at least two consumption cycles,
  disable repeat, and confirm playback proceeds to the next caption.
- [ ] Run the same smoke path on desktop and a 390px mobile viewport.
- [ ] Verify provider fallback when timing is absent by injecting a fake widget
  without `current_time`.

## Test Data

Use deterministic fake events on one video:

```json
[
  {"id": "a", "caption": "first", "current_time": 10},
  {"id": "b", "caption": "second", "current_time": 12},
  {"id": "c", "caption": "third", "current_time": 15}
]
```

Also cover missing `current_time`, repeated `id`, a video change, and a widget
that throws from `move`.

## Test Reporting & Coverage

Run the repository-native checks:

- `npm test`
- `npx tsc --noEmit`
- `npm run lint`
- `git diff --check`
- `npx ai-devkit@latest lint --feature phrase-navigation`
- `node --test tests/deployment-config.test.mjs`

Record live smoke limitations explicitly because the timing field is not part
of the documented public contract.

Fresh evidence on 2026-08-23:

- `node --test tests/rendered-html.test.mjs`: 14 passed, 0 failed, including
  the merged Google-auth Worker contract test.
- `bash scripts/sites-env.sh -- ./node_modules/.bin/vinext build`: passed.
- `npx tsc --noEmit`: passed.
- `npm run lint`: exit 0; two existing warnings remain in
  `worker-configuration.d.ts`, with 0 errors.
- `git diff --check`: passed.
- `npx ai-devkit@latest lint --feature phrase-navigation`: passed.
- `node --test tests/deployment-config.test.mjs`: 2 passed, 0 failed.
- `npm run deploy:preview -- --dry-run`: passed with only the preview D1
  binding; `ALLOW_PRODUCTION_DEPLOY=1 npm run deploy:production -- --dry-run`:
  passed with only the production D1 binding.
- Workers Build `12b9af05-cb6e-4a26-8897-726ee9d597f9`: passed after switching
  the preview trigger from `versions upload` to the guarded full deploy;
  active preview version `bee7f499-afc5-48fc-b30a-171c0dbe8ea3` was read back,
  and the deployed trainer contains `navigationMode` and `widget.replay`.
- Regression gate: removing the cached-neighbor helper produced 1 failing test;
  restoring it returned the suite to 13 passed.
- Historical note: `npm test` was blocked by the build wrapper's GNU `timeout`
  dependency during this feature run; the shared wrapper was made portable
  with `scripts/run-bounded.mjs` on 2026-08-24.
- Local Chrome smoke against the static `public/` server at a 390px viewport
  confirmed `source=tatoeba`, hidden `captionNavigation` and
  `repeatCaptionBtn`, visible whole-track previous/next controls, and
  `document.documentElement.scrollWidth === 390`; switching to YouGlish made
  both timed-control regions visible again. The static server returned 404 for
  application APIs, so this smoke covered source/UI state only.
- A real YouGlish caption navigation/repeat cycle was not verified: the live
  widget reported that its daily search quota was exceeded, and the Worker
  dev server is incompatible with this installed Miniflare compatibility-date
  ceiling.

## Manual Testing

- [ ] Confirm labels, source-specific hidden/disabled state, focus order,
  `aria-pressed`, and status text.
- [ ] Confirm no phrase button changes the YouGlish video track.
- [ ] Confirm repeat does not survive a query/video/source reset.
- [ ] Confirm fallback remains honest after a widget update that omits timing.
- [ ] Confirm no horizontal overflow on mobile and no regression of caption word
  translation/selection actions.

## Performance & Reliability

- Idle path has no polling.
- Cached navigation is one relative move plus one local update.
- No second navigation or repeat loop may start while a prior movement call is
  in progress.

## Bug Tracking

Any live provider mismatch is recorded as a provider-compatibility blocker with
the observed event payload and widget version; do not weaken the fallback or
silently broaden the seek approximation.
