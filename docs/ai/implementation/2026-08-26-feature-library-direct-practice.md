---
phase: implementation
title: Library Direct Practice Implementation
description: Implementation record for the direct catalog-to-Trainer action
---

# Library Direct Practice Implementation

## Changes

- `app/components/phrase-workspace.tsx`: renders Library `Practice` through `openPhrase`, keeps `Add to Learn` separate, and renders the custom phrase form only on Practice outside tab-specific content.
- `app/globals.css`: gives the non-destructive Library save action a secondary treatment without affecting `Remove`.
- `tests/connected-speech-library-ui.test.mjs`: protects direct navigation and the all-tabs custom phrase contract.
- `tests/app-theme.test.mjs`: protect the action hierarchy.

## Status

Complete. No API, D1, storage schema, or Trainer changes were needed: direct practice reuses the existing query contract, while custom phrase submission keeps the existing `to_learn` state and selects that tab after creation.
