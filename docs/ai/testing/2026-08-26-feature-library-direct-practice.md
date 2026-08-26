---
phase: testing
title: Library Direct Practice Testing
description: Behavioral and visual contracts for unsaved phrase practice
---

# Library Direct Practice Testing

## Scenarios

- Library and Practice cards reuse one compact `PracticeAction` and route through the existing `openPhrase` function.
- Direct practice is structurally separate from status mutation.
- To Learn cards expose `Move to Learning Now` and retain `Remove`.
- `Add your own` is absent from Library, present on Practice, and always creates a `to_learn` phrase before selecting that tab.
- The compact Practice action remains visibly interactive while `Add to Learn` is non-destructive and separate.
- Practice-page actions and Trainer query handling remain covered by the existing suite.

## Completion gates

- Targeted Library and theme tests: passed, 21/21.
- `npm test`: passed, including production build and 232/232 tests.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed with 0 errors and 2 existing generated declaration warnings.
- `git diff --check`: passed.
- `npx ai-devkit@latest lint --feature library-direct-practice`: passed.
