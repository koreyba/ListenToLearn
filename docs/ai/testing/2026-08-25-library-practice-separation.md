---
phase: testing
title: Library and Practice separation testing
description: TDD and browser evidence for explicit phrase selection and status routing
---

# Library and Practice separation testing

## Automated contracts

`tests/rendered-html.test.mjs` and `tests/guest-access.test.mjs` verify:

- the global Practice destination is `/practice` on React and static trainer surfaces;
- Library and Practice use the shared workspace with their respective surface modes;
- Practice contains exactly `To Learn`, `Learning Now`, and `Learned`, defaulting to `Learning Now`;
- Library filters to `pick`, shows `Add to Learn`, and does not render trainer-opening card buttons;
- Practice opens `/trainer` only with explicit phrase parameters;
- direct phrase-less trainer entry redirects to `/practice` instead of falling back to `preset-0`;
- `/practice` is public for guests and included in the Worker document cache set.

Each behavior was first observed failing, then passing after its minimum implementation.

## Browser evidence

Local browser smoke verified:

- Practice opened at `/practice` with `Learning Now` active and no trainer workspace rendered;
- selecting a To Learn card opened `/trainer?phrase=...&phraseId=...` with the matching phrase;
- direct `/trainer` returned to `/practice` with `Learning Now` active;
- Library rendered 48 catalog cards, each with `Add to Learn`, and zero trainer-opening buttons;
- one preset moved from Library to Practice → To Learn and was then removed to restore the original guest state.

## Completion evidence

- `npm test`: build completed, `/practice` was included in the generated route table, and `128/128` configured tests passed.
- `node --test tests/*.test.mjs`: `142/142` repository tests passed.
- `npx tsc --noEmit`: passed.
- scoped checkout ESLint: zero errors and two existing generated declaration warnings.
- navigation regression proof: temporarily restoring the old `/trainer` Practice destination failed the focused test; restoring `/practice` returned it to green.
