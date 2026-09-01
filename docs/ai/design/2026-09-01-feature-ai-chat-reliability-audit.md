---
phase: design
title: AI Chat Reliability Audit
description: Failure model, invariants, architecture boundaries, and executable verification plan
---

# AI Chat Reliability Audit

## Verdict

The durable server model is sound: D1 owns canonical turns and attempts, writes are
explicitly confirmed and idempotent, and failed/pending pairs are excluded from model
history. The recurring defects came from a testing imbalance, not from the absence of
a server state model: most checks exercised pure modules or source boundaries, while
browser transport loss and real Workers D1 semantics were proven manually.

This follow-up keeps the canonical architecture, extracts browser recovery into one
pure module, bounds every recovery probe, and adds two missing executable layers:

1. repository lifecycle tests inside `workerd` with real D1 migrations;
2. Playwright journeys that interrupt transport and exercise Retry/Stop on desktop
   and mobile.

The approach follows Cloudflare's [Workers Vitest integration](https://developers.cloudflare.com/workers/testing/vitest-integration/),
Playwright's [isolated browser contexts](https://playwright.dev/docs/browser-contexts),
[network interception](https://playwright.dev/docs/network), and
[trace-on-first-retry](https://playwright.dev/docs/trace-viewer-intro). Native AI SDK
stream resumption is intentionally not adopted because it is incompatible with an
explicit Stop/abort experience; recovery instead converges on canonical D1 state.

## State Ownership

| Layer | State it owns | State it must not invent |
| --- | --- | --- |
| D1 repository | logical user/assistant rows, immutable attempts, pending lease, proposals, receipts | browser connectivity or presentation status |
| generation service | provider/tool lifecycle for one attempt and safe terminal classification | a second logical turn or silent mutation retry |
| client recovery | transport health, bounded canonical polling, preserved outbound identity/draft | `generation_cancelled` unless the learner pressed Stop |
| React controller | visible composer/status and coordination of send/retry/stop | persistence truth or tool authorization |
| message renderer | sanitized Markdown and selection interaction | raw HTML or mutation commands |

`lib/ai-chat/client-recovery.ts` is the pure client recovery state machine.
`use-ai-chat-turn-controller.ts` coordinates React state and side effects. This keeps
transport policy independently testable without turning the hook into a second
backend state machine.

## Required Invariants

- At most one pending attempt exists per chat.
- A Retry reuses the logical user and assistant identities but creates a new immutable
  attempt; a duplicate request with the same idempotency key never creates another
  logical turn.
- A terminal attempt cannot be overwritten by a late finish, failure, or Stop callback.
- Every confirmed vocabulary change commits exactly once or not at all; provider prose
  never authorizes a write.
- Pending, failed, cancelled, and interrupted pairs never enter provider history.
- Explicit Stop and passive disconnect remain distinct causes and user messages.
- The browser eventually converges to canonical detail or preserves the exact outbound
  identity for a safe Retry.
- No network probe, cancellation request, tool, first provider chunk, or inter-chunk
  wait may hang indefinitely.
- Changing chat or unmounting aborts the old recovery loop and prevents stale state
  from replacing the newly selected chat.
- Markdown rendering never enables raw HTML, and text selection maps rendered text
  rather than raw Markdown offsets.

## Failure Matrix

| Failure | Canonical outcome | Browser outcome | Automated proof |
| --- | --- | --- | --- |
| POST fails before server acceptance | no matching user row | restore original draft or safe outbound Retry | client reconciliation tests |
| stream disconnects after acceptance | pending, complete, or failed in D1 | poll detail without calling Stop | Playwright interrupted-Retry journey |
| canonical detail GET hangs | unchanged | abort that probe and continue with a fresh signal | hung-probe unit test |
| explicit Stop | exact pending attempt becomes `generation_cancelled` | Ready, Retry available, composer usable | desktop/mobile Stop journey |
| provider initial/inter-chunk silence | current attempt fails with a stable timeout code | actionable Retry; later chat remains usable | generation deadline tests |
| tool timeout/failure/budget exhaustion | current attempt fails; no unconfirmed vocabulary write | specific safe error; next message allowed | tool/runtime tests |
| D1 response is ambiguous after commit | exact-ID readback accepts only this operation's result | no duplicate turn or write | repository/receipt tests |
| concurrent different turn | unique pending-attempt invariant rejects one | `turn_in_progress`, no duplicate paid request | real workerd+D1 test |
| Retry reuses the same client ID | existing logical rows, new attempt only when terminal | one visible logical message pair | Node and workerd+D1 tests |
| chat switch/unmount during recovery | no server mutation | old loop aborts, selected chat wins | controller/source contract plus abort tests |

## Verification Pyramid

- Pure Node tests own parsing, state transitions, deadline behavior, error mapping,
  idempotency recovery, D1 statement budgets, and renderer/selection contracts.
- Workers Vitest owns behavior that can differ in `workerd`: real D1 migrations,
  batches, unique indexes, and the one-pending-attempt lifecycle.
- Playwright owns browser-only behavior: fetch interruption, optimistic message state,
  Retry/Stop convergence, composer release, responsive desktop/mobile rendering.
- A final authenticated preview smoke owns provider credentials, Cloudflare routing,
  deployed migrations, and live streaming. It is evidence after automated gates, not
  a replacement for them.

Source-regex tests remain useful architectural tripwires, but they are not counted as
behavioral proof for network recovery or runtime storage semantics.

## Implemented Audit Actions

- [x] Give each canonical recovery read an independent eight-second abort deadline.
- [x] Continue polling after a timed-out/failed read with a fresh signal.
- [x] Preserve parent abort semantics for chat change and unmount.
- [x] Extract recovery policy from general client DTO/render helpers.
- [x] Add real Workers-runtime D1 migration and lifecycle coverage.
- [x] Add isolated desktop/mobile browser journeys for interrupted Retry and Stop.
- [x] Enable screenshots on failure and traces on first browser retry.
- [x] Run Worker and browser journeys in pull-request CI.
- [x] Correct stale documentation that conflated passive interruption with Stop and
  referenced prompt version 5 instead of 7.

## Release and Operations Follow-up

- The PR preview must pass the complete CI matrix before manual provider-backed smoke.
- Preview smoke should cover one ordinary streamed answer, one explicit Stop followed
  by a new message, one failed answer followed by Retry, and one confirmed multi-change
  proposal. No merge is part of this task.
- Existing safe lifecycle logs and D1 attempt/tool ledgers are sufficient for incident
  reconstruction without message content. Production dashboards, alert thresholds,
  retention, spend ownership, and key rotation remain operational configuration work;
  they must not be claimed merely because logging is enabled.
- Production dependencies have no known npm audit finding. Remaining audit findings
  are development-only transitive `image-size` through vinext and legacy esbuild
  through drizzle-kit. npm offers only breaking vinext/drizzle-kit changes, so this
  PR records them rather than using `npm audit fix --force`; React/RSC and Vite were
  safely advanced to their patched compatible releases and reverified.
