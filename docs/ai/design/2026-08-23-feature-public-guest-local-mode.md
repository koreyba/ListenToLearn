---
phase: design
title: System Design & Architecture
description: Define the technical architecture, components, and data models
---

# System Design & Architecture

## Architecture Overview

```mermaid
flowchart LR
  Guest[Guest browser] -->|public HTML/assets| Worker[Cloudflare Worker]
  Guest -->|guest library/trainer state| GuestStore[(localStorage)]
  Guest -->|read-only examples| Tatoeba[/api/tatoeba]
  Account[Google account browser] -->|protected paths| Access[Cloudflare Access + Google]
  Access -->|Access JWT| Worker
  Worker -->|verified identity| App[Vinext React routes]
  App -->|user-scoped reads/writes| D1[(D1)]
  App -->|user-scoped key only| DeepL[DeepL API]
  Worker -.->|no guest writes| D1
```

The current host-wide Access application is narrowed to protected paths. Public paths are the home page, both the source `/trainer.html` asset and its production `/trainer` route, static assets and the read-only Tatoeba proxy. The Worker remains the application trust boundary: it verifies Access JWTs for protected requests and has an explicit public-route allowlist for guest requests.

## Data Models

### Guest browser state

`listen-to-learn-guest-library-v1` stores no identity, token or secret:

```json
{
  "version": 1,
  "statuses": { "preset-0": "to_learn" },
  "customPhrases": [
    {
      "id": "guest-custom-...",
      "text": "...",
      "pattern": "[...]",
      "ipa": "",
      "context": "",
      "translation": "",
      "status": "to_learn",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "savedExamples": [
    {
      "id": "guest-example-...",
      "phraseId": "preset-0",
      "provider": "tatoeba",
      "externalId": "123",
      "query": "...",
      "caption": "...",
      "accent": "",
      "metadata": {},
      "createdAt": "..."
    }
  ]
}
```

The trainer keeps its existing user-scoped learning settings under `connected-speech-trainer-v1:anonymous` for guest mode and `connected-speech-trainer-v1:<authenticated-user-id>` for account mode. Guest library status and saved-example records use the shared guest schema above; account data never uses this key.

### Account state

The existing D1 schema remains authoritative for authenticated users: `users`, `phrase_progress`, `phrase_examples`, `integration_secrets`, and owned custom phrases. No migration is required.

## API Design

- `GET /` and `GET /trainer.html`/`GET /trainer`: public UI; the source asset may redirect to the production route, and guest mode does not request account APIs during initial bootstrap.
- `GET /api/tatoeba` and `GET /api/tatoeba/audio`: public, read-only external proxies; no D1 access.
- `/login`: protected by Access. With a verified identity, Worker redirects to `/?signedIn=1`; without identity the Access application sends the visitor to Google.
- `/api/me`: authenticated only; returns the current Access subject and display data.
- `/api/phrases`: authenticated only for all operations. Guest UI uses local state instead of this API.
- `/api/examples`: authenticated only for all operations. Guest UI uses local state instead of this API.
- `/api/translate`: authenticated only and resolves only the current user's DeepL key. Guest translation is a non-blocking unavailable state.
- `/integrations` and `/api/integrations`: authenticated only; encrypted per-user key remains server-side.

Missing internal identity continues to return JSON `401` from route handlers. Access handles browser redirects for protected paths before the request reaches the Worker. External identity headers are never trusted as application identity.

## Component Breakdown

- `worker/index.ts`: classify public guest routes, verify Access JWT for all other routes, perform the login redirect, and inject trusted identity.
- `lib/guest-library.ts`: pure guest state schema, normalization, status transitions, custom phrase and saved-example helpers.
- `app/page.tsx`: choose guest/account bootstrap mode, render the local guest library, and keep existing user-scoped mutations for authenticated users.
- `public/trainer.html`: treat an unauthenticated `/api/me` result as an intentional guest state, skip user APIs, and persist phrase/example actions locally.
- `app/api/*`: remain server-side and user-scoped; Tatoeba routes are the only public API exceptions.
- Cloudflare Access: path-scoped Google protection for `/login`, the exact account routes `/api/me`, `/api/phrases`, `/api/examples`, `/api/translate`, and the existing `/integrations` plus `/api/integrations` application, while leaving public UI and Tatoeba paths open. A broad `/api/*` rule is intentionally avoided because `/api/tatoeba` is public.

## Design Decisions

- **Local guest state instead of anonymous D1 rows.** This gives strict isolation by construction, avoids cleanup and abuse controls, and is safest for the Cloudflare Free plan.
- **`localStorage` instead of `sessionStorage`.** The guest can move from library to trainer and reload without losing the trial. A visible reset action handles privacy/cleanup.
- **No automatic merge after login.** Merging can accidentally pollute a personal library and requires conflict rules. It is a separately scoped future feature.
- **Protected API, local guest mutations.** A guest never needs a server write; direct unauthenticated calls remain rejected even if a client is modified.
- **Path-scoped Access.** Cloudflare Access supports self-hosted applications for exact paths. This preserves Google JWT delivery for account APIs without putting a login wall in front of the demo UI.
- **Public Tatoeba proxy only.** It is read-only and contains no user state; DeepL remains private and account-scoped.

## Non-Functional Requirements

- No guest request may write to D1.
- No API key, Access token or authenticated subject may be placed in guest storage.
- Public Worker allowlist must be explicit; a new route is protected by default.
- Guest local state is bounded and normalized to prevent malformed storage from breaking the app.
- Account requests retain current JWT verification, user scoping, no-store headers and encrypted secret handling.
- No new paid Cloudflare product or persistent anonymous storage is introduced.
