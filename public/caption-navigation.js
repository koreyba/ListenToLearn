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

  function adjacent(history, index, direction, videoId) {
    const target = Array.isArray(history) ? history[index + direction] : null;
    return target && target.videoId === videoId ? target : null;
  }

  function neighbors(history, index, videoId) {
    return {
      previous: adjacent(history, index, -1, videoId),
      next: adjacent(history, index, 1, videoId)
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

  global.ListenToLearnCaptionNavigation = Object.freeze({
    finiteTime,
    isReplayTarget,
    canNavigateTo,
    upsert,
    adjacent,
    neighbors,
    relativeSeekDelta,
    repeatSeekDelta
  });
})(window);
