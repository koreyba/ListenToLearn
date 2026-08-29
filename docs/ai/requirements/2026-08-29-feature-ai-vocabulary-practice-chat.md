---
phase: requirements
title: AI Vocabulary Practice Chat
description: Contextual AI practice connected to the learner's saved words and phrases
---

# AI Vocabulary Practice Chat

## Problem Statement

Words become usable through context, not through an isolated translation. Unmumble
already provides repeated real-world video contexts; it now needs a complementary
text practice surface where the learner can request more contexts, ask for nuance,
translate in either direction, and receive feedback.

Vocabulary apps retain cards but rarely let the learner converse about a selected
set. General AI chats provide conversation but are disconnected from the learner's
vocabulary and manual learning state. Unmumble should connect both loops: saved
items enter a focused chat, and useful words or meanings found in chat return to the
same vocabulary.

Verified baseline on 2026-08-29:

- A word and a phrase already share the `phrases` model and the manual
  `To Learn` / `Learning Now` / `Learned` lifecycle.
- Account state is stored in D1; guest learning state is stored in browser storage.
- The Trainer already supports clicking a word or selecting a phrase to translate
  and add it, but the implementation is embedded in `public/trainer.html` and is
  not reusable by React chat messages.
- `phrases` stores only one shared `translation` and `context`; it cannot represent
  several learner-owned meanings safely.
- There is no chat, message, multi-target, AI-provider, or rate-limit model.

## Goals

- Add a focused, user-directed AI practice chat rather than a general assistant or
  an AI-authored course.
- Start a chat with one or several saved words/phrases, or start empty and name an
  unsaved target in the conversation.
- Keep an editable current practice set and supply its exact text and meaning
  constraints to the model on every generation request.
- Let the learner request examples, new contexts, translations, reverse-translation
  exercises, answer checks, and explanations in natural language.
- Persist multiple chats and their complete message history for signed-in users.
- Make AI messages interactive: click a word or select a phrase, translate it with
  message context, and explicitly add it to Practice.
- Introduce a user-scoped meaning model so a saved item can hold several meanings
  without mutating a shared catalog record.
- Preserve manual vocabulary status changes and all existing video practice flows.

### Non-goals for the first delivery

- No automatic progress score, spaced repetition, or AI decision that an item is
  learned.
- No autonomous agent tools or silent vocabulary/status mutations.
- No AI-authored lesson plan; the learner continues to direct the conversation.
- No final UX commitment for multi-item meaning selection or sentence distribution.
- No autonomous tool execution or resumable background streams; the first chat
  transport may stream the current response while the request is connected.
- No fixed model choice; provider and model remain server configuration.
- No production deployment, paid-service activation, or secret provisioning.

## User Stories

- As a learner, I can create a chat from one or more items in `To Learn`,
  `Learning Now`, or `Learned`, within a technical safety limit, so that I practise
  the vocabulary I already keep.
- As a learner, I can begin with no saved item and name a word or phrase in chat so
  that saving it is optional.
- As a learner, I can add or remove active targets without starting another chat.
- As a learner, I can ask for another example, a different context, an explanation,
  or a Russian-to-English task and receive feedback on my answer.
- As a learner, I can reopen one of several chats and continue with its messages and
  practice set intact.
- As a learner, I can practise all saved meanings, constrain a target to one meaning,
  or deliberately ask to explore other meanings.
- As a learner, I can attach a newly discovered meaning to an existing vocabulary
  item without changing the item's learning status.
- As a learner, I can click a word or select a phrase in an AI response, translate
  it, and explicitly add it to Practice using the same product pattern as captions.
- As a learner, I can manually move a saved target between Practice states from the
  chat without AI deciding for me.

## First Safe Implementation Boundary

The first executable slice is account-first:

- `/chat` may be publicly visible, but history and generation APIs require the
  existing signed-in application session.
