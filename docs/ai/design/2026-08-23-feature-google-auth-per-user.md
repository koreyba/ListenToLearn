---
phase: design
title: System Design & Architecture
description: Define the technical architecture, components, and data models
---

# System Design & Architecture

## Architecture Overview
**What is the high-level system structure?**

~~~mermaid
flowchart LR
  Browser --> Access[Cloudflare Access + Google]
  Access -->|validated Access JWT| Worker[Worker auth boundary]
  Worker --> Vinext[Vinext app routes]
  Vinext --> D1[(Cloudflare D1)]
  Vinext --> DeepL[DeepL API]
  Browser --> LocalState[user-scoped localStorage]
~~~

- Cloudflare Access authenticates Google and supplies the JWT.
- Worker verifies issuer, audience, signature, expiry and sub with jose.
- Worker removes client-controlled identity headers and injects one internal identity header into the request passed to Vinext.
- Route handlers resolve that identity, upsert users and scope every read/write.
- D1 remains the only persistent application store; no paid Cloudflare product is introduced.

## Data Models
**What data do we need to manage?**

users:

- id — Access JWT sub, primary key.
- email, display_name, timestamps.

phrases:

- Existing global catalog fields.
- owner_id nullable: null for shared presets, user id for custom phrases.
- Existing global status remains only as legacy compatibility data; current routes use phrase_progress.

phrase_progress:

- Composite primary key (user_id, phrase_id).
- status, created/updated timestamps.
- Foreign keys to users and phrases with cascade.

phrase_examples:

- Existing example fields plus user_id.
- Unique (user_id, phrase_id, provider, external_id).

integration_secrets:

- New id primary key, user_id, provider, ciphertext, iv, encryption_version.
- Unique (user_id, provider).
- New values use AES-GCM additional data bound to user id and provider. Legacy version 1 can be decrypted once and re-wrapped.

## API Design
**How do components communicate?**

GET /api/me returns the authenticated user display data and a non-secret user id for localStorage namespacing.
GET/POST/PATCH/DELETE /api/phrases filters presets and custom phrases by current user and stores status in phrase_progress.
GET/POST/DELETE /api/examples filters all operations by current user.
GET/POST/DELETE /api/integrations reads and writes only the current user's encrypted provider key.
POST /api/translate resolves only the current user's DeepL key.
Missing internal identity yields JSON 401. Access handles the browser redirect before the Worker in production.
Request body, query, Origin, ordinary cookies and Cf-Access-Authenticated-User-Email are never used as identity.

## Component Breakdown
**What are the major building blocks?**

- worker/index.ts: Access JWT verification and trusted identity propagation.
- lib/user-context.ts: serializable identity type and internal header codec.
- lib/auth.ts: request identity resolution, user upsert and explicit legacy-owner migration.
- db/schema.ts and drizzle/0006_google_auth_per_user.sql: relational isolation model and migration.
- API routes and lib/integration-secrets.ts: application authorization and scoped data operations.
- app/page.tsx and app/integrations/page.tsx: account indicator and existing workflows.
- public/trainer.html: authenticated bootstrap before user-scoped localStorage is read.

## Design Decisions
**Why did we choose this approach?**

- Use Cloudflare Access + Google instead of implementing OAuth: lower attack surface and no Google tokens in the app.
- Validate JWT in the Worker instead of trusting an Access email header: the Worker is the first application-controlled trust boundary.
- Use sub as identity and email only for legacy migration/display: email can change and is not an immutable principal.
- Keep a shared phrase catalog and separate progress: duplicating 50 presets per user would complicate ids and migration.
- Keep user-scoped localStorage for trainer-only controls in this PR: it prevents browser-account leakage without expanding D1 scope.
- Keep the existing path-specific Access app and accept both audiences; it avoids a destructive deletion and lets Integrations remain protected.

## Non-Functional Requirements
**How should the system perform?**

- JWT verification must fail closed and must not log tokens.
- D1 queries must include user filters on every user-owned table.
- AES-GCM key material remains Worker secret; plaintext never enters JSON responses or logs.
- DeepL timeout and optional-translation behavior remain unchanged.
- Design fits Cloudflare free plan: one Worker, one D1, Access Free, no new paid storage.
