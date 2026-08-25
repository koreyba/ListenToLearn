---
phase: planning
title: Automatic Video History Plan
description: TDD tasks for CTA alignment, automatic history and Continue watching copy
---

# Automatic Video History Plan

## Milestones

- [x] Contract tests fail for the approved UI and history semantics.
- [x] Trainer and `/videos` implement the approved flow.
- [x] Full regression, responsive smoke and lifecycle review pass.

## Task Breakdown

### Phase 1: Contracts

- [x] Add rendered tests that require `Continue in video` beside `Save clip`,
  reject `Watch later`, and reject redundant Expand/Collapse state.
- [x] Add rendered tests for automatic guest/account upsert before the warm transition.
- [x] Add page-copy tests for `Videos` and `Continue watching`.

### Phase 2: Implementation

- [x] Move the CTA into `.example-actions`, rename the source/CTA, remove
  Expand/Collapse, and update responsive styling.
- [x] Consolidate the existing save and warm-transition flow into one non-blocking history action.
- [x] Remove `Watch later` state/listeners and update `/videos` terminology.

### Phase 3: Verification

- [x] Run targeted tests, full suite/build, lint, TypeScript and diff checks.
- [x] Inspect desktop/mobile layout and interaction in the browser preview.
- [x] Review implementation against requirements/design and publish a PR.

## Dependencies

- Existing Full Video Mode, guest video helpers, `/api/videos` and browser-local progress.
- YouGlish remains the provider; no new provider capability is required.

## Risks & Mitigation

- Persistence latency blocks navigation: start the write but never require it to succeed before entering warm mode.
- Failed writes become invisible: show the existing non-blocking example message.
- CTA crowds the narrow action row: remove the mobile toolbar card, use one
  equal-column 2×2 grid, and hide Continue until it is actionable.
- Existing saved records disappear after renaming: reuse the same schema/storage keys.

## Resources Needed

- Existing Node rendered-contract suite and local browser smoke.
- Cloudflare branch preview for final responsive validation.
