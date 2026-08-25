---
phase: implementation
title: Unified site navigation implementation
description: Shared Library, Practice, Videos, and Settings navigation across React and static trainer surfaces
---

# Unified site navigation implementation

## Delivered structure

- `app/components/site-navigation.tsx` owns the React navigation model: Library, Practice, Videos, and Settings. Practice now targets the `/practice` queue rather than opening `/trainer` directly.
- `public/site-navigation.css` is the shared visual contract. React bundles it through `app/globals.css`; the static trainer loads the same public stylesheet directly.
- The Library, Practice, Videos, and Integrations pages render the correct active section. The static trainer mirrors the same semantic links and marks Practice as current during an explicit phrase session.
- Desktop uses a sticky top navigation. At `760px` and below, the primary links become a four-item fixed bottom bar with safe-area padding; the compact brand/account row scrolls normally.
- The mobile parent disables its desktop `backdrop-filter`; otherwise that filtered ancestor becomes the containing block for the fixed bottom navigation and incorrectly pins it below the top brand row.
- `app/videos/page.tsx` keeps the existing Continue watching history/resume behavior and replaces its local Phrase library back-link with the shared navigation.

## Scope boundary

This change does not alter stored videos, playback progress, the videos API, full-video playback, caption navigation, phrase state, or provider behavior. It only gives those existing flows one consistent global navigation layer.
