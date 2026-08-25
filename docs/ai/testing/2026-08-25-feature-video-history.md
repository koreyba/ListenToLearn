---
phase: testing
title: Automatic Video History Testing Strategy
description: Contracts and smoke coverage for media CTA placement and deliberate viewing history
---

# Automatic Video History Testing Strategy

## Test Coverage Goals

- Cover every changed UI/storage branch with rendered or unit contracts.
- Re-run the complete Full Video and provider regression suite.
- Validate desktop/mobile alignment manually after automated checks.

## Unit and Rendered Tests

- [x] `Watch full video` is inside `.media-heading` and remains separately addressable.
- [x] `Watch later` markup/state/listeners are absent.
- [x] Clicking Full Video invokes guest/account upsert and then the existing warm transition.
- [x] Persistence failure does not prevent warm transition.
- [x] Ordinary YouGlish result callbacks do not write video history.
- [x] `/videos` renders `Videos`, `Continue watching`, updated empty copy and no bookmark terminology.
- [x] Existing deduplication, bounded storage, API ownership and resume tests remain green.

## Integration Tests

- [x] Guest Full Video entry uses the existing deduplicating local upsert.
- [x] Account Full Video entry uses the existing subject-scoped POST.
- [x] Continue opens the shared trainer with saved resume metadata; Remove deletes only the history record.

## End-to-End / Manual Tests

- [x] Desktop: filters remain one aligned row while the media CTA sits beside Expand.
- [x] Mobile: CTA remains accessible without overflowing the media panel.
- [x] Enter Full Video, return to `/videos`, and continue from the generated card.
- [x] Tatoeba and ordinary YouGlish clip flows do not show or record the Full Video CTA/history.

## Test Data

- Reuse canonical YouTube ID `w66ecIT-Xkk`, original query and caption fixtures.
- Exercise guest and authenticated branches; no live transcript fixture.

## Verification Commands

- `node --test tests/rendered-html.test.mjs`
- `npm test`
- `npm run lint`
- `npx tsc --noEmit`
- `git diff --check`
- `npx ai-devkit@latest lint --feature video-history`

## Bug Tracking

- Any lost Full Video transition, duplicate history record, account-scope regression or responsive overflow blocks release.

## Verification Record — 2026-08-25

- `npm test`: 54 passed, 0 failed; includes a successful production build.
- `npm run lint`: 0 errors; 2 pre-existing warnings in generated `worker-configuration.d.ts`.
- `npx tsc --noEmit`, lifecycle feature lint and `git diff --check`: passed.
- Local desktop smoke at 1440×900: filters and Save clip share one row; Full Video is left of Expand.
- Local mobile smoke at 390×844: no horizontal overflow; CTA buttons are 44×44; when Full Video is hidden, Expand remains right-aligned.
- Cloudflare branch preview: deliberate Full Video entry created exactly one `Continue watching` card; `Continue` reopened Full Video Mode with the stored origin/caption metadata.
- The removal path remains covered by existing guest/API contracts; destructive UI removal was not repeated during preview smoke.
