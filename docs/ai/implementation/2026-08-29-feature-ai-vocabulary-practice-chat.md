---
phase: implementation
title: AI Vocabulary Practice Chat Implementation
description: Implemented files, boundaries, resilience, and local proof
---

# AI Vocabulary Practice Chat Implementation

## What Is Implemented

- `db/schema.ts` and `drizzle/0016_secret_the_renegades.sql`: user meanings,
  account chats, current practice targets, and ordered message history.
- `lib/ai-chat/`: validation/limits, prompt construction, D1 repository, canonical
  practice snapshots, AI SDK/OpenRouter runtime, streaming orchestration,
  translation fallback runtime, client contracts, and safe HTTP errors.
- `app/api/ai/`: authenticated chat list/create/detail, atomic target replacement,
  message streaming/retry, meanings, and AI selection translation.
- `app/chat/` and `app/components/ai-practice-chat.tsx`: multiple chats, saved and
  ad-hoc targets, the three meaning modes, selected meaning, streamed messages,
  failure retry, and manual learning actions.
- `app/components/interactive-english-text.tsx`: exact plain-text rendering,
  clickable English words, and bounded same-message phrase selection.
- `app/components/phrase-workspace.tsx`: `Practice with AI` launch from both
  Library and Practice using the chosen `phraseId`.

## Key Contracts

The browser submits only the latest `{ clientMessageId, content }`. The server
loads the owned chat, current saved/ad-hoc targets, personal and legacy meanings,
and complete bounded history from D1. The current target set is always replaced as
one array with `PATCH /api/ai/chats/:id/targets`; no incremental target methods are
implemented.

`all_saved`, `selected`, and `explore` are carried into the prompt explicitly.
Several targets are supported without deciding whether the model must combine them
in one sentence. The user-turn practice snapshot makes retries independent of
later target edits.

Selection translation first calls `/api/translate`. When that service returns
`503`, the UI calls authenticated `/api/ai/translate`, which uses the configured
OpenRouter runtime and returns only a bounded Russian translation.

## Persistence and Failure Handling

The initial D1 batch writes one user row and one pending assistant row. Completion
stores normalized plain text, provider/model names, and token counts. Provider
failure, timeout, request abort, or browser stream cancellation stores only a safe
failure code and leaves the turn retryable. Terminal callbacks and retries are
idempotent. Opening/retrying a chat recovers an abandoned pending row after the
30-second lease; fresh pending rows remain single-flight. Completion/failure uses
the current attempt timestamp as a CAS fence, and retrying an older turn supplies
only its preceding canonical history to the model.

## Limits and Security

Shared limits cover 16,384 request bytes, 12 targets, 240 target characters, 500
translation characters, 12 meanings per target, 1,000 stored meaning/context
characters, 100/160 prompt meaning/context characters, 48,000 aggregate serialized
target characters, 4,000 message characters, 40/32,000 history messages/characters,
800 output tokens, and a 20-second provider timeout.

All AI routes require the application session, owner-scoped D1 queries, exact
origin for mutations, and `no-store`. Assistant text is never inserted as HTML.
Provider credentials remain server-only; `.dev.vars*` is ignored and no key or
model credential is committed.

## Local Proof

- Targeted AI chat and interactive-text suite: 84 passed, 0 failed.
- A bounded real completion was received through OpenRouter preset
  `@preset/free-unmubme-test`.
- The signed-in local flow restored its chat, targets, and messages from local D1
  after reload.
- Saved plus ad-hoc targets, manual add to `To Learn`, status change, and adding a
  meaning were exercised through the UI.
- Full repository tests, lint, and production build pass on the implementation
  diff.

No production deployment, remote D1 migration, secret publication, commit, or push
is recorded by this implementation phase.
