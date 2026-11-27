/* Apply appearance before styles load, so saved dark mode never flashes light. */
(function () {
  "use strict";
  const key = "personal-os:theme";
  const system = window.matchMedia("(prefers-color-scheme: dark)");
  let preference = null;

  function readPreference() {
    try {
      const value = localStorage.getItem(key);
      return value === "dark" || value === "light" ? value : null;
    } catch (err) {
      return null;
    }
  }

  function apply() {
    const theme = preference || (system.matches ? "dark" : "light");
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]').content = theme === "dark" ? "#19221e" : "#f3f4f0";
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      const dark = theme === "dark";
      button.setAttribute("aria-pressed", String(dark));
      button.title = dark ? "Switch to light mode" : "Switch to dark mode";
      button.innerHTML = window.POS.util.icon(dark ? "sun" : "moon");
    });
  }

  preference = readPreference();
  apply();
  system.addEventListener("change", () => { if (!preference) apply(); });
  window.addEventListener("storage", (event) => {
    if (event.key !== key && event.key !== null) return;
    preference = readPreference();
    apply();
  });

  document.addEventListener("DOMContentLoaded", () => {
    apply();
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => button.addEventListener("click", () => {
      preference = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      try { localStorage.setItem(key, preference); } catch (err) { /* Still works for this visit. */ }
      apply();
    }));
  });
})();
