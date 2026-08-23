---
phase: monitoring
title: Monitoring & Observability
description: Define monitoring strategy, metrics, alerts, and incident response
---

# Monitoring & Observability

## Existing Signals

Keep existing Worker logs and endpoint checks. Phrase navigation is client-side
and adds no analytics or personal-data telemetry.

## Important Error Signals

- YouGlish `onError` events or a widget that stops exposing callable `move`.
- Caption events without finite `current_time` after a widget update.
- Repeated cached-navigation movement failures or unexpected caption IDs during
  repeat.
- Any regression where phrase controls call video-track `previous()`/`next()`.

## Logging and Privacy

Existing console diagnostics may retain provider error details, but must not log
credentials, OAuth material, or full private user data. Caption timing remains
ephemeral browser state and is never sent to analytics or persisted.

## Health Checks

Use the automated lifecycle gates and the manual desktop/mobile smoke checklist
from the testing document. Re-run the live YouGlish smoke after provider widget
updates because `current_time` is observed but not a documented stable field.

## Incident Response

If timing disappears or event ordering changes, keep the fail-closed controls and
record the observed event payload and widget version. Do not add private iframe
scraping or silently substitute a fixed rewind. Existing video navigation and
Tatoeba audio should remain available while the provider-specific feature is
disabled.
