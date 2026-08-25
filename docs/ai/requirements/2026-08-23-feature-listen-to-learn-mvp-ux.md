---
phase: requirements
title: Requirements & Problem Understanding
description: Clarify the problem space, gather requirements, and define success criteria
---

# Requirements & Problem Understanding

## Problem Statement

ListenToLearn already has a four-state phrase library, a public trainer, YouGlish/Tatoeba playback, captions, DeepL translation, and phrase-bound saved examples. The current trainer still treats the video widget as the primary surface, combines different navigation meanings into two generic buttons, resets example selection behavior per phrase, and stores words/phrases without one explicit context-preservation rule. The library has no user-facing sort control.

The target users are the owner and a small group of friends using the personal non-commercial app to improve English listening and remember useful words and phrases. The MVP must make listening, captions, translation, and saving the next action obvious while preserving the existing learning flow and external-source boundaries.

## Goals & Objectives

### Goals

- Preserve the library states `Pick → To Learn → Learning Now → Learnt`, preset phrases, custom phrases, and phrase progression.
- Make the trainer audio-first: controls, current captions, contextual translation, and save actions remain the primary working area; the YouGlish widget/Tatoeba player is a compact secondary media area.
- Split caption navigation from example/video navigation. Implement a caption-history attempt only where an exact widget operation is available; never present a five-second seek as an exact caption transition.
- Add global, persisted example settings: `Все`/`Сохранённые` and `Случайно`/`По порядку`, initially `Все · Случайно`. Saved YouGlish videos and Tatoeba audio remain attached to the current phrase.
- Treat a clicked word, a short selection, and a full selected caption as the same library-saving operation. Preserve the original caption as context when available and preserve the available translation.
- Add one consistent library sort control to every phrase-state tab and preserve its setting between sessions.
- Keep the UI usable on desktop and mobile, with consistent loading/error/empty states and accessible keyboard/focus behavior.

### Non-goals

- Speaking, writing, grammar explanations, flashcards, tests, spaced repetition, or a separate `Words` section.
- Commercial features, multi-user ownership, or replacing YouGlish, Tatoeba, or DeepL.
- Persisting an exact playback timestamp for saved examples in this MVP; a saved example means the concrete provider item/video/audio, not a timestamp.

## User Stories & Use Cases

- As a learner, I can move a phrase through the existing four library states without losing presets or custom phrases.
- As a learner, I can sort any library tab by newest/oldest added or A–Z/Z–A using the same control and see the setting restored in a later session.
- As a learner, I can see controls, captions, contextual translation, `Сохранить`, and `+ To Learn` without the media widget or its advertisement covering them.
- As a learner, I can navigate previous/next videos independently from previous/next captions. Previous/next video works for YouGlish and Tatoeba, including the saved-example mode.
- As a learner, I can switch between all provider examples and examples saved for this phrase; provider traversal is random without a separate order setting.
- As a learner, I can click a caption word, receive one DeepL contextual translation, and use `+ To Learn` beside that result.
- As a learner, I can select a short or full caption, translate it, listen to it, or add it to the same phrase library. The stored entry contains the caption as context when it exists.
- As a learner, I can save a concrete YouGlish video or Tatoeba audio item for the current phrase and later replay it from `Сохранённые`.
- As a learner, I see honest loading, empty, unavailable-provider, and error states. An unavailable DeepL translation must not block phrase/example persistence.

### Edge cases

- No saved examples exist for the current phrase/provider: `Сохранённые` is disabled for that context and the UI remains in the effective `Все` view without silently changing the global preference.
- A saved example is removed while `Сохранённые` is active: the next valid saved item is selected; if none remain, the UI returns to `Все` with an explicit message.
- Tatoeba provides an audio sentence but no caption timeline: caption navigation is unavailable, while audio/example navigation remains available.
- YouGlish exposes caption change IDs but not a documented seek-to-caption operation. The app records caption history and feature-detects an exact operation; if none is available, the caption buttons remain disabled with an explanation. The app must not call `widget.move(-5)` for this action.
- A word/selection has no surrounding caption: save the selected text and any available translation with an empty context.
- Existing local state from before this feature lacks new settings/context: normalize it to the new defaults without data loss.
- A phrase already exists: reuse the same library record, update a non-empty current context, and do not create a separate word library.

