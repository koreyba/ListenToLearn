---
phase: implementation
title: Library and Practice separation
description: Catalog-only Library, status-based Practice queue, and explicit trainer entry
---

# Library and Practice separation

## Delivered behavior

- `app/page.tsx` renders the `library` surface: only phrases with status `pick`, plus the custom phrase form and `Add to Learn` actions.
- `app/practice/page.tsx` renders the `practice` surface: `To Learn`, `Learning Now`, and `Learned`, with `Learning Now` selected by default.
- `app/components/phrase-workspace.tsx` keeps guest/account bootstrap, sorting, status mutations, phrase rendering, and storage synchronization shared between both routes.
- A Library card is informational and cannot open the trainer. `Add to Learn` changes the existing status to `to_learn`, removes the phrase from Library, and makes it available under Practice → To Learn.
- A Practice phrase opens `/trainer` with explicit `phrase` and `phraseId` query parameters. `/trainer` without an explicit phrase redirects to `/practice`; full-video sessions remain exempt.
- `/practice` is included in the public guest allowlist and public document cache set. No phrase schema, status value, account API, guest storage key, or D1 behavior changed.

## Status lifecycle

The stored lifecycle remains `pick → to_learn → learning_now → learnt`. This change only assigns those states to clearer product surfaces: `pick` belongs to Library; the other three belong to Practice.
