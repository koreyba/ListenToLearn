(() => {
  const STORAGE_KEY = "unmumble:theme";
  const root = document.documentElement;
  const media = typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : { matches: false };

  function validTheme(value) {
    return value === "light" || value === "dark";
  }

  function readStoredTheme() {
    try {
      const value = window.localStorage.getItem(STORAGE_KEY);
      return validTheme(value) ? value : null;
    } catch {
      return null;
    }
  }

  function writeStoredTheme(theme) {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Theme switching remains available when storage is blocked.
    }
  }

  function updateControls(theme) {
    const next = theme === "dark" ? "light" : "dark";
    document.querySelectorAll("[data-theme-toggle]").forEach((control) => {
      control.setAttribute("aria-pressed", String(theme === "dark"));
      control.setAttribute("aria-label", `Switch to ${next} theme`);
      control.setAttribute("title", `Switch to ${next} theme`);
    });
  }

  function updateThemeColor(theme) {
    const color = theme === "dark" ? "#0d1116" : "#f5f3ec";
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute("content", color);
    });
  }

  function applyTheme(theme) {
    root.dataset.theme = theme;
    updateThemeColor(theme);
    updateControls(theme);
  }

  function resolvedTheme() {
    return readStoredTheme() || (media.matches ? "dark" : "light");
  }

  applyTheme(resolvedTheme());

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element
      ? event.target.closest("[data-theme-toggle]")
      : null;
    if (!target) return;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    writeStoredTheme(next);
    applyTheme(next);
  });

  document.addEventListener("DOMContentLoaded", () => updateControls(resolvedTheme()), { once: true });
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) applyTheme(validTheme(event.newValue) ? event.newValue : resolvedTheme());
  });
  media.addEventListener?.("change", () => {
    if (!readStoredTheme()) applyTheme(media.matches ? "dark" : "light");
  });
})();
