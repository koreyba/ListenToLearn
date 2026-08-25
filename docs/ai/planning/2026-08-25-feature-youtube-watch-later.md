---
phase: planning
title: YouTube Watch Later Implementation Plan
description: Ordered tasks for video persistence, direct playback, resume and verification
---

# YouTube Watch Later Implementation Plan

## Milestones

- [x] M1: Persistence contracts are test-covered for guest, account and browser progress.
- [x] M2: `/videos` provides the saved-video library and direct YouTube playback.
- [x] M3: Trainer actions connect YouGlish discovery to Watch Later without regressing saved clips.
- [x] M4: Full automated verification, implementation reconciliation and code review are complete; preview provider smoke remains a deployment gate.

## Task Breakdown

### Phase 1: Foundation — data and pure helpers

- [x] T1: Add failing guest-library tests for version-2 migration, saved-video validation, deduplication, removal and caps.
  - Outcome: guest behavior is specified before production changes.
  - Dependencies: none.
  - Evidence: targeted `node --test tests/guest-library.test.mjs` fails for the missing behavior, then passes after T2.
  - Covers: guest unit scenarios in the testing doc.
- [x] T2: Extend `lib/guest-library.ts` with bounded `savedVideos` state and helpers.
  - Outcome: guest Watch Later data is independent from phrases/examples and backward-compatible.
  - Dependencies: T1.
  - Evidence: guest-library tests pass.
- [x] T3: Add failing tests and implement `lib/youtube-progress.ts` normalization, read/update/clear helpers.
  - Outcome: resume state is bounded and testable without the YouTube network.
  - Dependencies: none.
  - Evidence: targeted progress tests demonstrate malformed, completion and cap branches.
- [x] T4: Add `savedVideos` schema plus generated D1 migration.
  - Outcome: account-owned video identity and ordering are enforced by the database.
  - Dependencies: design schema.
  - Evidence: rendered/schema contract tests and inspected migration SQL.

### Phase 2: Account API and public route boundary

- [x] T5: Add failing rendered/API contract tests for `/api/videos` validation, ownership and upsert SQL.
  - Outcome: the route contract is executable before implementation.
  - Dependencies: T4.
  - Evidence: targeted rendered tests fail, then pass after T6.
- [x] T6: Implement authenticated `GET`/`POST`/`DELETE /api/videos`.
  - Outcome: account video lists are isolated and duplicate saves refresh context.
  - Dependencies: T4-T5.
  - Evidence: targeted route contracts, TypeScript and lint.
- [x] T7: Expose `/videos` through the guest allowlist while keeping `/api/videos` protected.
  - Outcome: both guest UI and authenticated persistence respect the existing Worker boundary.
  - Dependencies: none.
  - Evidence: `tests/guest-access.test.mjs`.

### Phase 3: Videos view and direct player

- [x] T8: Add failing rendered contracts for empty/list/player/remove states and absence of YouGlish code.
  - Outcome: public view semantics and provider separation are locked before UI implementation.
  - Dependencies: T2-T3, T6-T7.
  - Evidence: targeted rendered test failure, then pass after T9-T10.
- [x] T9: Implement reusable direct YouTube player with native controls/CC, validated IDs and progress lifecycle.
  - Outcome: a selected video plays directly and resumes locally without autoplay or YouGlish.
  - Dependencies: T3, T8.
  - Evidence: helper tests, rendered contracts and manual fake/player seam.
- [x] T10: Implement account-aware/guest-aware `/videos` library view and navigation from the home page.
  - Outcome: list/open/remove/empty flows work with explicit saving and direct links.
  - Dependencies: T2, T6-T9.
  - Evidence: rendered tests, TypeScript, responsive manual inspection.

### Phase 4: Trainer integration

- [x] T11: Add failing trainer contracts for `Save clip`, `Watch later`, and `Watch full video` source behavior.
  - Outcome: the three intents are distinct and Tatoeba remains unchanged.
  - Dependencies: T2, T6, T10.
  - Evidence: targeted rendered test failure, then pass after T12.
- [x] T12: Implement trainer video actions for guest/account modes.
  - Outcome: Watch Later upserts without navigation; Watch Full Video opens `/videos?video=...`; saved clips still replay through YouGlish.
  - Dependencies: T11.
  - Evidence: rendered tests plus manual trainer smoke.

### Phase 5: Verification and reconciliation

- [x] T13: Run targeted tests, `npx tsc --noEmit`, `npm run lint`, full `npm test`, and `git diff --check`.
  - Outcome: fresh evidence covers behavior and regressions.
  - Dependencies: T1-T12.
  - Evidence: exact command outputs and pass/fail counts.
- [x] T14: Update testing checkboxes, implementation notes, plan status, deployment/monitoring evidence and run lifecycle lint.
  - Outcome: docs match implemented scope and remaining manual/provider limits.
  - Dependencies: T13.
  - Evidence: `npx ai-devkit@latest lint --feature youtube-watch-later`.
- [x] T15: Run final design-alignment and code review; fix confirmed blockers and reverify.
  - Outcome: branch is review-ready, not deployed or merged.
  - Dependencies: T14.
  - Evidence: review report and repeated affected checks after fixes.

## Dependencies

- Official YouTube IFrame API at runtime; no API key.
- Existing YouGlish `onVideoChange` event for the source `videoId`.
- Existing auth subject and D1 binding for account persistence.
- Existing guest library/auth-hint conventions.
- No deployment, migration application, push or merge is authorized by this lifecycle request.

## Sequencing Notes

- Use TDD for each new behavior: observe the targeted failure before production code.
- Reconcile this plan after every completed implementation task or cohesive task batch.
- Keep provider-network behavior behind deterministic contracts; only manual smoke exercises real YouTube/YouGlish.
- Do not copy the unrelated dirty mobile-layout changes from the original worktree into this branch.

## Risks & Mitigation

- **Static trainer complexity:** isolate guest video helpers in `lib/guest-library.ts`; keep inline integration small and contract-tested.
- **YouTube script lifecycle:** use one loader promise/global callback and destroy the old player on selection changes.
- **Auth fallback leakage:** mirror current explicit auth hint; never merge guest/account saved videos.
- **D1 ownership:** bind user subject in every query and validate optional origin phrase visibility.
- **Resume churn:** five-second cadence plus lifecycle flushes; no server writes.
- **Provider policy:** visible native player, origin/referrer preserved, no downloads/scraping/overlays.

## Resources Needed

Existing Node/Vinext/Cloudflare toolchain, D1 migration generator, official YouTube IFrame documentation, and current automated test suite. No new package or external credential is required.

## Progress Summary

T1-T15 are complete. The additive `0009` migration, bounded guest/account persistence, `/videos` library, direct IFrame player, local resume and three trainer actions are implemented. Red/green contracts covered guest state, route boundary, API shape, browser history and rendered UI. Final automated verification and review have no blocking findings. Runtime D1/provider and visual smoke remain an explicit preview deployment gate because the local Workers runtime is incompatible with the configured compatibility date.
