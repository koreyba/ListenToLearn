---
phase: deployment
title: AI Vocabulary Practice Chat Deployment
description: Release gates, configuration, migration, and rollback for the implemented slice
---

# AI Vocabulary Practice Chat Deployment

## Current State

The feature has been exercised only in the isolated local worktree with local D1
and a bounded OpenRouter preset. It has not been deployed, no remote migration has
been applied, and no provider secret has been committed or published by this work.

## Configuration

- `OPENROUTER_API_KEY`: server-side Cloudflare Worker secret.
- `OPENROUTER_MODEL`: server-side non-secret model or preset identifier.
- Local development may use ignored `.dev.vars`; deployed credentials must use the
  existing Worker secret mechanism. Neither value may enter browser bundles, D1,
  logs, URLs, or committed files.

Missing configuration intentionally leaves saved chat history available while
generation returns `not_configured`.

## Release Gates

- [x] Targeted and full repository tests pass locally.
- [x] Full lint and production build pass.
- [x] Real local OpenRouter preset smoke and local D1 reload were completed.
- [x] Final security/privacy/regression review is complete.
- [ ] Production model/preset, spend monitoring, and rotation owner are approved.
- [ ] Deployment and remote migration are explicitly authorized.

## Release Sequence

1. Take the normal D1 backup/checkpoint and apply append-only migration 0016 before
   serving code that reads the new tables.
2. Provision `OPENROUTER_API_KEY` as a Worker secret and
   `OPENROUTER_MODEL` as server configuration.
3. Deploy through the existing Worker pipeline; Vercel hosting is not required.
4. Run an authenticated smoke: create/open chat, saved plus ad-hoc targets, one
   bounded response, reload, translation fallback, and explicit vocabulary actions.
5. Confirm safe error/latency/token telemetry without content or credentials.

## Rollback

On unsafe auth isolation, migration, errors, latency, or spend, disable generation
configuration and roll back the Worker code. History remains readable when AI is
unconfigured. Migration 0016 is additive: retain its tables/data rather than run a
destructive down migration. Rotate the provider key if exposure is suspected.
