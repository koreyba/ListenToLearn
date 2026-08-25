---
phase: monitoring
title: Automatic Video History Monitoring
description: Lightweight release checks for automatic history and Continue watching
---

# Automatic Video History Monitoring

## Key Signals

- Client/API errors when history upsert or removal fails.
- Unexpected duplicate video IDs in one user's collection.
- Full Video entries that do not appear in Continue watching.
- Responsive overflow or inaccessible CTA reports.

## Monitoring Tools

- Cloudflare Worker build/runtime logs and existing CI checks.
- Manual branch-preview smoke; no new analytics SDK in this MVP.

## Privacy and Logging

- Do not log caption bodies, transcripts, auth headers or user identity beyond existing platform diagnostics.
- A failed history write remains a user-visible non-blocking message.

## Health Checks

- Open an ordinary result: no history write.
- Choose Full Video: one deduplicated history item appears.
- Reopen and remove the item: resume and deletion remain functional.

## Alerts & Incident Response

- No new alert. Treat cross-user exposure or broken Full Video entry as release-blocking and revert using the documented deployment plan.
