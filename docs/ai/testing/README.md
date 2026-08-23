---
phase: testing
title: Testing Strategy
description: Define testing approach, test cases, and quality assurance
---

# Testing Strategy

## Automated checks

`tests/rendered-html.test.mjs` verifies the public trainer, optional DeepL wiring, phrase persistence, and server-side Integrations boundaries. The current verification set passed:

- `node --test` — 7 passed.
- `npx tsc --noEmit` — passed.
- `npm run lint` — 0 errors; two pre-existing generated-file warnings.
- `git diff --check` — passed.
- `vinext build` — passed.

## Deployment smoke tests

After deployment, verify that `/` and `/trainer?...` return 200, `/api/phrases` remains public, and `/integrations` plus `/api/integrations` return a Cloudflare Access redirect for an unauthenticated request. Verify the D1 migration independently without selecting or printing ciphertext.

## Manual owner flow

1. Open `/integrations` and complete the one-time email PIN for the allow-listed owner email.
2. Save a DeepL key; confirm the page shows configured status and never shows the key again.
3. Use the trainer to translate a word and save/promote an example.
4. Remove the integration and confirm translation becomes optional again.
