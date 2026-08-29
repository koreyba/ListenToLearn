---
phase: deployment
title: AI Vocabulary Practice Chat Deployment
description: Preview rollout state for chat tools, uniqueness, attempts, and receipts
---

# AI Vocabulary Practice Chat Deployment

## Current State

This revision is published on PR #32 and its branch preview. A read-only preview D1
preflight previously found no owner-custom ASCII-`NOCASE` duplicates. Preview has
an older applied 0017 and 0018, and the three 0018 trace tables were read back. The
corrected 0017 has not been validated there, and preview application of 0019 is not
claimed. No production code deploy, production migration, or production secret
change is claimed. The previous live model smoke belongs to the superseded UI-heavy
slice and does not validate current tool execution.

## Configuration

- `OPENROUTER_API_KEY`: Cloudflare Worker secret, never a committed var.
- `OPENROUTER_MODEL`: server-side model/preset configuration.
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

Preview already executed an older 0017 body. Before further preview or production
rollout, explicitly choose and verify either a preview re-baseline or an equivalent
reviewed forward migration. Do not treat the existing preview migration record as
evidence for the corrected 0017. Verify fresh and upgraded D1 paths, foreign keys,
the per-chat pending-attempt index, and the unique receipt key before code rollout.

## Release Gates

- [x] Fresh full repository suite and production build pass 466/466 on the final
  current diff.
- [x] Fresh typecheck, Drizzle check, full lint, lifecycle lint, and docs diff check.
- [x] Final review on the exact release diff found no unresolved code issue.
- [x] Preview D1 duplicate preflight is clean.
- [ ] Corrected 0017 preview re-baseline/forward-path acceptance is complete.
- [ ] Preview migration 0019 is applied and its per-chat index verified.
- [ ] Production model, spend/rate limits, alerts, retention, and rotation owner are
  approved.
- [ ] Authenticated preview smoke covers latest/read/search/write denial,
  add/add-meaning/update, status invariants, interruption/replay, and reload.
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
