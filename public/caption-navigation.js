(function attachCaptionNavigation(global) {
  "use strict";

  function finiteTime(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === "string" && value.trim() === "") return null;
    const time = Number(value);
    return Number.isFinite(time) && time >= 0 ? time : null;
  }

  function isReplayTarget(entry) {
    return Boolean(entry) && entry.navigationMode === "replay";
  }

  function canNavigateTo(entry) {
    return isReplayTarget(entry) || finiteTime(entry && entry.startTime) !== null;
  }

  function compareEntries(left, right) {
    const leftTime = finiteTime(left.startTime);
    const rightTime = finiteTime(right.startTime);
    if (leftTime === null && rightTime === null) return left.firstSeen - right.firstSeen;
    if (leftTime === null) return -1;
    if (rightTime === null) return 1;
    return leftTime - rightTime || left.firstSeen - right.firstSeen;
  }

  function upsert(history, entry, nextSequence, observedAt) {
    const items = Array.isArray(history) ? history.map(item => ({ ...item })) : [];
    const existingIndex = items.findIndex(item =>
      item.videoId === entry.videoId && item.id === entry.id
    );

    if (existingIndex >= 0) {
      items[existingIndex] = {
        ...items[existingIndex],
        raw: entry.raw,
        text: entry.text,
        startTime: entry.startTime,
        navigationMode: entry.navigationMode || items[existingIndex].navigationMode,
        observedAt
      };
    } else {
      items.push({ ...entry, firstSeen: nextSequence, observedAt });
    }

    items.sort(compareEntries);
    const index = items.findIndex(item => item.videoId === entry.videoId && item.id === entry.id);
    return {
      history: items,
      index,
      nextSequence: existingIndex >= 0 ? nextSequence : nextSequence + 1,
      entry: items[index]
    };
  }

  function segmentRange(history, videoId, segmentId) {
    const times = (Array.isArray(history) ? history : [])
      .filter(item => item.videoId === videoId && item.segmentId === segmentId)
      .map(item => finiteTime(item.startTime))
      .filter(time => time !== null);
    if (!times.length) return null;
    return { start: Math.min(...times), end: Math.max(...times) };
  }

  function resolveSegment(history, entry, activeSegmentId, nextSegmentSequence, maxGapSeconds = 30) {
    const items = Array.isArray(history) ? history : [];
    const existing = items.find(item =>
      item.videoId === entry.videoId && item.id === entry.id
    );
    if (existing && existing.segmentId) {
      return { segmentId: existing.segmentId, nextSegmentSequence };
    }

    const entryTime = finiteTime(entry.startTime);
    const segmentIds = [...new Set(items
      .filter(item => item.videoId === entry.videoId && item.segmentId)
      .map(item => item.segmentId))];
    if (entryTime !== null) {
      const containingSegmentId = segmentIds.find(segmentId => {
        const range = segmentRange(items, entry.videoId, segmentId);
        return range && entryTime >= range.start && entryTime <= range.end;
      });
      if (containingSegmentId) {
        return { segmentId: containingSegmentId, nextSegmentSequence };
      }

      const activeRange = segmentRange(items, entry.videoId, activeSegmentId);
      const activeItems = items.filter(item =>
        item.videoId === entry.videoId && item.segmentId === activeSegmentId
      );
      if (!activeRange && activeItems.length) {
        return { segmentId: activeSegmentId, nextSegmentSequence };
      }
      const gap = activeRange
        ? Math.min(Math.abs(entryTime - activeRange.start), Math.abs(entryTime - activeRange.end))
        : Infinity;
      if (activeRange && gap <= maxGapSeconds) {
        return { segmentId: activeSegmentId, nextSegmentSequence };
      }
    }

    const segmentId = `segment-${nextSegmentSequence}`;
    return { segmentId, nextSegmentSequence: nextSegmentSequence + 1 };
  }

  function adjacent(history, index, direction, videoId, segmentId) {
    const target = Array.isArray(history) ? history[index + direction] : null;
    return target
      && target.videoId === videoId
      && (!segmentId || target.segmentId === segmentId)
      ? target
      : null;
  }

  function neighbors(history, index, videoId, segmentId) {
    return {
      previous: adjacent(history, index, -1, videoId, segmentId),
      next: adjacent(history, index, 1, videoId, segmentId)
    };
  }

  function relativeSeekDelta(currentTime, targetStartTime) {
    return Number(targetStartTime) - Number(currentTime);
  }

  function repeatSeekDelta(currentStartTime, nextStartTime, estimatedCurrentTime) {
    const current = finiteTime(currentStartTime);
    const next = finiteTime(nextStartTime);
    const estimated = finiteTime(estimatedCurrentTime);
    if (current === null) return null;
    const knownDuration = next !== null && next > current ? next - current : null;
    const elapsed = estimated !== null && estimated > current
      ? Math.max(0.5, estimated - current)
      : null;
    return -(elapsed || knownDuration || 0.5);
  }

  // Backward move that returns from an absolute playback position to the
  // start of the looped caption, minus a small lead-in so the first syllable
  // survives seek latency. The lead-in never targets a negative video time.
  function repeatReturnDelta(targetStartTime, playbackTime, leadInSeconds = 0) {
    const start = finiteTime(targetStartTime);
    const playback = finiteTime(playbackTime);
    if (start === null || playback === null) return null;
    const lead = Number(leadInSeconds);
    const returnTarget = Math.max(0, start - (Number.isFinite(lead) && lead > 0 ? lead : 0));
    return returnTarget - playback;
  }

  global.UnmumbleCaptionNavigation = Object.freeze({
    finiteTime,
    isReplayTarget,
    canNavigateTo,
    upsert,
    segmentRange,
    resolveSegment,
    adjacent,
    neighbors,
    relativeSeekDelta,
    repeatSeekDelta,
    repeatReturnDelta
  });
})(window);
