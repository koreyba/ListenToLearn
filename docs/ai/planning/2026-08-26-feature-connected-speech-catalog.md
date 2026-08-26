---
phase: planning
title: Connected speech catalog implementation plan
description: Ordered tasks for typed content, D1 projection, optional analysis, Library UX, and compatibility verification
---

# Connected Speech Catalog Implementation Plan

## Milestones

- [x] Milestone 1: Typed catalog and integrity contract are complete.
- [x] Milestone 2: Optional D1 analysis and migration-safe APIs are complete.
- [x] Milestone 3: Dedicated Library and custom/legacy Practice UX are complete.
- [x] Milestone 4: Compatibility, responsive UX, and full verification are complete.

## Task Breakdown

### Phase 1: Typed catalog foundation

- [x] **Task 1.1 — Add RED catalog integrity tests.**
  - Outcome: focused tests encode the 140/18/22/100 counts, semantic mechanisms, unique IDs, ranks, balanced patterns, duplicate-text identity, and absence of a JSON runtime source.
  - Dependencies: approved requirements/design/testing docs.
  - Validation: focused Node test fails because the typed module does not exist, then becomes the contract for Tasks 1.2–1.3.
  - Testing links: Typed catalog integrity scenarios.
- [x] **Task 1.2 — Translate the supplied data into typed TypeScript.**
  - Outcome: `lib/catalog/connected-speech-catalog.ts` contains mechanism/format metadata, 140 cards, semantic mechanism slugs, and provider query fields; no catalog JSON is committed.
  - Dependencies: Task 1.1.
  - Validation: type-check and catalog count/content tests.
  - Testing links: all typed catalog integrity scenarios.
- [x] **Task 1.3 — Stabilize active and legacy IDs.**
  - Outcome: 36 exact overlaps reuse `preset-*` IDs, new cards have explicit stable IDs, and 14 unmatched old presets are represented only in a legacy compatibility map.
  - Dependencies: Task 1.2 and verified overlap report.
  - Validation: mapping tests prove exact counts, no ID collision, and independent duplicate-text cards.
  - Testing links: reused-ID, legacy, and duplicate-text scenarios.

### Phase 2: D1 projection and API contracts

- [x] **Task 2.1 — Add RED optional-analysis and migration tests.**
  - Outcome: tests require separate analysis/mechanism tables, catalog/custom/legacy response variants, idempotent catalog projection, and preserved references.
  - Dependencies: Milestone 1.
  - Validation: focused tests fail against the current flat schema/API.
  - Testing links: migration generator, phrase mapping, and D1 integration scenarios.
- [x] **Task 2.2 — Add optional catalog-analysis schema.**
  - Outcome: Drizzle schema defines `catalog_phrase_analysis` and `phrase_mechanisms` while existing phrase/progress/example/video keys remain compatible.
  - Dependencies: Task 2.1.
  - Validation: generated schema snapshot/migration lint and local clean-D1 application.
  - Testing links: clean migration and zero-analysis custom phrase scenarios.
- [x] **Task 2.3 — Generate the append-only catalog migration.**
  - Outcome: deterministic generator projects the TypeScript catalog into idempotent SQL; 36 existing IDs are enriched, new IDs inserted, and no row/progress/reference deleted.
  - Dependencies: Tasks 1.3 and 2.2.
  - Validation: byte-stable generation, clean/legacy fixture migration tests, SQL escaping tests, and migration reapplication.
  - Testing links: all migration generator and compatibility scenarios.
- [x] **Task 2.4 — Add the public catalog and optional-analysis API mapping.**
  - Outcome: `/api/catalog` returns active catalog/taxonomy without account data; `/api/phrases` returns non-null analysis for active catalog and null for custom/legacy records.
  - Dependencies: Task 2.3.
  - Validation: API contract tests for public read-only access, ordered mechanisms, custom text-only creation, and duplicate-text ID mutation.
  - Testing links: API integration scenarios.
- [x] **Task 2.5 — Preserve guest/account compatibility.**
  - Outcome: guest state merges public catalog status by stable ID and retains unmatched non-pick legacy phrases; account state keeps progress/examples/video origins.
  - Dependencies: Tasks 1.3 and 2.4.
  - Validation: legacy localStorage and D1 fixture tests.
  - Testing links: guest migration and legacy Practice scenarios.

### Phase 3: Library and Practice UX

- [x] **Task 3.1 — Add RED route and catalog interaction tests.**
  - Outcome: rendered/browser contracts require `/library`, home redirect, visible mechanism selection, format tabs, search/order, unique result rendering, and catalog add behavior.
  - Dependencies: Milestone 2.
  - Validation: focused UI tests fail against the current `/` flat Library.
  - Testing links: all Library end-to-end scenarios.
