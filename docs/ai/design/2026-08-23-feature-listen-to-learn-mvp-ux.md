---
phase: design
title: System Design & Architecture
description: Define the technical architecture, components, and data models
---

# System Design & Architecture

## Architecture Overview

```mermaid
flowchart LR
  Library[React library page] -->|phrase/status/sort| PhraseAPI[/api/phrases]
  Library -->|trainer link| Trainer[public/trainer.html]
  Trainer --> Workspace[Audio-first learning workspace]
  Workspace -->|translation + context| Translate[/api/translate]
  Workspace -->|save phrase/word| PhraseAPI
  Workspace -->|save/list/delete example| Examples[/api/examples]
  Workspace -->|search audio| Tatoeba[/api/tatoeba]
  Tatoeba --> TatoebaAPI[Tatoeba API]
  Workspace -->|fetch / control| YouGlish[YouGlish Widget API]
  YouGlish --> YouTube[YouTube content + widget ad surface]
  PhraseAPI --> D1[(Cloudflare D1)]
  Examples --> D1
  Translate --> DeepL[server-side DeepL]
```

The existing Vinext/React + static trainer + Cloudflare Worker/D1 architecture stays intact. The feature is implemented as a coordinated client/API/schema change, not as a new application surface. `public/trainer.html` remains the integration boundary for the external YouGlish widget and Tatoeba audio element.

## Data Models

### Phrase

The existing `phrases` row gains one nullable-in-practice text field with a non-null default:

```text
phrases
  id, text, pattern, ipa, translation, context
  source_type, catalog_order, status, created_at, updated_at
```

- `text` is either a phrase or a word; both use the same record and status lifecycle.
- `translation` is the available Russian translation, or empty when DeepL is unavailable.
- `context` is the original caption/sentence in which the item was selected, or empty when no caption exists.
- Existing rows are backfilled with `context = ''`; no separate words table is introduced.

### Phrase example

`phrase_examples` remains the concrete provider-item relation:

```text
(phrase_id, provider, external_id) UNIQUE
query, caption, accent, metadata, created_at
```

`external_id` is a YouTube video ID for YouGlish or a Tatoeba audio ID for Tatoeba. The saved item is intentionally not a timestamp. `metadata` continues to hold Tatoeba attribution fields.

### Browser preferences

The existing `connected-speech-trainer-v1` local state is normalized to version 2 and adds:

```ts
exampleMode: "all" | "saved"       // default "all"
exampleOrder: "random" | "ordered" // default "random"
```

The library page uses a separate local-storage key for `added_desc | added_asc | alpha_asc | alpha_desc`, defaulting to `added_desc`. Preferences are global, not keyed by phrase ID.

## API Design

### `GET /api/phrases`

Returns the existing phrase fields plus `context`, `created_at`, and `catalog_order` for client-side stable sorting.

### `POST /api/phrases`

Accepts:

```json
{
  "text": "word or phrase",
  "context": "original caption when available",
  "translation": "translation already shown to the user, optional"
}
```

The server validates and bounds all strings. It reuses a case-insensitive existing phrase, updates non-empty context, and uses the provided translation or best-effort server-side DeepL translation. Missing/failed DeepL remains non-blocking and is reported with `translationPending`.

### `PATCH /api/phrases`

Status transitions remain unchanged. Existing translation/context are preserved; an optional translation backfill can still occur for learning states.

### `GET/POST/DELETE /api/examples`

The route contract remains phrase-bound and unique by provider/external ID. The client changes only the traversal order: ordered mode uses creation order, random mode shuffles the loaded provider list once so previous/next are reversible.

### `POST /api/translate`

The existing `{ text, context }` contract remains. A word click and a selection both call it once for the visible translation. The result is kept in transient UI state so the adjacent `+ To Learn` action can persist it with the same context without adding a second library concept.

## Component Breakdown

### Library (`app/page.tsx`, `app/globals.css`)

- Four state tabs and existing phrase/status actions.
- One `select` sort control in the section header, rendered for every active tab.
- Stable client-side comparator: date modes use `created_at` with catalog/text/id tie-breakers; alphabetic modes use locale-aware text comparison with the same stable fallback.
- Context is shown as secondary metadata when present; it does not create a separate words view.

### Trainer (`public/trainer.html`)

The sticky learning stage becomes a desktop split layout:

