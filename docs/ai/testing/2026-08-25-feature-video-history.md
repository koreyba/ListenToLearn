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

- [x] `Phrase example` names the provider chooser and `Continue in video` is
  inside `.example-actions` immediately after `Save clip`.
- [x] Continue is hidden until a valid YouTube video ID exists.
- [x] Tatoeba collapses the action row to one full-width `Save clip` cell.
- [x] A saved example changes its action label to `Remove clip`/`Remove track`.
- [x] The example toolbar is one visual panel with only `All`/`Saved` and the
  two actions; Random/In order controls and their setter/listener are absent.
- [x] Expand/Collapse markup, state, CSS, and listeners are absent.
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

- [x] Desktop: the all/saved filter and actions remain one aligned panel while the CTA sits beside `Save clip`.
- [x] Mobile: `Save clip` and `Continue in video` are labelled horizontal
  actions aligned under `All`/`Saved` in the same equal-width 2×2 grid, with
  >=44px height and no nested toolbar card. The shared player toolbar has no
  horizontal overflow and speed labels remain legible.
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

- `npm test`: build completed and `128/128` configured tests passed.
- `node --test tests/*.test.mjs`: `142/142` repository tests passed.
- `npx tsc --noEmit`, scoped ESLint, lifecycle feature lint and `git diff --check`: passed.
- Local responsive smoke: `Phrase example`, `All`/`Saved`, `Save clip`, and
  `Continue in video` remain in the learning workspace; Random/In order and
  Expand/Collapse controls are absent. Mobile removes the nested example card,
  aligns filters/actions to one equal-column 2×2 grid, and hides Continue while
  no valid video exists. Actions retain 44px targets, the lower toolbar does not
  overflow, and speed labels remain legible.
- Cloudflare branch preview: deliberate Full Video entry created exactly one `Continue watching` card; `Continue` reopened Full Video Mode with the stored origin/caption metadata.
- The removal path remains covered by existing guest/API contracts; destructive UI removal was not repeated during preview smoke.
