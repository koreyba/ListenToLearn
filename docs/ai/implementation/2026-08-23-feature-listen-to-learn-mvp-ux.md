---
phase: implementation
title: Implementation Guide
description: Technical implementation notes, patterns, and code guidelines
---

# Implementation Guide

## Development Setup

- Worktree: `feature-listen-to-learn-mvp-ux`; dependencies installed with `npm ci`.
- Normal checks: `npx tsc --noEmit`, `npm run lint`, `node --test tests/rendered-html.test.mjs`, `./node_modules/.bin/vinext build`, and `git diff --check`. In the current root checkout, `npm run lint` also descends into nested `.worktrees/**/dist`; use the same ESLint command with `--ignore-pattern .worktrees` to validate current source until the repository-wide script is narrowed.
- `npm test` is the repository gate. `scripts/build-verified.sh` delegates its build and kill-after bounds to `scripts/run-bounded.mjs`, avoiding the former GNU `timeout` dependency on macOS while preserving bounded builds on Linux.
- Local Worker smoke uses built output with `wrangler dev --local --compatibility-date=2026-05-22`; the installed Miniflare cannot boot the project's `2026-08-23` compatibility date directly.

## Code Structure

- `app/api/phrases/route.ts`: runtime table compatibility, context/translation payload validation, phrase reuse, and optional DeepL behavior.
- `db/schema.ts` and `drizzle/0005_special_ogun.sql`: persistent `phrases.context` schema and migration.
- `app/page.tsx` / `app/globals.css`: global persisted phrase sorting, stable comparator, and context metadata in all four status tabs.
- `public/trainer.html`: audio-first responsive workspace, provider controls, example mode/order state, caption-history seam, translation save action, and existing YouGlish/Tatoeba integration.
- `tests/rendered-html.test.mjs`: static contracts plus inline trainer-script syntax compilation.

## Implementation Notes

### Phrase context and API

- `context TEXT NOT NULL DEFAULT ''` is created for new databases and added idempotently for existing D1 state.
- `POST /api/phrases` accepts bounded `context` and `translation`, reuses case-insensitive records, retains prior context when the new payload has none, and never requires DeepL when a translation is supplied.
- Words, short selections, and phrases continue to use the same `phrases` row and status lifecycle.

### Library sorting

- The single select control is rendered in the shared section header, so it appears for `Pick`, `To Learn`, `Learning Now`, and `Learnt`.
- `added_desc` is the initial/default value. The selected value is persisted under `listen-to-learn-library-sort-v1`.
- Date and alphabetic comparisons use deterministic catalog/id tie-breakers.

### Trainer workspace and examples

- Desktop uses a two-column sticky stage: `.learning-workspace` contains source, navigation, playback, captions, translation, and actions; `.media-panel` keeps provider media separate with a minimum 200px widget frame.
- The workspace uses one flat, non-wrapping icon toolbar at every viewport; semantic control wrappers use `display: contents` so the former group cards and headings do not consume space. At <=760px the stage returns to normal flow and the learning workspace precedes media.
- One stateful `playPauseBtn` derives its icon, tooltip, and accessible name from Tatoeba audio state or the YouGlish player-state callback; activating a paused YouGlish player now calls `play()` instead of always calling `pause()`.
- Caption-navigation guidance is outside the toolbar, example mode/order/save share one row, and redundant media-heading copy is visually removed.
- Primary controls and mobile source/example/media-expand actions retain 44px height. Hidden visual labels remain available through explicit English `aria-label` and `title` values, including both speed controls.
- `exampleMode` and `exampleOrder` are normalized in the existing browser state and saved globally. New state is `all` + `random`.
- Ordered provider items preserve provider/creation order; random items are shuffled once per phrase/provider/order key. Saved examples remain keyed by phrase/provider/external ID and are replayed as concrete video/audio items.
- Caption changes are recorded per current YouGlish video. Caption navigation, its status hint, and repeat-caption control are rendered only for YouGlish; Tatoeba keeps the toolbar compact without caption-only controls. Buttons are enabled only if a concrete caption method is present, and no five-second seek is used as a caption transition.

### Translation and save flow

- A word click and a selection use one visible translation box. On a successful result the adjacent `+ To Learn` calls the shared save path with source text, current caption context, and available translation.
- A missing DeepL service leaves the translation action disabled but does not block phrase/example persistence.

## Integration Points

- Phrase/library UI -> `/api/phrases`.
- Trainer -> `/api/examples`, `/api/tatoeba`, `/api/tatoeba/audio`, and `/api/translate`.
- DeepL credentials remain behind the existing server-side integration helper.
- YouGlish remains an embedded widget; the app uses documented track navigation and caption events, while exact caption seek stays feature-detected because the current public API does not document it.

## Error Handling

- API inputs are normalized and bounded; malformed or missing text returns a 400 response.
- Tatoeba/examples requests use request counters so stale responses do not overwrite a newer phrase/source.
- Empty saved-example lists fall back to `Все` visually without mutating the global preference; provider-empty and translation-unavailable states are explicit and non-blocking.
- Existing console logging remains for provider/API diagnostics; no secrets are logged or added to the client bundle.

## Performance Considerations

- Sorting and provider ordering are client-side over already loaded lists.
- Saved random sequences are cached until the source/order/list key changes.
- Only the visible translation action performs a DeepL request; no translation cache is persisted.

## Security Notes

- No provider or DeepL credentials moved to browser code.
- Context and translation are server-bounded before D1 writes.
- Existing integration-secret encryption/session boundaries and YouGlish attribution/privacy links remain unchanged.

## Known MVP Boundary

The current YouGlish public API documents `previous()`/`next()` track navigation, `move(seconds)`, and caption-change events, but not a stable seek-to-caption method. The implementation therefore keeps caption controls truthfully disabled until a supported exact method exists; it does not claim exact caption navigation is currently available.
