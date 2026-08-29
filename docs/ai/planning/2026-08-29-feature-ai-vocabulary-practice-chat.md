---
phase: planning
title: AI Vocabulary Practice Chat Plan
description: Status of the implemented account-first OpenRouter vertical slice
---

# AI Vocabulary Practice Chat Plan

## Current Status

The account-first vertical slice is implemented and exercised locally with the
configured OpenRouter preset. Targeted and full tests, lint, production build, and
lifecycle structure pass. Final review is complete; deployment remains pending and
no secret or deployment change is part of the current diff.

## Delivered

- [x] **P01 · Contracts and bounds** — exact-origin bounded JSON, stable errors,
  saved/ad-hoc targets, three meaning modes, and the 48,000-character aggregate
  target-prompt ceiling.
- [x] **P02 · D1 persistence** — append-only migration 0016 for user meanings,
  chats, current targets, ordered/idempotent messages, snapshots, and indexes.
- [x] **P03 · Repository and APIs** — owner-scoped create/list/open, atomic
  `PATCH` replacement of the full target set, meanings, canonical history,
  idempotent completion/failure/retry, and 30-second stale-pending recovery.
- [x] **P04 · AI boundary** — learner-led prompt, multiple targets, three meaning
  scopes, Vercel AI SDK streaming, server-selected OpenRouter model/preset,
  cancellation/abort handling, timeout, and safe provenance/usage persistence.
- [x] **P05 · Focused UI** — multiple chats; saved and ad-hoc targets; mode and
  selected-meaning controls; streaming composer and retry; Library/Practice
  `Practice with AI` launch.
- [x] **P06 · Interactive vocabulary loop** — word click and same-message phrase
  selection; `/api/translate` with `/api/ai/translate` fallback; explicit add to
  `To Learn`, add meaning, and manual status changes.
- [x] **P07 · Local vertical-slice smoke** — a real response from
  `@preset/free-unmubme-test`, local D1 message persistence/reload, saved plus
  ad-hoc practice, and manual add/status/meaning actions.
- [x] **P08 · Targeted verification** — feature unit/contract/integration suite
  passes (84 tests); lifecycle lint passes.
- [x] **P09 · Repository gates** — full tests, full lint, and production build pass
  on the implementation diff.

## Remaining Gates

- [x] **P10 · Final review** — security, privacy, accessibility, responsive UI,
  design alignment, and intended-diff review.
- [ ] **P11 · Release decision** — choose production provider configuration and
  cost/abuse monitoring, approve migration/deployment, then run production smoke.

## Risks Kept Explicit

- Connected streams are not resumable; cancellation becomes an explicit retryable
  failure.
- Guest AI remains closed until a cost and abuse policy exists.
- The current controls prove multi-target/meaning capability but are not a final UX
  decision.
- No deployment, remote migration, commit, push, or secret provisioning has been
  performed by this lifecycle slice.
