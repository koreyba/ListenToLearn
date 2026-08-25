---
phase: implementation
title: Implementation Guide
description: Technical implementation notes, patterns, and code guidelines
---

# Implementation Guide

## Development Setup

- Worktree: `.worktrees/feature-youglish-caption-segments-tdd`.
- Branch: `codex/youglish-caption-segments-tdd`, rebased onto `origin/main` at
  `a47c8a9`.
- Dependencies: `npm ci`, then JSDOM added as a test-only dependency.
- Task tracing is unavailable: `npx ai-devkit@latest task ...` reports
  `unknown command 'task'`.

## Code Structure

- `public/caption-navigation.js`: pure time, segment resolution, timeline upsert,
  segment-scoped neighbor, and seek-delta helpers.
- `public/trainer.html`: query-session/per-video controller and widget callbacks.
- `tests/caption-segments.test.mjs`: deterministic pure helper contract.
- `tests/youglish-caption-navigation.test.mjs`: real inline controller under
  JSDOM with fake `YG.Widget`.

## Implementation Notes

### Completed: segment helper

- `resolveSegment` retains a known caption's segment, places new times inside a
  known range, extends the active segment within 30 seconds, and otherwise
  allocates a new segment ID.
- `neighbors` and `adjacent` accept an optional segment ID while retaining the
  previous call contract when omitted.
- Focused proof: `node --test tests/caption-segments.test.mjs` passed 5/5 after
  the new tests first failed on the missing behavior.

### Completed: controller integration

- `captionVideoStates` stores independent history, cursor, active segment, and
  sequence values for each video in the active query session.
- Every caption is resolved into a segment before timeline upsert; buttons and
  movement use only active-segment neighbors.
- Replay uses the first observed caption ID as a pending confirmation target,
  retains forward history, and restores the paused state after confirmation.
- A timestamp-less Replay target reaches its already cached next caption through
  controlled playback, then pauses at the matching callback when required.
- Failed `play` and Replay commands clear pending intent immediately.
- Saved-example playback waits for the provider's `onVideoChange` event before
  switching video state, avoiding attribution of the old history to a new ID.

## Integration Points

The YouGlish widget remains the only media provider. No server, database,
authentication, saved-example API, or Tatoeba changes are required.

## Error Handling

Missing timing never produces an invented fixed seek. Movement errors retain
the existing fail-closed blocked direction behavior. Controlled-playback and
Replay failures clear pending intent so controls and later callbacks stay safe.

## Performance Considerations

All state is page-local. Segment scans are bounded by captions observed during
the current query session; no polling or network work is added.

## Security Notes

No new secret, external endpoint, iframe inspection, caption scraping, or
persistent provider data is introduced.

## Final Review

- The controller matches the per-query -> per-video -> per-segment design.
- All helper exports have in-repository callers or direct contract tests.
- The new dependency is development-only and `npm ls --depth=0` reports a valid
  dependency tree with `jsdom@29.1.1` on the repository's Node 22.13 baseline.
- No API, schema, persistence, authentication, Worker binding, or Tatoeba
  contract changes were introduced.
- No blocking or important code-review findings remain.
