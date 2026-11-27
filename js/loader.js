/* Paint-only loader: no artificial navigation delay, request dependency or account state. */
(function () {
  "use strict";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let bootTimer, removalTimer;
  function tiles() {
    return Array.from({ length: 64 }, (_, i) => `<i style="--delay:${((i * 17 + Math.floor(i / 8) * 29) % 9) * 28}ms"></i>`).join("");
  }
  function dismiss() {
    clearTimeout(bootTimer);
    const loader = document.getElementById("mosaic-loader");
    if (!loader) { document.documentElement.classList.remove("mosaic-loading"); return; }
    loader.classList.add("is-leaving");
    clearTimeout(removalTimer);
    removalTimer = setTimeout(() => { loader.remove(); document.documentElement.classList.remove("mosaic-loading"); }, reduced.matches ? 0 : 180);
  }
  function start() {
    const loader = document.getElementById("mosaic-loader");
    if (!loader) return;
    // The first-paint grid is in HTML so it also animates while scripts are still downloading.
    if (reduced.matches) { dismiss(); return; }
    // A short brand entrance, not simulated progress. It never waits for auth or a network response.
    bootTimer = setTimeout(dismiss, 620);
  }
  function reveal(main) {
    main.querySelector(".route-mosaic")?.remove();
    if (reduced.matches) return;
    const layer = document.createElement("div");
    layer.className = "route-mosaic";
    layer.setAttribute("aria-hidden", "true"); layer.inert = true;
    layer.innerHTML = `<span class="loader-grid">${tiles()}</span>`;
    main.append(layer);
    setTimeout(() => layer.remove(), 300);
  }
  reduced.addEventListener("change", () => { if (reduced.matches) { dismiss(); document.querySelectorAll(".route-mosaic").forEach(el => el.remove()); } });
  window.addEventListener("pointerdown", dismiss, { once: true, capture: true });
  window.addEventListener("keydown", dismiss, { once: true, capture: true });
  window.addEventListener("pageshow", event => { if (event.persisted) dismiss(); });
  window.POS = window.POS || {};
  window.POS.loader = { reveal, dismiss };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
