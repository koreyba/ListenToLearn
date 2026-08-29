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

- [x] Trainer exposes `repeatCaptionBtn`, `aria-pressed`, a distinct pressed
  style, and timing-aware caption controls.
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
- [x] Repeat follows a newly selected adjacent caption, handles its consumed
  event, and repeat-off prevents the next consumed event from seeking.
- [x] Ten repeat cycles with varying consumed-callback delays use ten native
  `replay()` calls and zero Repeat `move()` calls.
- [x] A timed caption and a manual iframe-seek caption keep the same YouGlish
  widget instance, reopen their full normalized text, and confirm the same
  video ID from the returned callback before looping.
- [x] Same-widget callbacks arriving before the new `onFetchDone` cannot confirm
  the Repeat target or trigger its replay loop.
- [x] A stale `onFetchDone` received before pause confirmation cannot open the
  transaction barrier for old video/caption callbacks.
- [x] Repeat waits for `PAUSED` before fetch, resumes only previously active
  playback, and fails closed without reload if pause is not confirmed.
- [x] In-place fetch omits the provider-incompatible inline video constraint,
  while a returned result from another video disables Repeat.
- [x] Long provider captions use a centered 12-word search window while full
  normalized caption confirmation remains mandatory.
- [x] Provider-search punctuation is removed after a live punctuated query
  returned zero results, while full caption text remains required for target
  confirmation.
- [x] A provider callback during native Replay confirmation is discarded when
  the target confirms promptly, or becomes the new manual-seek target after the
  bounded confirmation window.
- [x] Missing text/video, zero search results, wrong-video results, fetch error,
  or confirmation timeout disables repeat rather than approximating a loop.

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

Fresh Repeat follow-up evidence on 2026-08-25:

- The controlled-next regression test failed against the previous behavior
  with `aria-pressed` changing from expected `true` to actual `false`; restoring
  caption retargeting made the focused test pass.
- Removing the pressed-state CSS made the rendered-source contract fail;
  restoring the active selector made it pass.
- `npm test`: build passed; 128 tests passed, 0 failed.
- `node --test tests/*.test.mjs`: 142 passed, 0 failed.
- `npx tsc --noEmit`, scoped ESLint for all changed source/test files,
  `git diff --check`, and `npx ai-devkit@latest lint --feature
  phrase-navigation`: passed.

Earlier Repeat stabilization attempt on 2026-08-27, superseded by the live
provider findings below:

- A ten-cycle delayed-callback test failed before the fix with a first seek of
  `-3.10` instead of the cached `-3.00` caption boundary; after preferring the
  known boundary, all ten seeks stayed at `-3.00`.
- A provider-race callback for the next caption initially caused the first fix
  to turn Repeat off. The corrected guard ignores that mismatch, keeps Repeat
  pressed, and resumes the loop when the selected caption confirms the seek.
- Temporarily reverting the boundary preference reproduced drift; restoring the
  self-disabling callback path reproduced the pressed-state failure. Restoring
  both corrected behaviors made the focused Repeat scenarios pass again.
- After synchronizing PR #27, `npm test`: build passed; 257 tests passed,
  0 failed.
- `npx tsc --noEmit`, `git diff --check`, and feature lint passed. ESLint passed
  with 0 errors and 2 existing generated-file warnings in
  `worker-configuration.d.ts`.

Superseded boundary-seek evidence and replacement feasibility on 2026-08-28:

- The first search caption arrived with `current_time: null`. Its consumed event
  produced no seek command under the old implementation, and Repeat moved on to
  the second caption. The corrected path issued native `replay()` on every first
  caption consumption while keeping `aria-pressed="true"`.
- The timed loop progressively landed later in the target caption until it
  repeated roughly 0.3 seconds. Waiting for the observed next boundary removed
  drift but did not recover the clicked caption's beginning.
- Clicking the live YouTube seek slider while Repeat was already on changed the
  target from the old caption to the clicked caption, but the observed
  approximately `-0.69` second move repeated only the tail from the click to the
  next boundary. This invalidated boundary arithmetic as a complete fix.
- A focused live feasibility check searched the full clicked-caption text with
  `#s0TRYW_AnRU`, returned the same YouTube video at the target result, and native
  `replay()` restored the full target caption. The replacement implementation
  therefore resolves timed/manual captions through a constrained search and
  removes all Repeat `move()` calls.
- Reusing `widget.fetch()` during active playback timed out with provider error
  `YG.Error.TIMEOUT (3)`. The same exact query succeeded as the initial fetch on
  a fresh widget. The final implementation calls the documented `close()`,
  replaces only the widget mount, and keeps the trainer URL and outer DOM intact.
- Deterministic contracts now cover first/timed/manual captions, ten delayed
  native-replay cycles, manual seek during Replay confirmation, and stale
  callback cancellation.
- Live post-implementation acceptance enabled Repeat on a timed caption and
  completed ten stable full-caption cycles before the later manual seek: 10
  `replay()` commands, 0 Repeat `move()` commands, pressed state retained.
- Final local verification: `npm test` built successfully and passed 267/267
  tests; `npx tsc --noEmit`, `npm run lint`, `npm ls --depth=0`,
  `git diff --check`, repository AI lint, and feature AI lint all passed. ESLint
  reported only the two pre-existing generated declaration warnings.

Widget-only replacement evidence on 2026-08-28:

- A live timed Repeat kept the trainer URL byte-for-byte unchanged and replaced
  only the provider mount (`fr_yg-widget-0` to `fr_yg-widget-3`). The resolved
  native result retained `aria-pressed="true"` and completed ten replay cycles.
- A live click on the nested YouTube seek slider while Repeat was active again
  kept the outer URL unchanged and replaced only the iframe
  (`fr_yg-widget-3` to `fr_yg-widget-4`) with the clicked caption constrained to
  the same video ID.
- The second replacement could not complete its provider confirmation because
  the iframe reported the YouGlish daily search quota was exceeded. The
  deterministic manual-seek test covers the success callback sequence; the live
  smoke claim is limited to URL stability and widget-only replacement.

Same-widget Repeat evidence on 2026-08-28:

- A video-constrained in-place fetch reproduced `YG.Error.TIMEOUT (3)` even
  after a confirmed `PAUSED` state. Full long-caption searches were also
  unreliable; a centered 12-word window completed in the existing widget.
- Timed Repeat kept the same URL, `fr_yg-widget-0` ID, and iframe `src`, stayed
  pressed, and completed five native replay cycles with zero Repeat `move()`
  commands.
- Clicking the nested YouTube seek slider while Repeat was active selected a
  distant caption, resolved it in the same iframe and video, kept Repeat
  pressed, and completed seven subsequent native replay cycles with zero Repeat
  `move()` commands.
- `npm test` rebuilt the application and passed 273/273 tests. Removing the
  pause-before-fetch phase made the focused regression fail; restoring it made
  the same test pass.

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
