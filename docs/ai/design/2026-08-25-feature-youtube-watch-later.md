---
phase: design
title: YouTube Watch Later Design
description: Architecture for a video-level library and direct YouTube viewer
---

# YouTube Watch Later Design

## Architecture Overview

```mermaid
flowchart LR
  Trainer[YouGlish trainer] -->|videoId + origin context| Save[Watch later action]
  Trainer -->|videoId only| Videos[Videos view]
  Save -->|guest| Guest[(bounded localStorage)]
  Save -->|account| API[/api/videos]
  API --> D1[(saved_videos)]
  Guest --> Videos
  D1 --> API --> Videos
  Videos --> Player[YouTube IFrame Player]
  Player -->|getCurrentTime| Progress[(browser-local progress)]
  Progress -->|startSeconds| Player
```

YouTube is a video playback mode and library destination, not a third search provider in this increment. YouGlish remains responsible for phrase discovery and caption-aware clip practice. `/videos` is responsible for durable video selection and long-form playback without a YouGlish fetch.

## Data Models

### Account saved video

```text
saved_videos
  id TEXT PRIMARY KEY
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE
  youtube_video_id TEXT NOT NULL
  origin_phrase_id TEXT NULL REFERENCES phrases(id) ON DELETE SET NULL
  origin_query TEXT NOT NULL DEFAULT ''
  origin_caption TEXT NOT NULL DEFAULT ''
  created_at TEXT NOT NULL
  updated_at TEXT NOT NULL

UNIQUE(user_id, youtube_video_id)
INDEX(user_id, updated_at)
```

On duplicate save, the record retains its identity and `created_at`, updates origin context when non-empty, and moves to the front through `updated_at`.

### Guest saved video

The normalized guest library advances to version 2 and adds a bounded `savedVideos` array with the same camelCase fields. Normalization preserves existing version-1 phrases and saved examples. Maximum saved videos: 200.

### Browser progress

```ts
type YouTubeProgressState = {
  version: 1;
  videos: Record<string, { seconds: number; updatedAt: string }>;
};
```

Storage key: `listen-to-learn-youtube-progress-v1`. Keep at most 200 valid entries. Progress is keyed only by `videoId`, because a video is unique independently of the phrase that discovered it.

## API Design

### `GET /api/videos`

Authenticated request. Returns `{ videos: SavedVideo[] }`, newest `updated_at` first. Every row is scoped by the server-derived user subject.

### `POST /api/videos`

Authenticated JSON body contains `videoId`, optional `originPhraseId`, `originQuery`, and `originCaption`. It validates the 11-character YouTube ID and bounded text. `originPhraseId`, when supplied, must refer to a visible preset or user-owned phrase. The API upserts on `(user_id, youtube_video_id)` and returns `{ video, created }`.

### `DELETE /api/videos?id=<record-id>`

Deletes only a row owned by the authenticated user and returns `{ deleted: true }`; missing/not-owned IDs return 404.

Guest mode calls pure helpers in `lib/guest-library.ts` and never sends mutating requests to account APIs.

## Component Breakdown

### Trainer integration

- Rename the YouGlish saved-example label from `Save video` to `Save clip`; Tatoeba remains `Save track`.
- Add `Watch later`, visible for YouGlish and enabled with a valid current video. Origin phrase ID is optional because a video-level bookmark must not depend on the current query already being in the phrase library.
- Add `Watch full video`, visible for YouGlish and enabled with any valid current video; navigate to `/videos?video=<id>` with optional origin context parameters.
- `Watch later` reuses current guest/account-mode detection. It upserts but does not navigate.

### Videos view

- `app/videos/page.tsx` is a client page that follows the home page's guest/account bootstrap contract.
- List cards show a YouTube thumbnail, origin query/caption, saved date, progress, `Watch` and `Remove`.
- Selecting a card updates the `video` query parameter without a full reload and displays the player above the list.
- A valid direct `video` query can be watched without first saving it. Saving is always explicit.
- Header links back to the phrase library and current origin phrase when available.

### YouTube player

- A client component owns loading `https://www.youtube.com/iframe_api` once, constructing/destroying `YT.Player`, and exposing status.
- Player variables: `controls: 1`, `playsinline: 1`, `cc_load_policy: 1`, `cc_lang_pref: "en"`, and `origin: window.location.origin`.
- On ready, load/cue with the normalized stored `startSeconds`. Do not autoplay.
- While playing, persist every five seconds. Also persist on pause, `visibilitychange`, `pagehide`, selection change and component cleanup.
- On ended, clear/reset progress. A position within ten seconds of a known duration is treated as completed and resets to zero.
- Errors remain inside the view with a direct `Open on YouTube` fallback.

## Design Decisions

1. **Separate video library, not provider tab.** The current caller is “watch a discovered video later”; YouTube search/import is not yet a caller.
2. **Separate clip and video records.** A phrase example and a long-form video have different identity, navigation and deletion semantics.
3. **D1 list plus local progress.** Account users need ownership and durable saved videos; high-frequency progress writes do not need server synchronization in this increment.
4. **No metadata provider.** Origin context plus deterministic YouTube identity avoids an API key and a new failure path.
5. **Native player controls and CC.** They cover full-video playback without transcript extraction or duplicated YouTube UI.
6. **One `/videos` route for list and player.** A query-selected player avoids premature `/videos/:id` routing while preserving browser history.

### Alternatives considered

- Third provider tab: rejected for now because it would imply YouTube discovery/search and caption events that the MVP does not provide.
- Reuse `phrase_examples`: rejected because uniqueness is phrase-bound and deleting one phrase could incorrectly remove a video-level bookmark.
- Store progress in D1: deferred because browser reload, not cross-device resume, is the current requirement.
- Scrape/cache captions: rejected for reliability and provider-policy reasons.
- Automatically save on `Watch full video`: rejected because opening and bookmarking are distinct user intents.

## Non-Functional Requirements

- Validate and encode every video ID before creating URLs; never accept arbitrary embed URLs or HTML.
- Scope account rows by authenticated subject on every operation; use `no-store` responses.
- Preserve YouTube branding, ads, referer/origin signals and a player viewport of at least 200 by 200 pixels.
- Keep the page useful when the IFrame API, captions, localStorage or a specific video is unavailable.
- Bound guest videos, progress records, text fields and request bodies.
- Avoid autoplay and external metadata requests in list view.
- Do not log captions, video progress maps, auth tokens or full request bodies.
