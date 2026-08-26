---
phase: testing
title: Library Direct Practice Testing
description: Behavioral and visual contracts for unsaved phrase practice
---

# Library Direct Practice Testing

## Scenarios

- Library cards expose `Practice` and route through the existing `openPhrase` function.
- Direct practice is structurally separate from status mutation.
- `Add your own` is absent from Library, present on Practice, and always creates a `to_learn` phrase before selecting that tab.
- The primary action remains visually interactive while `Add to Learn` is non-destructive and secondary.
- Practice-page actions and Trainer query handling remain covered by the existing suite.

## Completion gates

- Targeted Library and theme tests: passed, 20/20.
- `npm test`: passed, including production build and 231/231 tests.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed with 0 errors and 2 existing generated declaration warnings.
- `git diff --check`: passed.
- `npx ai-devkit@latest lint --feature library-direct-practice`: passed.
