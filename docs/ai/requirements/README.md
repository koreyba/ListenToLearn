---
phase: requirements
title: Requirements & Problem Understanding
description: Clarify the problem space, gather requirements, and define success criteria
---

# Requirements & Problem Understanding

## Problem Statement

Listen to Learn needs an owner-only Integrations page where a DeepL API key can be configured without exposing it to the browser or anonymous visitors. A missing or unavailable translator must remain optional: adding and moving phrases must continue to work.

## Goals and non-goals

- Provide `/integrations` and a status-only integrations API.
- Store the DeepL key encrypted in D1; never return the plaintext key.
- Keep the trainer and public learning flow available without login.
- Protect the settings page and its API with Cloudflare Access on the free plan.
- Non-goal: multi-user accounts or a general secret-management product.

## Success criteria

- Access redirects unauthenticated requests to `/integrations` and `/api/integrations`.
- Home, trainer, and phrase APIs remain publicly reachable.
- DeepL failures become optional translation feedback, not blockers for phrase progression.
- Automated checks, build, migration, and live smoke checks pass.

## Constraints and open items

- Use Cloudflare Free resources only; stop before introducing a paid dependency.
- The current data model is single-user; user ownership columns are future work.
- The owner must enter the actual DeepL key through the protected page; it is intentionally not handled in chat.
