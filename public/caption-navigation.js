(function attachCaptionNavigation(global) {
  "use strict";

  function finiteTime(value) {
    const time = Number(value);
    return Number.isFinite(time) && time >= 0 ? time : null;
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
        observedAt
      };
    } else {
      items.push({ ...entry, firstSeen: nextSequence, observedAt });
    }

    items.sort((left, right) =>
      left.startTime - right.startTime || left.firstSeen - right.firstSeen
    );
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
    upsert,
    adjacent,
    neighbors,
    relativeSeekDelta,
    repeatSeekDelta
  });
})(window);