- AI calls use Vercel AI SDK with its OpenRouter provider. Credentials and a model
  identifier come from Worker configuration and never from a browser request or
  committed file; Vercel hosting is not part of the architecture.
- Missing provider configuration produces an actionable unavailable state; it must
  not lose the learner's existing messages or mutate vocabulary.
- Guest AI access is deferred because an app-funded public endpoint requires a
  separate cost, abuse, and rate-limit policy. This is a security boundary, not a
  final product decision.
- Russian is the initial explanation/exercise language; the persisted contract must
  allow another language later.

## Success Criteria

- A signed-in learner can create, list, and open only their own chats.
- A chat accepts one or many saved targets plus unsaved text targets, and active
  targets can be added or removed independently of message history.
- Each generation request is built server-side from canonical persisted history and
  a snapshot of the current practice set; clients cannot inject a system role.
- Ordered message history and the current practice set survive reload and reopening.
  Provider failure is represented honestly and retry does not duplicate a user
  message.
- When the learner submits an English answer to a reverse-translation task, AI can
  check it and explain errors within the same user-directed conversation.
- Generation receives one of three explicit meaning scopes: all saved meanings, one
  selected saved meaning, or exploration beyond saved meanings. Exploration never
  saves a meaning automatically.
- Model output is rendered as text, never trusted HTML.
- Clicking a word and selecting a phrase in an assistant message can request a
  contextual translation and explicitly add an item to `To Learn`.
- Meanings are scoped to the learner and item. Adding a meaning neither creates a
  duplicate phrase nor changes `phrase_progress.status`.
- From chat, a learner can explicitly move an existing item among `To Learn`,
  `Learning Now`, and `Learned`; AI never triggers the transition.
- AI never changes a status or vocabulary record without a direct user action.
- Targeted unit/contract tests, migration checks, typecheck, lint, production build,
  and existing tests pass.

## Constraints and Assumptions

- D1 migrations are append-only. New chat and meaning tables must not reinterpret
  legacy `phrases.translation` as a global multi-meaning store.
- Existing `phrases.translation` and `phrases.context` remain a read-only fallback
  meaning for current vocabulary until the learner adds personal meanings. They are
  not automatically copied into user-scoped rows.
- Saved targets use stable phrase IDs; every target also stores a text snapshot so
  an unsaved target and historical chat remain understandable.
- All account queries are scoped through the authenticated user's subject. Incoming
  identity headers are never trusted directly from the client.
- Request bodies, history length, target count, message size, output tokens, and
  upstream duration must be bounded before any paid request.
- Provider keys remain server-side secrets and must never appear in logs, responses,
  message rows, request URLs, or client bundles.
- Existing `/api/phrases` remains the owner of manual status transitions. Meanings
  use a separate route because adding a meaning must not trigger `pick → to_learn`.
- The vision document at `docs/vision/ai-vocabulary-practice-chat.md` remains the
  product source; lifecycle docs describe the currently implementable increment.

## Alternatives Considered

1. Client calls a model provider directly: smallest proxy surface, rejected because
   it exposes credentials and weakens request/cost controls.
2. Vercel AI SDK with the OpenRouter provider and D1-backed canonical history:
   chosen for its model abstraction and standard chat stream protocol while keeping
   authentication, prompt construction, and persistence inside the Worker.
3. OpenRouter Agent SDK or a Durable Object agent runtime: useful later for
   autonomous tool loops, resumable streams, and stronger concurrency control, but
   unnecessary for this learner-directed first slice.

## Explicitly Deferred Decisions

- Whether public guests may consume paid AI and which cost/rate policy applies.
- Whether provider credentials are application-funded, learner-supplied, or both.
- The production model and fallback policy.
- Final controls for choosing one meaning across several simultaneous targets.
- Whether AI combines all targets in one sentence or distributes them across output.
- A product limit for simultaneous targets; the implementation may enforce a
  conservative safety ceiling without presenting it as a learning recommendation.
- Resumable/background streams, agent tools, automatic suggestions, and final
  visual polish.