```text
┌──────────────────────── learning workspace ───────────────┬── media ──┐
│ source + caption navigation + video navigation + playback │ compact  │
│ example mode/order + save                                  │ widget   │
│ captions + translation + selection actions                 │ >=200px  │
└────────────────────────────────────────────────────────────┴───────────┘
```

On mobile the learning workspace is first and the media panel follows it. No application control is positioned over the widget; YouGlish's own ad/branding surface remains inside its widget container.

Controls are explicit:

- Previous/next chevrons — caption-history controls inside the `Captions` group.
- Previous/next track icons — provider track/example controls inside `Video & audio`.
- Play/pause, replay, repeat, and speed controls — current media controls.
- `All` / `Saved`, `Random` / `In order` — global example settings.

The primary controls form one flat, non-wrapping icon toolbar on desktop and mobile; group wrappers remain in the markup but add no visible boxes or headings. The single play/pause button reflects provider playback state and toggles both ways. The caption-navigation explanation sits below the toolbar. Every icon-only control keeps an explicit English `aria-label` and `title`, and playback targets remain at least 44px high.

### Caption-history navigation

`onCaptionChange` records `{ videoId, id, raw, text }` in an in-memory history for the current YouGlish video. `onVideoChange` clears that history. The UI checks for a concrete caption-navigation method on the widget before enabling the buttons. The official API currently documents `previous()`/`next()` for tracks and `move(seconds)` for time movement, but not caption seeking; therefore the fallback is a disabled button and an explanatory status, never `move(-5)`.

### Provider navigation

- YouGlish all mode: `widget.previous()` / `widget.next()`; query suffix `:r` is used only for random mode, while ordered mode uses the normal query.
- YouGlish saved mode: the client traverses the phrase-bound saved video sequence and fetches the specific `query #external_id`.
- Tatoeba all mode: the client traverses the fetched audio tracks, shuffled only in random mode.
- Tatoeba saved mode: the client traverses phrase-bound saved audio IDs and retains attribution metadata.
- Tatoeba has no caption timeline, so the caption-navigation group, its status hint, and repeat-caption control are hidden for that source; YouGlish shows them.

### Translation and saving

`translateText(text, sourceLabel, context)` updates one translation box and transient `lastTranslation` state. The box includes `+ To Learn`, which calls the same `addTextToLearn(text, context, translation)` path used by selection actions. The path sends the original caption context when available and falls back to selected text/translation when it is not.

## Design Decisions

1. **Split layout over widget-first layout.** It minimizes risk to the existing provider integration while making the learning actions primary and keeping the widget policy-compliant.
2. **Client-side sorting.** The library result set is already loaded for counts/tabs; sorting locally avoids changing API ordering semantics and makes the preference immediate.
3. **Local storage for global trainer settings.** This matches the current app's single-user browser state and avoids per-phrase configuration, which the requirement explicitly rejects.
4. **Context on `phrases`, examples unchanged.** A selected word needs context even before a provider item is saved; a phrase-level context field covers that while `phrase_examples.caption` preserves concrete source examples.
5. **Feature detection for caption navigation.** An undocumented iframe seek would be brittle and a five-second move would be misleading. The design exposes the real boundary and is ready to activate a provider-supported method later.
6. **No timestamp persistence.** The requested MVP requires a concrete video/audio example, while timestamp persistence would add provider-specific lifecycle and replay complexity without verified API support.

### Alternatives rejected

- Move the trainer to a new React route: unnecessary migration risk for a stable static integration surface.
- Store words in a new table: violates the single-library requirement and duplicates status/sorting logic.
- Make the library API return each possible sort order: wastes server/database work for a small personal dataset and complicates default status ordering.

## Non-Functional Requirements

- **Provider policy:** keep the YouGlish widget fully viewable at a minimum 200px by 200px; do not overlay controls over its content or hide its branding/ads. Preserve YouTube Terms and Google Privacy links already present.
- **Accessibility:** all new controls are real buttons/selects, have explicit English accessible names, use `aria-pressed`/`aria-label` where appropriate, expose disabled reasons through status text, and retain visible focus.
- **Reliability:** stale Tatoeba/examples requests are ignored using existing request counters; missing DeepL does not block persistence; empty saved lists fall back explicitly.
- **Performance:** no new client framework or provider request; only one translation request per visible action; local sort/order operations are bounded by the already loaded library/example list.
- **Security:** context/translation are bounded server-side; no provider key moves to the browser; existing same-origin and server-only DeepL integration rules remain.
- **Responsive behavior:** desktop uses two columns with media >=200px; mobile stacks learning content before media and retains usable control targets.