## Success Criteria

- [x] `feature-listen-to-learn-mvp-ux` has requirements, design, planning, implementation, and testing docs that pass feature lint.
- [x] The current library still exposes all four states, preset/custom phrases, and status transitions.
- [x] The library exposes one identical sort control in every tab with date and alphabetic modes; the selected value persists in browser storage and sorting is stable for ties.
- [x] The trainer has distinct caption and video navigation controls. Video navigation uses the provider API/track list; caption navigation never falls back to an unlabeled five-second seek.
- [x] Example mode is a global persisted trainer setting and defaults to `all`; provider traversal is always random and exposes no order control.
- [x] Saved examples remain keyed by `(phrase_id, provider, external_id)` and replay the concrete YouGlish video/Tatoeba audio item.
- [x] Desktop and mobile use the same learning order: source and example settings,
  captions, controls, then a >=200px-by-200px media frame. Media actions stay
  attached to the video without overlapping provider content.
- [x] A word click shows one contextual translation box and an adjacent `+ To Learn` action; selected text retains translate/listen/save actions.
- [x] Phrase-saving accepts context and an available translation; a missing DeepL service does not prevent saving or status progression.
- [x] Existing YouGlish, Tatoeba, subtitle, replay, play/pause, speed, and source-switch flows remain available in the implementation; play/pause is one stateful control for both providers, while YouGlish success-path playback remains provider-dependent.
- [x] Type-check, lint, rendered HTML/static tests, build, Worker dry-run, and manual responsive smoke check pass. No real provider secret is added.

Implementation evidence and the remaining provider limits are recorded in the testing document. The build wrapper now uses the repository's portable Node timeout runner; successful DeepL/YouGlish provider paths still need their external configuration.

## Constraints & Assumptions

- The current public architecture remains: React/Vinext library page, `public/trainer.html`, server API routes, Cloudflare Worker/D1, and server-side DeepL credentials.
- The official YouGlish widget API documents `previous()`/`next()` for tracks, `move(seconds)` for time movement, and `onCaptionChange` with a caption ID, but does not document a seek-to-caption function. Therefore exact caption navigation is a feature-detected best effort and may remain unavailable; this is an explicit accepted MVP limitation. The widget must remain fully viewable and at least 200px by 200px, and its `Powered by YouGlish.com`/ad surface remains inside the widget.
- Global UI preferences use the existing browser `localStorage` state model; they are not stored per phrase or in D1.
- Library sort default is `added_desc` (newest first) and is global/persisted. Provider and saved-example sequences are shuffled once per loaded phrase/provider context, then navigable in both directions.
- Exact saved playback position is deferred; the saved record stores the provider item and current caption/context metadata only.
- Adding a word uses the existing `phrases` table with the same `status` lifecycle. A `context` column is added; no standalone words table or UI section is introduced.
- DeepL remains optional and best-effort. Existing integration access, secret handling, and external provider attribution/security boundaries remain unchanged.

## Questions & Open Items

All MVP-level decisions are resolved above. The only intentionally deferred item is whether a future YouGlish API/version supplies a stable exact caption seek operation. The implementation will expose the feature-detection boundary and a truthful disabled state; it will not invent a timestamp or claim completion when the provider cannot support it.

### Alternatives considered

1. Keep the vertical sticky widget-first layout — smallest diff, but controls and subtitles compete with the media/ad surface.
2. Use a separate media page — clear separation, but breaks the continuous listening workflow.
3. Use a split audio-first workspace (chosen) — keeps controls/captions/actions primary while preserving a continuously visible, policy-compliant widget.

For example settings, storing preferences per phrase was rejected because it makes the trainer unpredictable; a single global browser state matches the requested behavior and current app model.
