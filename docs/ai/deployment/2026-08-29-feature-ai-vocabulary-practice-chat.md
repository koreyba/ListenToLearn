---
phase: deployment
title: AI Vocabulary Practice Chat Deployment
description: Preview rollout state for chat tools, uniqueness, attempts, and receipts
---

# AI Vocabulary Practice Chat Deployment

## Current State

PR #32 and its branch preview currently contain an earlier feature revision; the
backend-hardening diff described here is still local. A read-only preview D1
preflight documented in commit `c970f80` found no owner-custom ASCII-`NOCASE`
duplicates before preview ran 0017. Although that applied 0017 body is older, the
absence of duplicates makes current preview data behaviorally equivalent to the
corrected merge; no preview re-baseline or forward migration is needed. Read-only
evidence now confirms 0019 applied, the one-pending-attempt-per-chat index present,
`PRAGMA foreign_key_check` clean, and 0020 as the only pending migration. Fresh
production will run corrected 0017. No production code deploy, production migration,
or production secret change is claimed. The earlier preview confirmed deterministic
New Chat opening.
The revised concrete-model path has outbound serialization coverage and a live
direct OpenRouter smoke in which DeepSeek selected `list_vocabulary`. That bypassed
the application route, so authenticated tool execution/D1 behavior on the updated
preview remains unproven.

## Configuration

- `OPENROUTER_API_KEY`: Cloudflare Worker secret, never a committed var.
- `OPENROUTER_MODEL`: committed non-secret concrete model ID
  `deepseek/deepseek-v4-flash-0731`. Runtime rejects preset/unlisted IDs, disables
  provider plugins, requires data-collection denial, ZDR, and full request-parameter
  support, and serializes only locally registered AI SDK tools. Preset response
  caching is no longer configured; DeepSeek prompt caching remains automatic and
  requires no application setting.
- Prompt contract: `lib/ai-chat/prompts/vocabulary-practice.ts`, ID
  `unmumble.vocabulary-practice`, version `1`; ID/version are allowlisted operational
  metadata, while prompt text remains private.
- `AI_CHAT_USER_RATE_LIMITER`: 10 authenticated generation requests/minute per
  SHA-256 account key; `AI_CHAT_EDGE_AGGREGATE_RATE_LIMITER`: approximate aggregate
  100/minute per Cloudflare location. Cloudflare counters are location-local and
  eventually consistent, not globally atomic. Missing/error bindings fail closed.
- Local `.dev.vars*` remains ignored. Secrets must not enter browser bundles, D1,
  trace tables, URLs, public errors, or logs.

Missing provider configuration preserves chats and returns `not_configured` before
paid inference.

## Migration Plan

Apply migrations in order after a normal backup/checkpoint:

1. `0016`: chat, targets, messages, and personal meanings.
2. `0017`: choose the earliest per-owner ASCII-`NOCASE` custom phrase as canonical;
   merge historical duplicates and transfer progress, meanings, examples, saved
   video origins, and chat phrase/selected-meaning references before creating the
   unique index. Duplicate meaning collapse preserves non-empty translation/context
   and latest-update metadata. Unicode case variants intentionally remain distinct.
3. `0018`: assistant attempts, tool-call ledger, and mutation receipts.
4. `0019`: repair duplicate pending attempts, fail their orphaned assistant rows,
   and enforce one pending attempt per chat.
5. `0020`: add and backfill configured provider/model provenance for immutable
   assistant attempts.

Preview already executed an older 0017 body, but its pre-deployment zero-duplicate
preflight in `c970f80` proves that the corrected merge had no data to transform. The
current preview is therefore explicitly accepted as behaviorally equivalent; do
not create a re-baseline or forward migration solely for 0017 there. This exception
does not change the fresh-production sequence: production must run the corrected
0017, then 0018–0020 in order. Preview needs only 0020 now. After applying it, verify
foreign keys, the per-chat pending-attempt index, configured-provenance columns/
backfill, and the unique receipt key before code rollout.

## Release Gates

- [x] Fresh exact-diff focused backend tests pass 217/217; full `npm test` passes
  501/501.
- [x] Typecheck, Drizzle, dependency audit, lifecycle/diff/secret/ignore checks pass;
  full lint has zero errors and three existing warnings.
- [x] Independent final review reports no P0/P1.
- [x] Preview D1 zero-duplicate preflight from `c970f80` makes its older 0017
  behaviorally equivalent to corrected 0017; no re-baseline/forward migration is
  required there.
- [x] Preview migration 0019 is applied; the per-chat pending-attempt index exists
  and `PRAGMA foreign_key_check` is clean.
- [ ] Commit/push the backend-hardening diff and rebuild the PR preview.
- [ ] Apply migration 0020, the only pending preview migration, then recheck its
  configured-provenance backfill, pending-chat index, and foreign keys.
- [x] Concrete code-allowlisted DeepSeek model, privacy/local-tool fence, and
  10/account plus approximate 100/location per-minute edge abuse limits are explicit
  in deployment configuration.
- [x] Instrumented generation envelopes are 35/43/45/36/38/41 statements for the
  documented read/write/ambiguity/rollback cases; serialized concurrent legacy
  rollback remains 41, and maximum-size create recovery is the exact 49/50 maximum.
- [x] Direct live OpenRouter smoke confirms DeepSeek can select the locally declared
  `list_vocabulary` schema; this is not application smoke.
- [ ] Spend cap ownership, alerts, retention, and rotation owner are approved.
- [x] Authenticated preview smoke covers deterministic New Chat creation and its
  latest-vocabulary opening without a provider call.
- [ ] Authenticated preview smoke covers provider-backed category pagination and
  cross-turn continuation, search, add/add-meaning/update, literal category change,
  autonomous/ambiguous-write denial, interruption/replay, and reload.
- [ ] Production deployment and remote production migrations receive explicit
  authorization.

## Rollout and Rollback

Deploy through the existing Worker pipeline; Vercel hosting is not required.
Observe attempt/tool/receipt error and spend signals during a limited authenticated
preview before production. Migration application must stop before code upload on
any error, then verify the expected schema/indexes before continuing.

The ordinary auth ensure remains on account API requests, but the heavier atomic
legacy-owner transfer runs only during login/session bootstrap. Include that
bootstrap in preview verification without charging its D1 statements to an AI
generation invocation.

On unsafe ownership, write authorization/CAS, status change, receipt conflict, error
rate, latency, or spend, disable provider configuration and roll back Worker code.
Chats remain readable while generation is disabled. Keep additive migration data;
do not run destructive down migrations. Rotate the key on suspected exposure.
