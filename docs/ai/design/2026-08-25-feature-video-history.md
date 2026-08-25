---
phase: design
title: Automatic Video History Design
description: Reuse saved-video persistence as deliberate continuous-video history and keep the CTA beside Save clip
---

# Automatic Video History Design

## Architecture Overview

```mermaid
flowchart LR
  Result[Phrase example] -->|Continue in video| Upsert[Upsert video by videoId]
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

`videoId` remains unique. `updatedAt` is refreshed when `Continue in video` is chosen and drives newest-first display. Browser-local progress remains separate.

## API Design

- Guest: normalize/upsert the record in `listen-to-learn-guest-library-v1`.
- Account: reuse `POST /api/videos`; existing authentication, validation and subject ownership remain unchanged.
- Failure is non-blocking: report that history could not be updated, but do not block Full Video Mode.

## Component Breakdown

- **Source row:** label the provider choice `Phrase example`.
- **Example tools:** keep `Continue in video` beside `Save clip`. Hide the CTA
  unless the current source/result provides a valid YouTube ID and original query.
  On mobile, remove the nested toolbar card and use one aligned 2×2 grid:
  `All | Saved` directly above `Save clip | Continue in video`. Every cell uses
  equal width, 44px height, matching radius and centred content; only state and
  accent differ. When Continue is hidden, including Tatoeba, `Save clip` spans
  both columns instead of leaving an empty cell.
- **Media panel:** render the full-width provider directly, without an
  Expand/Collapse control or a separate action header. Configure the YouGlish
  widget with `components: 128`, the nonzero Dictionary-support bit whose
  documented Caption dependency is intentionally absent. The surrounding trainer
  supplies the title, captions and playback controls while the widget retains the video surface.
- **Playback settings:** place a native accent select followed by a turtle-icon
  Slow toggle in the final toolbar slots. Accent uses no overlaid chevron and
  disappears for Tatoeba and Full Video Mode; Slow maps pressed to `0.75×` and
  released to `1×`.
- **Videos page:** rename page/section/copy from saved/bookmark terminology to `Videos` and `Continue watching`; retain thumbnail, resume, remove and empty states.

## Design Decisions

- Automatic history on Full Video entry beats explicit `Watch later`: resume no longer depends on remembering a second action.
- Logging every YouGlish result is rejected because result navigation would flood history with incidental clips.
- Two collections are rejected for MVP because they duplicate persistence and navigation without a demonstrated pinning use case.
- Reusing the existing records keeps deletion cost low and avoids a database migration.

## Non-Functional Requirements

- The automatic upsert must not add another YouGlish fetch.
- The example-action group must remain usable at desktop and mobile breakpoints;
  mobile keeps visible action labels and 44px touch targets without a nested card.
- No transcript, secret or untrusted HTML is added to history.
- Account writes remain subject-scoped; guest data remains bounded to the existing 200-record cap.
