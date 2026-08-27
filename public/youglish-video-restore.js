(function attachYouglishVideoRestore(global) {
  "use strict";

  const MAX_PROGRESS_SECONDS = 604_800;

  function cleanText(value, limit) {
    return typeof value === "string"
      ? value.trim().replace(/\s+/g, " ").slice(0, limit)
      : "";
  }

  function finiteTime(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === "string" && value.trim() === "") return null;
    const seconds = Number(value);
    return Number.isFinite(seconds) && seconds >= 0 && seconds <= MAX_PROGRESS_SECONDS
      ? seconds
      : null;
  }

  function extractRestoreQuery(caption) {
    const source = String(caption || "");
    const matches = [];
    let searchFrom = 0;
    while (searchFrom < source.length) {
      const start = source.indexOf("[[[", searchFrom);
      if (start === -1) break;
      const contentStart = start + 3;
      const end = source.indexOf("]]]", contentStart);
      if (end === -1) break;
      const match = cleanText(source.slice(contentStart, end), 240);
      if (match) matches.push(match);
      searchFrom = end + 3;
    }
    return cleanText(matches.join(" "), 240);
  }

  function resumeDelta(resumeTime, currentTime) {
    const target = finiteTime(resumeTime);
    const current = finiteTime(currentTime);
    if (target === null || current === null) return null;
    const delta = target - current;
    return Math.abs(delta) >= 1 ? delta : null;
  }

  global.UnmumbleYouglishVideoRestore = Object.freeze({
    extractRestoreQuery,
    resumeDelta,
  });
})(window);
