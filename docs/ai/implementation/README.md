---
phase: implementation
title: Implementation Guide
description: Technical implementation notes, patterns, and code guidelines
---

# Implementation Guide

## Code structure

- `app/integrations/page.tsx`: client settings page; it holds only transient input state.
- `app/api/integrations/route.ts`: status/save/delete API with same-origin and size checks.
- `lib/integration-secrets.ts`: D1 lookup, AES-GCM encryption/decryption, and signed session cookie.
- `lib/deepl.ts`: server-only DeepL client with timeout and optional-error semantics.
- `drizzle/0004_clever_blonde_phantom.sql`: `integration_secrets` migration.

## Integration and error handling

The Worker reads the D1 binding through the existing database helper. DeepL uses the free endpoint for `:fx` keys and the paid endpoint otherwise, but no Cloudflare paid feature is required. Missing keys, upstream errors, timeouts, and empty responses raise typed optional translation errors; phrase writes continue with `translationPending`.

## Security notes

Cloudflare Access authenticates the owner for `/integrations` and `/api/integrations`. The Worker then issues `l2l_integration_session` with `HttpOnly`, `Secure`, `SameSite=Lax`, and a 24-hour expiry. D1 stores only AES-GCM ciphertext/IV; AES additional authenticated data binds ciphertext to the provider. The configured key is readable by server code only when that session is present.

## Local verification

Use `npx tsc --noEmit`, `npm run lint`, `node --test`, `./node_modules/.bin/vinext build`, and `./node_modules/.bin/wrangler deploy --dry-run` before deployment. Do not put real provider keys in source files, browser storage, logs, or chat.
