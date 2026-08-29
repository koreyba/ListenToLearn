---
phase: deployment
title: AI Vocabulary Practice Chat Deployment
description: Unexecuted rollout plan for chat tools, uniqueness, attempts, and receipts
---

# AI Vocabulary Practice Chat Deployment

## Current State

This revision is local worktree code. A read-only preview D1 preflight found no
owner-custom ASCII-`NOCASE` duplicates, but migrations 0017/0018 remain pending.
No preview/production code deploy, production migration, or secret change is
claimed. The previous live model smoke belongs to the superseded UI-heavy slice and
does not validate current tool execution.

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
   unique index. Unicode case variants intentionally remain distinct.
3. `0018`: assistant attempts, tool-call ledger, and mutation receipts.

The migration-file sequence remains append-only; 0017 intentionally rewrites only
historical duplicate data and its references. Verify fresh and upgraded D1 paths,
foreign keys, partial one-pending-attempt index, and unique receipt key before code
rollout.

## Release Gates

- [x] Full repository suite and production build pass 440/440 locally.
- [x] Typecheck and lifecycle lint pass on the current snapshot.
- [x] Full lint passes with zero errors and two generated-file warnings.
- [ ] Final review passes on the exact release diff.
- [x] Preview D1 duplicate preflight is clean.
- [ ] Preview migrations 0017/0018 and the remote rollout plan are approved and
  executed in order.
- [ ] Production model, spend/rate limits, alerts, retention, and rotation owner are
  approved.
- [ ] Authenticated preview smoke covers latest/read/search/write denial,
  add/add-meaning/update, status invariants, interruption/replay, and reload.
- [ ] Deployment and remote migrations receive explicit authorization.

## Rollout and Rollback

Deploy through the existing Worker pipeline; Vercel hosting is not required.
Observe attempt/tool/receipt error and spend signals during a limited authenticated
preview before production. Migration application must stop before code upload on
any error, then verify the expected schema/indexes before continuing.

On unsafe ownership, write authorization/CAS, status change, receipt conflict, error
rate, latency, or spend, disable provider configuration and roll back Worker code.
Chats remain readable while generation is disabled. Keep additive migration data;
do not run destructive down migrations. Rotate the key on suspected exposure.
