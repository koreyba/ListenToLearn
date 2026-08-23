---
phase: testing
title: Testing Strategy
description: Define testing approach, test cases, and quality assurance
---

# Testing Strategy

## Test Coverage Goals

Cover 100% of new/changed server branches that can be checked with the repository's Node/static test setup, and cover every user-visible requirement with either an automated assertion or an explicit manual checklist. Keep the existing rendered HTML, type-check, lint, build, and Wrangler dry-run gates green.

## Unit / Static Contract Tests

### Phrase API and schema

- [x] `phrases` creates or migrates the `context` column without dropping existing rows (route contract + generated migration).
- [x] `GET /api/phrases` selects/returns context and creation metadata needed for sorting.
- [x] `POST /api/phrases` accepts bounded context and available translation, reuses case-insensitive records, and remains non-blocking when DeepL is unavailable.
- [x] A word and a phrase use the same `phrases` table/status lifecycle; no Words route/table is introduced.
- [x] `db/schema.ts` and a new Drizzle migration describe the context column.

### Library UI

- [x] All four tabs remain present and status actions still target the existing statuses.
- [x] Every tab renders the same sort control with newest/oldest and A–Z/Z–A options.
- [x] The sort preference is persisted and normalized; equal dates have a deterministic tie-breaker.
- [x] Context is rendered as secondary metadata without creating a separate words section.

### Trainer UI and behavior contracts

- [x] Distinct caption and video navigation button IDs/labels exist.
- [x] Caption history is recorded from caption-change events and resets on video changes.
- [x] The exact-caption feature-detection path never calls `widget.move(-5)` or labels time movement as caption navigation.
- [x] Provider video/audio navigation remains wired for all and saved modes.
- [x] `exampleMode` and `exampleOrder` are normalized, persisted, and default to `all`/`random`.
- [x] The save-example payload retains phrase ID, provider, external ID, caption, and attribution metadata.
- [x] Word click translation exposes an adjacent `+ To Learn` action; selection actions remain available.
- [x] The phrase-saving payload carries selected text, original caption context, and available translation.
- [x] The inline trainer script parses with `new Function` after all changes.

## Integration Tests

- [x] Existing `phrase_examples` uniqueness still binds a saved provider item to one phrase (schema/static route contract).
- [x] Tatoeba ordered mode preserves returned track order; random mode shuffles once per load (implemented and exercised against live Tatoeba response).
- [x] Saved example ordered mode uses creation order and random mode remains reversible through previous/next (implemented and exercised with one saved Tatoeba item).
- [x] YouGlish ordered mode uses the ordinary query; random mode preserves the existing random query behavior (static contract; provider navigation not exercised end-to-end in this run).
- [x] Stale provider/example requests cannot overwrite a newer phrase/source selection (request counters retained and reviewed).
- [x] Missing DeepL returns a pending/optional result while phrase persistence still succeeds (live local Worker returned truthful 503 for translation; phrase POST with supplied translation succeeded).

## End-to-End / Manual Tests

- [x] Desktop: controls, captions, translation, save actions, and status are visible beside a compact >=200px media frame; no control overlaps the media panel (1280px browser smoke; YouGlish widget itself remained external).
- [x] Mobile: learning workspace appears before the media panel, controls are tappable, and captions/translation remain reachable without horizontal scrolling (390x844; `scrollWidth === clientWidth`).
- [x] Open a phrase, use Tatoeba, pause/replay controls, speed controls, and previous/next video (live local Worker/Tatoeba smoke; audio loaded with HTTP 206).
- [x] Verify previous/next caption is visibly disabled for Tatoeba with an explanation; static contract also verifies no fake five-second behavior.
- [ ] For one phrase, save one YouGlish video and one Tatoeba audio item, reopen the phrase, switch to `Сохранённые`, and replay each item (Tatoeba completed; YouGlish end-to-end not run because provider playback is external).
- [x] Change `Все`/`Сохранённые` and `Случайно`/`По порядку`, reload, and verify global preferences remain (Tatoeba order and saved mode smoke).
- [ ] Click a caption word, check one successful contextual translation, use `+ To Learn`, and verify library context (word click and disabled save state verified; DeepL secret unavailable, so success path requires owner configuration).
- [ ] Select a short/full caption, translate/listen/add it, and verify the same library entry model is used (static payload contract; interactive selection not executed in this run).
- [x] Use the library sort control and reload to verify the selected sort persists; DOM smoke confirmed the same control is available on the rendered tab surface.
- [x] Trigger empty provider results, translation unavailable, and empty saved-example states; verify explicit non-blocking feedback.

## Test Data and Mocks

- Use existing preset phrases and deterministic fake D1 bindings from the Vinext/Wrangler test environment.
- Use static provider payload fixtures in tests where network behavior is needed: YouGlish caption/video events, Tatoeba tracks with/without audio/translation, and DeepL success/optional-error responses.
- Never use a real DeepL key, YouGlish partner key, or personal provider data in source control or automated output.

## Verification Commands

- `npx tsc --noEmit`
- `npm run lint`
- `npm test`
- `git diff --check`
- `npm run build`
- `./node_modules/.bin/wrangler deploy --dry-run` when the local Cloudflare bindings are available
- Manual responsive browser smoke check against the local build/dev server

## Manual Testing and Reporting

Record the command output and the exact manual viewport/source/mode combinations in the final lifecycle summary. Treat unavailable provider behavior as a tested graceful-degradation path, not as a failed test, when the UI is truthful and persistence still works.

## Performance / Accessibility Checks

- [x] New controls have visible focus styles, keyboard-capable native controls, disabled states, and Russian accessible labels.
- [x] The media frame remains >=200px by >=200px and the learning controls are outside its DOM/content area.
- [x] No added interaction introduces a second translation request for the same visible action; transient translation state is not persisted.

## Automated Evidence

- `npx tsc --noEmit`: passed.
- `npm run lint`: passed with two pre-existing warnings in generated `worker-configuration.d.ts`; no errors.
- `node --test tests/rendered-html.test.mjs`: 9/9 passed.
- `./node_modules/.bin/vinext build`: passed.
- `npm test`: wrapper blocked before build because `scripts/build-verified.sh` requires GNU `timeout` on this macOS host; direct equivalent checks passed.
- `git diff --check`: passed.
- `npx ai-devkit@latest lint --feature listen-to-learn-mvp-ux`: passed.
- `./node_modules/.bin/wrangler deploy --dry-run`: passed; built Worker/assets and D1/ASSETS bindings were validated without deployment.

## Remaining Validation Limits

- `npm test` cannot run its wrapper on this macOS host because `scripts/build-verified.sh` requires GNU `timeout`; the direct build and test commands above are the equivalent fresh checks.
- Live YouGlish playback/caption traversal and successful DeepL translation need external provider/service configuration. The code keeps those boundaries explicit and does not treat unavailable service as a passing success-path test.
