---
phase: monitoring
title: AI Vocabulary Practice Chat Monitoring
description: Safe operational signals and incident handling for a future deployment
---

# AI Vocabulary Practice Chat Monitoring

## Current State

No production deployment or feature-specific dashboard/alert is claimed. Before a
release, monitoring must cover the paid provider boundary and D1 turn lifecycle
without collecting learning content or credentials.

## Required Signals

- Generation requests, completions, retries, cancellations, and recovered stale
  pending turns.
- End-to-end/provider latency and counts by success or stable error code:
  `not_configured`, `provider_timeout`, `provider_failed`, `empty_response`,
  validation, auth, not-found, and conflict.
- Aggregated input/output/total tokens and estimated spend per environment.
- D1 write failures, pending rows older than the 30-second lease, chat reload
  failures, and translation fallback success/failure.
- Product counts for chats, active targets, and explicit add/status/meaning actions
  only if analytics consent and retention policy permit them.

## Privacy Boundary

Logs may contain a correlation id, environment, normalized provider/model or
preset, latency, token counts, HTTP status, and stable error code. They must not
contain the API key, session data, prompt/system text, targets, messages,
translations, meanings, upstream bodies, or raw provider metadata.

## Alerts and Triage

Thresholds require a production baseline and spend budget before release. At
minimum, notify on sustained authentication or D1 failures, a material provider
failure/timeout spike, pending rows surviving recovery, or spend approaching its
configured cap.

Triage in order: verify session and D1 health; group failures by stable code; check
provider status/configuration without printing secrets; disable generation if cost
or privacy is at risk; preserve D1 history; rotate the key if exposure is possible;
then run the bounded authenticated smoke before re-enabling.

## Health Verification

Read-only chat list/detail checks prove application/D1 availability without a paid
call. A deliberate authenticated generation smoke proves the provider path and
must use a bounded message, explicit budget, and approved preset. Reload must
confirm that the completed assistant row, target set, and manual vocabulary changes
remain canonical in D1.
