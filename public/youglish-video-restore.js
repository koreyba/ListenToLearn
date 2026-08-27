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
    const matches = [...String(caption || "").matchAll(/\[\[\[([\s\S]*?)\]\]\]/g)]
      .map(match => cleanText(match[1], 240))
      .filter(Boolean);
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