- [x] **Task 3.2 — Build the dedicated catalog Library.**
  - Outcome: `/library` renders a compact responsive catalog with six mechanism choices, three formats, search/recommended order, analyzed cards, and Add/Undo feedback.
  - Dependencies: Task 3.1 and `/api/catalog`.
  - Validation: rendered tests plus 390px/1200px browser smoke.
  - Testing links: Library format/filter/search/add/manual scenarios.
- [x] **Task 3.3 — Preserve custom phrase creation and Practice rendering.**
  - Outcome: the add form remains available, text-only custom phrases go to To Learn with `analysis: null`, and Practice hides analysis-only UI for custom/legacy entries while retaining trainer entry.
  - Dependencies: Tasks 2.4–2.5 and 3.2.
  - Validation: guest/account custom E2E, no-placeholder assertions, and lifecycle regression tests.
  - Testing links: custom phrase and Practice scenarios.
- [x] **Task 3.4 — Update navigation and public routing.**
  - Outcome: global/static navigation points Library to `/library`, `/` temporarily redirects, and Worker guest/cache routing exposes `/library` plus read-only catalog without widening mutation access.
  - Dependencies: Task 3.2.
  - Validation: guest-access, rendered navigation, redirect, and API-method boundary tests.
  - Testing links: route and security integration/E2E scenarios.

### Phase 4: Verification and handoff

- [x] **Task 4.1 — Run focused and repository-wide automation.**
  - Outcome: catalog/migration/API/UI tests, full Node suite, type-check, lint, diff check, build, and AI DevKit feature lint pass with recorded evidence.
  - Dependencies: Milestones 1–3.
  - Validation: fresh command output recorded in testing/implementation docs.
  - Testing links: Test Reporting & Coverage.
- [x] **Task 4.2 — Perform responsive/accessibility and migration smoke.**
  - Outcome: 390px and 1200px Library/Practice flows, keyboard labels/focus, empty/error states, guest/account data paths, and clean/legacy D1 migrations are manually verified.
  - Dependencies: Task 4.1.
  - Validation: screenshots/observations and local migration query evidence recorded without secrets.
  - Testing links: Manual and Performance Testing.
- [x] **Task 4.3 — Reconcile lifecycle documentation.**
  - Outcome: implementation/testing/planning docs reflect completed work, actual evidence, deferred deployment, and any residual risks.
  - Dependencies: Tasks 4.1–4.2.
  - Validation: `lint --feature connected-speech-catalog` and `git diff --check`.

## Dependencies

- Catalog integrity and stable-ID mapping precede schema/data migration.
- Optional analysis schema precedes API and UI consumption.
- Public catalog/API and compatibility behavior precede Library implementation.
- Focused RED tests precede each production slice.
- D1 migration must be applied before application code is deployed to either preview or production.
- No external provider or paid service is required.

## Risks & Mitigation

- **Progress/reference loss:** reuse 36 existing IDs, retain 14 unmatched rows, forbid deletes, and test legacy fixtures with progress/examples/video origins.
- **Catalog drift:** maintain one typed source and deterministic generated SQL; test counts and generation output.
- **Custom phrases accidentally require analysis:** use a separate optional analysis table and discriminated API response; test text-only creation in both modes.
- **Duplicate text mutates the wrong card:** mutate by stable ID and cover `a couple of` as two independent records.
- **Guest routing widens write access:** expose only GET catalog/page paths and keep mutations behind existing account/local boundaries.
- **Mobile taxonomy becomes cluttered:** verify compact selectors/cards at 390px and keep formal names paired with short explanations.
- **Current branch/deployment drift:** work from the isolated feature branch; recheck target D1 migration state before any authorized deploy.

## Sequencing Notes

- Implementation proceeds in the task order above. Each completed production task triggers planning reconciliation.
- Push and PR publication are authorized for this lifecycle run. Merge, deployment, and production data mutation remain out of scope.
- The future home-page design remains a separate feature; this feature provides only a temporary redirect.

## Progress Summary

All four milestones are complete. The typed 140-card catalog generates migration `0013_kind_trauma.sql`, projects through public/account APIs with optional analysis, and powers the dedicated responsive `/library` experience. Guest status migration, custom text-only phrases, retained legacy references, Add/Undo, routing, and account API behavior have fresh automated and local D1/browser evidence. Final review found and fixed migration-section rewrite accumulation, missing generator-time runtime validation, and unnecessary timestamp churn on reused presets; each is covered by a regression test or upgrade fixture. Next: final review, commit, push, and PR checks.

## Resources Needed

- Existing React/Vinext, Drizzle/D1, Worker routing, guest localStorage, and Node test infrastructure.
- The supplied `/Users/denys.koreiba/Downloads/phrases.json` as a one-time translation reference only.
- Existing preset catalog and schema/migrations as compatibility evidence.
