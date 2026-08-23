---
phase: testing
title: Testing Strategy
description: Define testing approach, test cases, and quality assurance
---

# Testing Strategy

## Test Coverage Goals

- Cover every new branch in timing detection, timeline upsert, adjacent-target
  selection, timeout/cancellation, repeat-off, and provider fallback.
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

Controller scenarios to cover with a fake widget/event harness:

- [ ] A valid caption event is stored once; duplicate IDs refresh observation
  time without duplicating the timeline.
- [ ] Cached previous/next uses the same video and expected target ID.
- [ ] An unobserved neighbor is found by bounded half-second steps.
- [ ] First/last caption disables the corresponding direction.
- [ ] Missing/invalid `current_time` disables exact controls without calling
  `move(-5)`.
- [ ] A timeout, source/video reset, or newer command invalidates an older
  waiter and leaves controls consistent.
- [ ] Repeat handles only the active caption ID, and repeat-off prevents the
  next consumed event from seeking.
- [ ] Repeat failure on an unexpected caption disables repeat rather than
  continuing an unsafe loop.

## Integration Tests

- [ ] Existing video previous/next calls remain `widget.previous()`/
  `widget.next()` and are not intercepted by caption navigation.
- [ ] Caption navigation resets on `onVideoChange`, source switching, query
  changes, and saved-example changes.
- [ ] Tatoeba keeps its audio-track controls and does not expose timed caption
  actions.
- [ ] Translation selection and `+ To Learn` still use the latest caption after
  a successful phrase navigation.

## End-to-End Tests

- [ ] In a live YouGlish widget that emits finite `current_time`, play two or
  more captions, navigate back/forward, and confirm the visible caption and
  video ID stay aligned.
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

Record live smoke limitations explicitly because the timing field is not part
of the documented public contract.

Fresh evidence on 2026-08-23:

- `node --test tests/rendered-html.test.mjs`: 11 passed, 0 failed.
- `bash scripts/sites-env.sh -- ./node_modules/.bin/vinext build`: passed.
- `npx tsc --noEmit`: passed.
- `npm run lint`: exit 0; two existing warnings remain in
  `worker-configuration.d.ts`, with 0 errors.
- `git diff --check`: passed.
- `npx ai-devkit@latest lint --feature phrase-navigation`: passed.
- `npm test`: blocked before build by the repository wrapper's GNU `timeout`
  requirement on this macOS host; direct equivalent build and test commands
  above passed.
- Read-only local browser smoke served `public/` successfully: the helper
  loaded, Tatoeba kept phrase controls disabled, YouGlish showed the timing
  fallback, and the repeat button exposed the disabled/pressed contract.
- At a 390px viewport, `document.documentElement.scrollWidth` was 390px and
  all three phrase controls remained visible and disabled without timing data.
- A real YouGlish caption navigation/repeat cycle was not verified: the live
  widget reported that its daily search quota was exceeded, and the Worker
  dev server is incompatible with this installed Miniflare compatibility-date
  ceiling.

## Manual Testing

- [ ] Confirm labels, disabled state, focus order, `aria-pressed`, and status text.
- [ ] Confirm no phrase button changes the YouGlish video track.
- [ ] Confirm repeat does not survive a query/video/source reset.
- [ ] Confirm fallback remains honest after a widget update that omits timing.
- [ ] Confirm no horizontal overflow on mobile and no regression of caption word
  translation/selection actions.

## Performance & Reliability

- Idle path has no polling.
- Each navigation has a finite timeout and a maximum of 80 half-second steps.
- No second navigation or repeat loop may start while a prior operation is
  pending.

## Bug Tracking

Any live provider mismatch is recorded as a provider-compatibility blocker with
the observed event payload and widget version; do not weaken the fallback or
silently broaden the seek approximation.
