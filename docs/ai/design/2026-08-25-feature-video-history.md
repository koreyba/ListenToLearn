---
phase: design
title: Automatic Video History Design
description: Reuse saved-video persistence as deliberate full-video history and move the CTA into the media header
---

# Automatic Video History Design

## Architecture Overview

```mermaid
flowchart LR
  Result[YouGlish result] -->|Watch full video| Upsert[Upsert video by videoId]
  Upsert --> Guest[Guest localStorage]
  Upsert --> Account[Subject-scoped POST /api/videos]
  Upsert --> Warm[Existing warm Full Video transition]
  Guest --> Videos[/videos Continue watching]
  Account --> Videos
  Warm --> Progress[Browser-local resume progress]
  Progress --> Videos
```

- `public/trainer.html` owns the CTA placement, automatic upsert and warm transition.
- Existing guest-library and `/api/videos` contracts remain the storage boundary.
- `app/videos/page.tsx` presents the records as history and continues to build the shared trainer resume URL.

## Data Models

No schema change. Existing saved-video fields become the MVP history record:

```text
videoId, originPhraseId, originQuery, originCaption,
language, accent, createdAt, updatedAt
```

`videoId` remains unique. `updatedAt` is refreshed when `Watch full video` is chosen and drives newest-first display. Browser-local progress remains separate.

## API Design

- Guest: normalize/upsert the record in `listen-to-learn-guest-library-v1`.
- Account: reuse `POST /api/videos`; existing authentication, validation and subject ownership remain unchanged.
- Failure is non-blocking: report that history could not be updated, but do not block Full Video Mode.

## Component Breakdown

- **Media header:** `Watch full video` at the left; `Expand` at the right. Hide the CTA unless the current source/result provides a valid YouTube ID and original query.
- **Example tools:** retain saved-clip controls and filters only; remove the full-video history actions.
- **Videos page:** rename page/section/copy from saved/bookmark terminology to `Videos` and `Continue watching`; retain thumbnail, resume, remove and empty states.

## Design Decisions

- Automatic history on Full Video entry beats explicit `Watch later`: resume no longer depends on remembering a second action.
- Logging every YouGlish result is rejected because result navigation would flood history with incidental clips.
- Two collections are rejected for MVP because they duplicate persistence and navigation without a demonstrated pinning use case.
- Reusing the existing records keeps deletion cost low and avoids a database migration.

## Non-Functional Requirements

- The automatic upsert must not add another YouGlish fetch.
- The media header must remain usable at desktop and mobile breakpoints; mobile may collapse CTA labels while retaining accessible names.
- No transcript, secret or untrusted HTML is added to history.
- Account writes remain subject-scoped; guest data remains bounded to the existing 200-record cap.
