---
phase: planning
title: Library Direct Practice Plan
description: TDD plan for direct Trainer launch from catalog cards
---

# Library Direct Practice Plan

## Tasks

- [x] Add a failing contract for a Library-only `Practice` action that calls `openPhrase`.
- [x] Render the action without invoking `changeStatus`.
- [x] Add a failing contract for moving `Add your own` to every Practice tab with a `To Learn` destination.
- [x] Move the form without duplicating submission or state logic.
- [x] Add a failing visual contract for primary Practice and secondary save hierarchy.
- [x] Implement the minimal semantic styling.
- [x] Run targeted and full validation.
- [x] Prepare the dedicated PR branch and validation evidence.

## Risks

- Accidentally coupling direct practice to `Add to Learn` would violate the core requirement.
- Reusing the destructive secondary class would make the save action appear dangerous.
- Rendering the form inside one tab branch would hide it from the other Practice states.
