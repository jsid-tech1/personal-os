/* Original geometric botanical compositions, deterministically varied by week. */
(function () {
  "use strict";
  const POS = window.POS, P = POS.planning, U = POS.util;
  const colors = ["#c22d63", "#e05b87", "#efb4c8", "#315b43", "#71935c", "#d5df83"];
  function cells(seed = "") {
    const shift = [...seed].reduce((a, c) => a + c.charCodeAt(0), 0) % 3;
    const list = [];
    for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
      const dx = x - 10, dy = y - 6;
      let color = "";
      for (let p = 0; p < 6; p++) {
        const a = p * Math.PI / 3 + shift * .15;
        const along = dx * Math.cos(a) + dy * Math.sin(a);
        const across = -dx * Math.sin(a) + dy * Math.cos(a);
        if (((along - 2.4) / 3.2) ** 2 + (across / 1.8) ** 2 < 1) color = colors[(x + y + shift) % 3];
      }
      if (dx * dx + dy * dy < 2.5) color = colors[5];
      if (y > 9 && Math.abs(x - (10 - (y - 9) * .38)) < .7) color = colors[3];
      if ((x - 6) ** 2 / 11 + (y - 12) ** 2 / 3 < 1 || (x - 11) ** 2 / 12 + (y - 14) ** 2 / 4 < 1) color = colors[(x + y) % 2 ? 3 : 4];
      if (!color && ((x * 13 + y * 7 + shift * 11) % 31 === 0) && y > 1 && x > 2 && x < 18) color = colors[(x + y) % 6];
      list.push({ x, y, color });
    }
    return list;
  }
  function html(completions = 0, seed = "", demo = false) {
    const tiles = cells(seed), visible = tiles.filter(t => t.color).length;
    const earned = demo ? visible : Math.min(visible, completions * 8);
    let index = 0;
    return `<div class="mosaic-art ${demo ? "mosaic-demo" : ""}" role="img" aria-label="${demo ? "Example botanical mosaic" : completions + " completed tasks; " + earned + " coloured fragments"}">${tiles.map((t, i) => {
      const filled = t.color && index++ < earned;
      return `<span class="mosaic-tile ${t.color ? "tile-shape" : "tile-space"} ${filled ? "tile-earned" : ""}" style="--tile:${t.color || "transparent"};--tile-delay:${(i % 11) * 12}ms"></span>`;
    }).join("")}</div>`;
  }
  function records() { return POS.store.get().mosaics || {}; }
  function current() {
    const key = P.week(U.todayISO());
    return { key, ids: records()[key]?.taskIds || [] };
  }
  function toggle(id) {
    POS.store.actions.toggleTask(id);
  }
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-mosaic-demo]").forEach(el => { el.innerHTML = html(0, "botanical", true); });
    let demoDone = 0;
    const demo = document.getElementById("mosaic-interactive");
    const button = document.getElementById("demo-complete");
    if (demo && button) {
      demo.innerHTML = html(0, "botanical");
      button.addEventListener("click", () => {
        demoDone = demoDone >= 16 ? 0 : demoDone + 4;
        demo.innerHTML = html(demoDone, "botanical");
        document.getElementById("demo-progress").textContent = `${demoDone} example tasks completed. Your own canvas starts empty.`;
        button.textContent = demoDone >= 16 ? "Reset demonstration" : "Complete an example task";
      });
    }
  });
  POS.mosaic = { html, records, current, toggle };
})();
