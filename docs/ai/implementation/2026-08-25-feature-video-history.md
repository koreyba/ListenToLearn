---
phase: implementation
title: Automatic Video History Implementation
description: Implementation record for the aligned CTA and Continue watching flow
---

# Automatic Video History Implementation

## Development Setup

- Worktree: `.worktrees/feature-video-history`
- Branch: `feature-video-history`
- Bootstrap: `npm ci`

## Code Structure

- `public/trainer.html`: example-action CTA, history upsert and warm transition.
- `app/videos/page.tsx`: Continue watching presentation.
- `tests/rendered-html.test.mjs`: DOM/source contracts.

## Implementation Notes

- The visible provider label is `Phrase example`; `watchFullVideoBtn` is labelled
  `Continue in video` and sits after `Save clip` inside `.example-actions`.
- Removed the separate media action row, `expandMediaBtn`, expanded-state CSS,
  state mutation, and its event listener. The provider frame is always full width.
- Set the YouGlish widget to `components: 128`, a nonzero dependency-only mask.
  Zero cannot be used because widget v4.3 treats it as absent and falls back to
  the full `255` mask. With Caption excluded, the Dictionary-support bit renders
  no additional UI, removing the title and duplicate control-button panel while
  retaining the existing event/API wiring.
- Reworked the all/saved filter, example actions, Repeat/speed states, and the
  player toolbar into one flat squircle-based visual system. `Continue in video`
  is the primary gradient action; random traversal is fixed internally and the
  redundant Random/In order controls are absent. No runtime style dependency was added.
- Moved YouGlish accent selection into a compact native toolbar select with
  `All`, `US`, `UK`, and `AUS`; it is hidden for Tatoeba and Full Video Mode,
  and omits the cramped custom chevron. Replaced the numeric speed buttons with
  a turtle-icon Slow toggle (`1×`/`0.75×`).
- At <=560px, the nested example-toolbar border/background is removed.
  `All`/`Saved` and `Save clip`/`Continue in video` use the same two-column grid,
  44px height, 11px radius and centred content. Continue receives only a subtle
  accent tint and is hidden until a valid YouTube ID exists.
- `renderExampleTools()` labels a saved example `Remove clip` or `Remove track`
  so the toggle communicates the result of pressing it instead of only its state.
- Removed the `Watch later` button, element reference, event listener and button-specific save flow.
- Added `recordCurrentVideoHistory(origin)`. Guest writes remain synchronous/local; account POST is fire-and-observe so persistence never delays the warm transition.
- `watchCurrentFullVideo()` starts the history upsert before pausing/persisting/pushing Full Video state. Ordinary result callbacks never invoke the upsert; the internal name remains stable while the user-facing label is `Continue in video`.
- Renamed `/videos` copy and actions to `Videos`, `Continue watching`, `Continue`, `Last opened` and history-specific removal text.
- No schema, endpoint, storage-key or YouGlish fetch behavior changed.

## Integration Points

- Existing guest video-save helper in the trainer document.
- Existing subject-scoped `POST /api/videos`.
- Existing warm Full Video path; no new widget fetch.

## Error Handling

- History persistence errors are shown through the existing example message and do not block viewing.

## Performance Considerations

- One bounded local upsert or one account POST per deliberate Full Video entry.
- No write for normal YouGlish result navigation.

## Security Notes

- Reuse current video ID/query validation and subject ownership.
- Store no transcript or new sensitive data.
