---
phase: design
title: System Design & Architecture
description: Define the technical architecture, components, and data models
---

# System Design & Architecture

## Architecture Overview

The feature stays in the existing inline browser controller. It does not add a
server route or database state. The controller treats the YouGlish widget as an
asynchronous provider around a local timeline: caption events populate and
reconcile the timeline, while a cached target can be selected immediately after
its relative `move()` request.

```mermaid
flowchart LR
  UI[Previous / Next / Repeat controls] --> Controller[Caption controller]
  Controller -->|move(delta)| Widget[YouGlish Widget API]
  Widget -->|onCaptionChange caption id current_time| Controller
  Widget -->|onCaptionConsumed id| Repeat[Repeat guard]
  Controller --> History[(Per-video in-memory caption timeline)]
  Controller --> Status[Disabled / busy / error UI]
  Controller -->|next / previous| Tracks[Existing video navigation]
```

The design has four responsibilities:

- normalize and retain timing-bearing caption observations per video;
- compute adjacent targets without comparing opaque caption IDs numerically;
- execute one cached movement at a time and update the local target immediately;
- repeat only the active caption and fail closed on provider drift.

## Data Models

The browser keeps a short-lived timeline for the current YouGlish video:

```ts
type CaptionEntry = {
  videoId: string;
  id: string;
  raw: string;
  text: string;
  startTime: number;
  firstSeen: number;
  observedAt: number;
  lastKnownTime?: number;
};
```

The timeline is sorted by `startTime` and uses `id + videoId` only for
identity. It is reset on query, source, saved-example, or video changes. No
caption text or timing is persisted to localStorage or D1.

Navigation state is local and ephemeral:

- `captionNavigationBusy` prevents overlapping movement calls;
- `captionNavigationBlocked` disables a direction after a movement failure until
  a fresh caption observation provides new evidence;
- `repeatCaptionEnabled` and `repeatTargetId` control the active repeat loop;
- `playerState`, `observedAt`, and `lastKnownTime` provide a bounded estimate of
  current playback time when `onCaptionConsumed` lacks a timestamp, including a
  paused/resumed caption.

## API Design

No application API changes are required.

The existing YouGlish calls are used as follows:

- `widget.move(delta)` requests a relative seek; `delta` is computed from
  observed caption start times, not hard-coded to five seconds.
- `widget.next()` and `widget.previous()` remain exclusively video-track
  navigation.
- `onCaptionChange(event)` consumes `event.caption`, opaque `event.id`, and the
  optional numeric `event.current_time`.
- `onCaptionConsumed(event)` triggers repeat only when its ID equals the active
  caption ID.
- `onPlayerStateChange(event)` is used only to improve the repeat timing
  estimate; missing state events do not enable unsafe navigation.

`current_time` is an optional capability. The controller requires a finite
number and a callable `move`; otherwise it disables phrase controls and keeps
the existing honest fallback text.

## Component Breakdown

### Caption event normalizer

`onCaptionChange` decodes the caption, validates `current_time`, upserts the
entry for the current video, and updates the visible caption. Repeated events
for the same caption refresh observation time instead of adding duplicates.

### Navigation controller

For a cached adjacent caption, the controller estimates current playback time,
calls `move(target.startTime - estimatedCurrentTime)`, and immediately selects
the cached target in the local timeline. It updates the visible caption and
unlocks the controls in the same command path; a later caption event can
reconcile the local state. If no adjacent entry is cached, the corresponding
control is disabled instead of starting a blind step search. A movement
exception blocks that direction and reports the failure.

### Repeat controller

When repeat is enabled, `onCaptionConsumed` checks the consumed ID against the
current target. It seeks back to the current caption's observed start using the
elapsed playback estimate when available, then the known next-caption interval,
then a minimum bounded fallback. An accepted caption change within the current
video retargets the loop to that caption, including after previous/next
navigation. Missing timing, a failed movement, or a query/source/video reset
still disables repeat. Turning repeat off clears the target before any future
consumed event is handled.

### UI state

`repeatCaptionBtn` exposes `aria-pressed`, a label containing `вкл`/`выкл`, and
a distinct accent background, border, and focus-ring-like shadow while pressed.
For YouGlish, previous/next/repeat controls are disabled while timing is
unavailable or a navigation command is busy. For Tatoeba, the timed caption
navigation group and phrase-repeat control are hidden; existing replay and
whole-track controls remain separate and available.

## Design Decisions

- Use timing-bearing caption events plus a cached-target fast path rather than
  fixed seeks or blind discovery. This approximates one-caption navigation
  without pretending that `move(-5)` is exact.
- Keep the feature client-only. The provider timing is transient playback state;
  persisting it would add no value and could become stale.
- Use an opaque-ID timeline sorted by provider timestamps. Numeric ID ordering is
  not a contract, while timestamps give an observable direction.
- Feature-detect undocumented `current_time` and fail closed. This accepts the
  current widget behavior without making a future provider change a silent UX
  regression.
- Do not attempt to discover an unobserved neighbor by repeated movement. Keep
  the direction disabled until ordinary caption playback adds that neighbor.

Alternatives rejected in requirements review: fixed five-second movement,
private endpoint/iframe scraping, and replacing the provider widget with an
independent player.

## Non-Functional Requirements

- Reliability: one in-flight movement, cached target identity, reset handling,
  and fail-closed movement errors.
- Accessibility: native buttons, source-appropriate hidden/disabled states,
  `aria-pressed`, status text, and no keyboard-only path hidden inside the
  iframe.
- Performance: no polling while idle; cached navigation performs one relative
  movement and one local state update.
- Security: no new secrets, network routes, cross-origin DOM access, or storage
  of provider captions/timestamps.
- Compatibility: if the current widget omits timing or `move`, existing video
  navigation and caption display still work unchanged.
