---
phase: implementation
title: Library Direct Practice Implementation
description: Implementation record for the direct catalog-to-Trainer action
---

# Library Direct Practice Implementation

## Changes

- `app/components/phrase-workspace.tsx`: renders one compact `PracticeAction` from the shared card summary on both surfaces, keeps Library save separate, names the To Learn transition `Move to Learning Now` while preserving removal, and renders the custom phrase form only on Practice outside tab-specific content.
- `app/globals.css`: styles the shared Practice action as a compact text control and gives the non-destructive Library save action a secondary treatment without affecting later-state `Remove`.
- `tests/connected-speech-library-ui.test.mjs`: protects component reuse, direct navigation, To Learn state actions, and the all-tabs custom phrase contract.
- `tests/app-theme.test.mjs`: protect the action hierarchy.

## Status

Complete. No API, D1, storage schema, or Trainer changes were needed: both surfaces reuse the same compact navigation component, while custom phrase submission keeps the existing `to_learn` state and selects that tab after creation.
