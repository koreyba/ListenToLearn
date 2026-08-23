---
phase: design
title: System Design & Architecture
description: Define the technical architecture, components, and data models
---

# System Design & Architecture

## Architecture Overview

The feature stays in the existing inline browser controller. It does not add a
server route or database state. The controller treats the YouGlish widget as an
asynchronous state machine: caption events are the source of truth, `move()` is
only a request, and a navigation operation completes only after the expected
caption event arrives.

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
- execute one bounded movement at a time and verify the resulting caption;
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

- `captionNavigationBusy` prevents overlapping requests;
- `captionNavigationToken` invalidates stale waits after reset/source changes;
- `captionWaiters` resolves only on a matching caption event or a timeout;
- `captionNavigationBlocked` disables a direction after a bounded failure until
  a fresh caption observation provides new boundary evidence;
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
entry for the current video, updates the visible caption, and notifies pending
navigation waiters. Repeated events for the same caption refresh observation
time instead of adding duplicates.

### Navigation controller

For a cached adjacent caption, the controller estimates current playback time,
calls `move(target.startTime - estimatedCurrentTime)`, and waits for that target
ID. If no adjacent entry is cached, it pauses playback, moves in bounded 0.5
second steps in the requested direction, and stops on the first different
caption with a valid time. It resumes playback only if it was playing before
the operation.

Every operation has a timeout and token check. A stale event cannot resolve a
new operation. If the provider does not confirm a target, the controller makes
no claim that the target was reached, blocks that direction until fresh caption
evidence arrives, and reports the bounded failure.

### Repeat controller

When repeat is enabled, `onCaptionConsumed` checks the consumed ID against the
current target. It seeks back to the current caption's observed start using the
elapsed playback estimate when available, then the known next-caption interval,
then a minimum bounded fallback. A caption change to another ID outside an
in-flight navigation is treated as a failed verification and disables repeat
with a visible status message. Turning repeat off clears the target before any
future consumed event is handled.

### UI state

`repeatCaptionBtn` exposes `aria-pressed` and a label containing `вкл`/`выкл`.
Previous/next/repeat controls are disabled while timing is unavailable or a
navigation command is busy. Existing replay and video controls remain separate.

## Design Decisions

- Use timing-bearing caption events plus verification rather than fixed seeks.
  This is the only path that can approximate one-caption navigation without
  pretending that `move(-5)` is exact.
- Keep the feature client-only. The provider timing is transient playback state;
  persisting it would add no value and could become stale.
- Use an opaque-ID timeline sorted by provider timestamps. Numeric ID ordering is
  not a contract, while timestamps give an observable direction.
- Feature-detect undocumented `current_time` and fail closed. This accepts the
  current widget behavior without making a future provider change a silent UX
  regression.
- Use bounded steps only to discover an unobserved neighbor. Never loop without
  a maximum duration or use a video-track fallback.

Alternatives rejected in requirements review: fixed five-second movement,
private endpoint/iframe scraping, and replacing the provider widget with an
independent player.

## Non-Functional Requirements

- Reliability: one in-flight operation, bounded waits, reset cancellation, and
  verified target IDs.
- Accessibility: native buttons, disabled states, `aria-pressed`, status text,
  and no keyboard-only path hidden inside the iframe.
- Performance: no polling while idle; step search is at most 80 half-second
  requests and stops immediately when a caption changes.
- Security: no new secrets, network routes, cross-origin DOM access, or storage
  of provider captions/timestamps.
- Compatibility: if the current widget omits timing or `move`, existing video
  navigation and caption display still work unchanged.
