---
phase: testing
title: Unified site navigation testing
description: Automated and manual verification for the responsive global navigation and Videos entry point
---

# Unified site navigation testing

## Automated contracts

`tests/rendered-html.test.mjs` verifies:

- the React navigation and static trainer expose the same four destinations;
- Library, the Practice queue, the existing Videos history page, and Settings mark the correct active section;
- React and the static trainer consume the shared navigation stylesheet;
- desktop placement is sticky at the top;
- mobile placement is fixed at the bottom with four equal targets and safe-area padding;
- the trainer offsets its sticky learning workspace only on desktop.

The navigation contracts were observed failing before production changes and passing after implementation. A real mobile render exposed the filtered-ancestor containing-block bug; its regression assertion fails when the mobile `backdrop-filter: none` fix is removed and passes when restored.

Fresh completion evidence:

- `npm test`: build completed and `128/128` configured tests passed.
- `node --test tests/*.test.mjs`: `142/142` repository tests passed.
- `npx tsc --noEmit`: passed.
- scoped ESLint excluding nested worktrees: zero errors, with two generated `worker-configuration.d.ts` warnings.
- `npx ai-devkit@latest lint`: passed.
- `git diff --check`: passed.
- local browser smoke: desktop Library, real Videos history, and Practice rendered with the correct active state; mobile Practice rendered a four-column fixed bottom bar with safe body padding and a `0px` trainer sticky offset.

## Repository lint boundary

The existing `npm run lint` command descends into nested `.worktrees/**/dist` directories. In the current checkout it reports generated-code findings unrelated to this change. The verified checkout-level command is `bash scripts/sites-env.sh -- npx eslint . --ignore-pattern .worktrees --ignore-pattern dist --ignore-pattern .next`.
