---
phase: requirements
title: Library Direct Practice
description: Let learners open any catalog phrase in the Trainer without saving it first
---

# Library Direct Practice

## Problem

Library cards can only move a catalog phrase into `To Learn`. The Trainer is reachable from Practice only after that state change, so a learner cannot sample a phrase before deciding to save it.

## Requirements

- Every visible Library catalog card exposes a `Practice` action.
- `Practice` opens the existing Trainer for that card's phrase and stable phrase ID.
- Direct practice must not add the phrase to `To Learn` or mutate account/guest progress.
- `Add to Learn` remains available as a separate secondary action.
- Remove `Add your own` from Library and show it on every Practice status tab.
- A custom phrase submitted from any Practice tab is added to `To Learn`, then `To Learn` becomes active.
- Existing Practice-page learning-state actions remain unchanged.

## Success criteria

- The Library action is rendered only as a direct navigation action.
- Trainer playback can start from the phrase query even when no learning status exists.
- The custom phrase form remains available on `To Learn`, `Learning Now`, and `Learned` without changing its destination status.
- Targeted tests, the full suite, build, typecheck, lint, and diff checks pass.

## Non-goals

- No new API, database migration, saved-example behavior, or automatic status transition.
