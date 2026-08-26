---
phase: testing
title: Connected speech catalog testing
description: Catalog integrity, optional analysis, migration compatibility, API, and responsive UX coverage
---

# Connected Speech Catalog Testing

## Test Coverage Goals

- Cover every new catalog validator/generator branch and all optional-analysis response branches.
- Exercise public catalog, authenticated progress, guest storage, and custom phrase critical paths.
- Prove migration compatibility for reused and retired preset IDs without relying on production data.
- Preserve the full existing repository suite and add focused responsive browser smoke evidence.

## Unit Tests

### Typed catalog integrity

- [x] Assert exactly 140 active cards: 18 `atom`, 22 `lexicon`, and 100 `stack`.
- [x] Assert unique stable IDs and expected reuse mapping for all 36 overlapping presets.
- [x] Assert each format has a unique contiguous rank sequence starting at 1.
- [x] Assert every active card has non-empty text, pattern, IPA, and at least one allowed semantic mechanism.
- [x] Assert atom cards contain exactly one mechanism and three examples exist for each mechanism.
- [x] Assert bracket groups are balanced and contain non-empty text.
- [x] Assert duplicate display text is allowed only through distinct IDs and remains separately addressable.
- [x] Assert `alternateQuery` is optional and provider query falls back to card text.
- [x] Assert no runtime/committed source references the Downloads JSON path or a catalog `.json` file.

### Migration generator

- [x] Assert SQL output is deterministic for identical input.
- [x] Assert quotes and IPA characters are escaped/preserved correctly.
- [x] Assert repeated application semantics cannot duplicate analysis or mechanism joins.
- [x] Assert malformed kinds, mechanisms, ranks, mappings, or empty analyzed fields fail generation.

### Phrase mapping

- [x] Assert catalog rows map to non-null analysis with ordered mechanism metadata.
- [x] Assert custom rows map to `analysis: null` without placeholder pattern/IPA.
- [x] Assert legacy rows map to `analysis: null` and remain valid Practice entries.
- [x] Assert custom provider lookup uses phrase text when no analyzed search query exists.

## Integration Tests

- [x] Apply all migrations to a clean local D1 database and verify analysis/mechanism schema and 140 active rows.
- [x] Apply the new migration to a fixture containing the 50 existing presets, progress, examples, and video origins; verify all references and statuses remain valid.
- [x] Verify the 36 overlapping presets retain their `preset-*` identity and acquire analysis.
- [x] Verify the 14 unmatched presets are absent from active Library results but remain queryable for existing non-pick progress/reference scenarios.
- [x] Verify `GET /api/catalog` is public/read-only, returns taxonomy plus active cards, and contains no account state.
- [x] Verify authenticated phrase results join analysis for catalog records and return null analysis for custom/legacy records.
- [x] Verify custom `POST /api/phrases` succeeds with text only and rejects attempts to inject catalog metadata.
- [x] Verify catalog status mutations use ID so both `a couple of` cards remain independent.
- [x] Verify guest access permits `/library` and read-only catalog retrieval without permitting account mutations.
- [x] Verify request handlers contain no schema creation or catalog seeding.

## End-to-End Tests

- [x] Open `/library`, choose each practice format, and see its correct count/order.
- [x] Select each connected-speech mechanism and verify matching cards appear once with all their mechanism badges.
- [x] Search for `a couple of` within its selected format and keep the two same-text catalog identities independently addressable.
- [x] Add a catalog card to To Learn, confirm it leaves available Library results, and Undo restores it.
- [x] Add a custom phrase with text only and confirm the API/UI boundary treats it as `Your phrase` with no analysis UI.
- [x] Exercise catalog/custom behavior through guest state and authenticated API paths.
- [x] Load guest storage containing reused and unmatched legacy preset statuses and confirm Practice preserves them.
- [x] Verify `/` redirects to `/library` while navigation Library links directly to `/library`.
- [x] Regress Practice tabs, Learn/Remove transitions, trainer phrase parameters, saved examples, and videos.

## Test Data

- The production catalog module is tested directly; do not create a parallel JSON fixture.
- Use small invalid TypeScript/object fixtures for validator failures.
- Build a local legacy D1 fixture with representative reused/retired presets, progress, examples, and video origins.
- Use isolated localStorage keys/state objects for guest migration scenarios.
- No real provider secrets, production D1 data, or external-provider writes are required.

## Test Reporting & Coverage

- Run focused catalog and migration tests first, followed by `node --test tests/*.test.mjs`.
- Run `npx tsc --noEmit`, scoped ESLint, `git diff --check`, and `npm run build`.
- Run AI DevKit feature lint for `connected-speech-catalog`.
- Record command counts/results and any intentionally untested provider behavior in this document during implementation.

### Current evidence

- Focused migration generator suite: 4 passed, including repeated rewrite idempotence.
- Final full `node --test tests/*.test.mjs`: 212 passed, 0 failed.
- `npx tsc --noEmit`: exit 0 after making the direct `.ts` Node-test import contract explicit in `tsconfig.json`.
- `npm run build`: exit 0; build lists `/library` and `/api/catalog`.
- Clean local D1: 140 active analyses, 230 mechanism links, 154 total phrase rows; second migration apply reported no pending migration.
- Legacy D1 upgrade: progress `learning_now`, one example reference, one retired-preset video reference, and reused `updated_at=2000-01-01T00:00:00Z` survived; reused analysis=1, retired analysis=0, and foreign-key violations=0.
- Live public API: HTTP 200, public cache header, 35,041 bytes, 140 cards, 3 formats, 6 mechanisms. `/` returned 307 to `/library`.
- Live authenticated API: 154 phrases (140 analyzed, 14 legacy), text-only custom POST returned 201 with `analysis: null`, metadata injection returned 400.
- Browser smoke at 1200px/390px: format counts 18/22/100, each atom mechanism count 3, Add/Undo passed, document width did not exceed viewport content width, mobile cards kept IPA/badges/actions readable, and browser console warnings/errors were empty.
- Running the migration generator twice produced the same SHA-256 (`e6756a65…`); the rewrite boundary is covered by a regression test.
- Runtime source search for the supplied JSON path/name returned no product-code matches; no catalog JSON is part of the diff.
- Sonar configuration coverage verifies that only `drizzle/0013_kind_trauma.sql` and `lib/catalog/connected-speech-catalog.ts` are excluded from copy-paste metrics; neither file is excluded from issue/security analysis.

## Manual Testing

- [x] At 1200px, verify the six mechanism choices, three formats, filters, search, cards, and add form are visible and scannable without an oversized hero.
- [x] At 390px, verify one-column cards, horizontally usable controls, no clipped IPA/tags, and accessible bottom navigation.
- [x] Verify visible focus styling, tab/pressed semantics, text labels beyond color, and status announcements for Added/Undo/errors.
- [x] Verify a custom card never displays fake IPA, sound grouping, or mechanism metadata.
- [x] Verify empty/no-match/loading/error states and Library-to-Practice transition through browser/source regression coverage.

## Performance Testing

- [x] Confirm the catalog loads in one bounded response with no per-card network requests.
- [x] Record catalog response size and ensure filtering/searching remains responsive for all 140 cards on mobile.
- [x] Confirm schema/query paths use the active-kind-rank and mechanism-phrase indexes for catalog/account reads.

## Bug Tracking

Any regression that loses or misattributes progress/examples/video origins is release-blocking. Catalog count/taxonomy errors, inability to add custom phrases, public mutation exposure, and unusable mobile navigation are also release-blocking. Cosmetic card differences that preserve meaning and interaction can be tracked as follow-up issues.
