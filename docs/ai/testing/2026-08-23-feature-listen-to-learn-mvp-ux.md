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
- [x] Desktop and mobile controls use one flat, non-wrapping toolbar and keep the caption explanation below it; former group wrappers add no visible boxes or headings.
- [x] Play/pause is one stateful button: paused Tatoeba and YouGlish playback renders Play and activation resumes playback; playing state renders Pause and activation pauses playback.
- [x] Caption controls, caption status, and repeat-caption are hidden for Tatoeba and restored for YouGlish; the Tatoeba toolbar reflows without an empty caption column.
- [x] Icon-only example settings expose explicit accessible names and mobile touch targets remain at least 44px.
- [x] The inline trainer script parses with `new Function` after all changes.

## Integration Tests

- [x] Existing `phrase_examples` uniqueness still binds a saved provider item to one phrase (schema/static route contract).
- [x] Tatoeba ordered mode preserves returned track order; random mode shuffles once per load (implemented and exercised against live Tatoeba response).
- [x] Saved example ordered mode uses creation order and random mode remains reversible through previous/next (implemented and exercised with one saved Tatoeba item).
- [x] YouGlish ordered mode uses the ordinary query; random mode preserves the existing random query behavior (static contract; provider navigation not exercised end-to-end in this run).
- [x] Stale provider/example requests cannot overwrite a newer phrase/source selection (request counters retained and reviewed).
- [x] Missing DeepL returns a pending/optional result while phrase persistence still succeeds (live local Worker returned truthful 503 for translation; phrase POST with supplied translation succeeded).

## End-to-End / Manual Tests

- [x] Desktop: controls, captions, translation, save actions, and status are visible beside a compact >=200px media frame; no control overlaps the media panel. Fresh 1280x900 browser smoke rendered all nine YouGlish controls in one 56px-high row with zero toolbar/document horizontal overflow.
- [x] Mobile: learning workspace appears before the media panel, controls are tappable, and captions/translation remain reachable without horizontal scrolling. Fresh 390x844 browser smoke rendered all nine YouGlish controls in one 54px-high row; toolbar and document overflow were both zero, every visible control retained 44px height, and all had non-empty `title` and `aria-label` values.
- [x] Open a phrase, use Tatoeba, pause/replay controls, speed controls, and previous/next video (live local Worker/Tatoeba smoke; audio loaded with HTTP 206).
- [x] Verify caption controls are hidden for Tatoeba and restored for YouGlish; static contract also verifies no fake five-second behavior.
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

- [x] New controls have visible focus styles, keyboard-capable native controls, disabled states, and explicit English accessible labels.
- [x] The media frame remains >=200px by >=200px and the learning controls are outside its DOM/content area.
- [x] No added interaction introduces a second translation request for the same visible action; transient translation state is not persisted.

## Automated Evidence

- `npx tsc --noEmit`: passed.
- `npm run lint`: the repository wrapper scanned nested `.worktrees/**/dist` and failed on 35 generated-file errors unrelated to this checkout. The equivalent current-checkout command with `--ignore-pattern .worktrees` passed with zero errors and two pre-existing warnings in `worker-configuration.d.ts`.
- `node --test tests/rendered-html.test.mjs`: 24/24 passed, including compact-toolbar, tooltip/accessibility, and stateful play/pause regression contracts. Removing the YouGlish `play()` branch made the focused regression fail; restoring it returned the test to green.
- Browser smoke (1280x900 and 390x844): all nine YouGlish controls stayed on one row with zero horizontal overflow. Live clicks changed `Play playback`/play icon to `Pause playback`/pause icon and back again through the YouGlish state callback.
- `./node_modules/.bin/vinext build`: passed.
- `npm test`: passed on macOS after `scripts/build-verified.sh` moved to the portable Node timeout runner; 25/25 tests passed, including the runner regression.
- `git diff --check`: passed.
- `npx ai-devkit@latest lint --feature listen-to-learn-mvp-ux`: passed.
- `./node_modules/.bin/wrangler deploy --dry-run`: passed; built Worker/assets and D1/ASSETS bindings were validated without deployment.

## Remaining Validation Limits

- Live YouGlish playback/caption traversal and successful DeepL translation still need external provider/service configuration. Build/test execution no longer has a macOS-specific timeout limitation.
- The code keeps external provider boundaries explicit and does not treat unavailable service as a passing success-path test.
