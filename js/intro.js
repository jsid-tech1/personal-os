/*
 * Personal OS · Progress takes shape · 10 seconds, one continuous world.
 * Bang Motion starter architecture: fitted stage, camera rig, seekable GSAP timeline.
 * Brand: studio.css / original mosaic.cells("botanical"). No random or wall-clock render state.
 * Website adaptation: once per tab, silent, pause/skip, static reduced-motion fallback.
 */
(function () {
  "use strict";
  const root = document.documentElement;
  const query = new URLSearchParams(location.search);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const storageKey = "personal-os:intro-seen";
  const force = query.get("intro") === "1";
  let seen = false;
  try { seen = sessionStorage.getItem(storageKey) === "1"; } catch (_) { /* Storage is optional. */ }
  if (reduced.matches || query.get("intro") === "0" || (!force && (seen || location.hash))) return;

  root.classList.add("intro-pending");
  // A missing library, blocked file, or failed app boot must never hide the website.
  const safety = setTimeout(() => {
    if (!root.classList.contains("intro-running")) root.classList.remove("intro-pending");
  }, 4000);

  document.addEventListener("DOMContentLoaded", () => requestAnimationFrame(init), { once: true });

  function init() {
    const overlay = document.getElementById("site-intro");
    const welcome = document.getElementById("welcome");
    const gsap = window.gsap;
    if (!overlay || !welcome || welcome.hidden || reduced.matches || !gsap || !window.POS?.mosaic) {
      root.classList.remove("intro-pending");
      clearTimeout(safety);
      return;
    }

    const $ = selector => overlay.querySelector(selector);
    const world = $(".intro-world"), plan = $(".intro-plan"), mosaic = $(".intro-mosaic");
    const pause = $("#intro-pause"), skip = $("#intro-skip");
    const scrub = $("#intro-scrub"), clock = $("#intro-clock");
    const tasks = [...overlay.querySelectorAll(".intro-task")];
    const checks = [...overlay.querySelectorAll(".intro-check")];
    const statements = [...overlay.querySelectorAll(".intro-statement span")];
    const target = document.querySelector(".hero-art-grid .mosaic-art");
    const heroCopy = [...document.querySelectorAll(".welcome-copy > *")];
    const heroArt = document.querySelector(".hero-art");
    const heroExtras = [...document.querySelectorAll(".welcome-header, .hero-baseline")];
    let tl, ended = false, unsubscribe, resizeFrame;
    let W, H, fit;
    const debug = query.get("debug") === "1";
    const clean = query.get("clean") === "1";
    const inertBefore = welcome.inert;
    const previousFocus = document.activeElement;
    const skipLink = document.querySelector("body > .skip-link");
    const skipLinkInert = skipLink?.inert;

    const cells = window.POS.mosaic.cells("botanical").filter(cell => cell.color);
    cells.forEach(cell => {
      const tile = document.createElement("span");
      tile.className = "intro-tile";
      tile.style.cssText = `left:${cell.x * 5}%;top:${cell.y * 5}%;--tile:${cell.color}`;
      mosaic.append(tile);
    });
    const tiles = [...mosaic.children];

    function update() {
      const time = tl.time();
      scrub.value = time.toFixed(2);
      clock.value = `${time.toFixed(2)} / 10s`;
      pause.textContent = tl.paused() ? "Resume intro" : "Pause intro";
      pause.setAttribute("aria-pressed", String(tl.paused()));
    }

    function layout() {
      const portrait = innerWidth / innerHeight < .85;
      W = portrait ? 600 : 1440;
      H = portrait ? 1000 : 900;
      fit = Math.min(innerWidth / W, innerHeight / H);
      overlay.classList.toggle("is-portrait", portrait);
      overlay.style.setProperty("--intro-fit", fit);
      return portrait;
    }

    function build() {
      const portrait = layout();
      const size = portrait ? 490 : 500;
      const mx = portrait ? 55 : 470, my = portrait ? 165 : 150;
      const px = portrait ? 40 : 400, py = portrait ? 308 : 278;
      // Measure before applying the intro's own art transform. Convert back to stage space.
      gsap.set(heroArt, { clearProps: "opacity,transform" });
      const destination = target?.getBoundingClientRect();
      const left = (innerWidth - W * fit) / 2;
      const top = (innerHeight - H * fit) / 2;
      // Resolve the dock when the shot reaches it: late fonts/auth notices may
      // change the live hero's position after the opening frame was measured.
      const toX = () => target ? (target.getBoundingClientRect().left - left) / fit - mx : 0;
      const toY = () => target ? (target.getBoundingClientRect().top - top) / fit - my : 0;
      const toScale = destination?.width ? destination.width / (size * fit) : .8;
      const gap = target ? parseFloat(getComputedStyle(target).columnGap) / (toScale * fit) || 3 : 3;
      const tileSize = (size - gap * 19) / 20;
      tiles.forEach((tile, index) => {
        tile.style.left = `${cells[index].x * (tileSize + gap)}px`;
        tile.style.top = `${cells[index].y * (tileSize + gap)}px`;
        tile.style.width = tile.style.height = `${tileSize}px`;
      });

      tl = gsap.timeline({ paused: true, onUpdate: update, onComplete: finish });
      tl.set(world, { x: 0, y: 0, scale: portrait ? 1.06 : 1.18, transformOrigin: "50% 50%" }, 0)
        .set(plan, { opacity: 1, x: 0, y: 0, scale: 1 }, 0)
        .set(mosaic, { x: 0, y: 0, scale: 1, opacity: 1 }, 0)
        .set($(".intro-paper"), { opacity: 1 }, 0)
        .set($(".intro-light"), { x: -24, y: -16 }, 0)
        .set($(".intro-controls"), { opacity: 1 }, 0)
        .set($(".intro-progress"), { opacity: 1 }, 0)
        .set($(".intro-progress span"), { scaleX: 0 }, 0)
        .set(checks, { backgroundColor: "transparent", borderColor: "var(--line-strong)", scale: 1 }, 0)
        .set(checks.map(el => el.querySelector("path")), { strokeDashoffset: 28 }, 0)
        .set(tasks.map(el => el.querySelector(".intro-task-name")), { "--strike": 0, opacity: 1 }, 0)
        .set($(".intro-cursor"), { opacity: 0, x: 86, y: 24 }, 0)
        .set(statements, { opacity: 0, y: 28, filter: "blur(7px)" }, 0)
        .set(heroArt, { opacity: 0 }, 0)
        .set(heroCopy, { opacity: 0, y: 16 }, 0)
        .set(heroExtras, { opacity: 0 }, 0);

      // 0–3s: a close-up of real product UI, with two legible completion beats.
      tl.to(world, { scale: portrait ? 1.04 : 1.1, duration: 2.8, ease: "power1.inOut" }, 0)
        .to($(".intro-cursor"), { opacity: 1, x: -30, y: -92, duration: .8, ease: "power2.inOut" }, .45);
      checks.forEach((check, index) => {
        const at = 1.45 + index * .95;
        if (index) tl.to($(".intro-cursor"), { y: -14, duration: .5, ease: "power2.inOut" }, at - .55);
        tl.to(check, { scale: .88, duration: .12 }, at)
          .to(check, { scale: 1, backgroundColor: "var(--accent)", borderColor: "var(--accent)", duration: .25 }, at + .12)
          .to(check.querySelector("path"), { strokeDashoffset: 0, duration: .3, ease: "power2.out" }, at + .16)
          .to(tasks[index].querySelector(".intro-task-name"), { "--strike": 1, opacity: .58, duration: .4 }, at + .2);
      });

      // 3–7.8s: each earned fragment travels from a check to its exact botanical cell.
      // One world persists; no scene sections are faded on and off.
      tl.to($(".intro-cursor"), { opacity: 0, duration: .25 }, 2.9)
        .to(world, { scale: 1, duration: 1.5, ease: "power2.inOut" }, 3)
        .to(plan, { y: portrait ? 310 : 270, scale: .9, opacity: 0, duration: .8, ease: "power2.in" }, 3.05);
      tiles.forEach((tile, index) => {
        const cell = cells[index];
        const x = cell.x * (tileSize + gap), y = cell.y * (tileSize + gap);
        const order = ((cell.y * 7 + cell.x * 11) % 37) / 37;
        const at = 3.05 + order * 1.9;
        const fromX = px + 50 - mx - x;
        const fromY = py + 218 + (index % 2) * 78 - my - y;
        tl.fromTo(tile, { x: fromX, y: fromY, scale: .14, rotation: (index % 5 - 2) * 28, opacity: 0 },
          { x: (cell.x - 10) * 6, y: (cell.y - 10) * 5, scale: .86, rotation: 0, opacity: 1, duration: 1.25, ease: "power3.out", immediateRender: false }, at)
          .to(tile, { x: 0, y: 0, scale: 1, duration: 1.25, ease: "power2.inOut" }, 5.4 + order * .35);
      });
      // Explicit initial state also makes backwards scrubbing fully deterministic.
      tl.set(tiles, { opacity: 0 }, 0)
        .to(statements, { opacity: 1, y: 0, filter: "blur(0px)", duration: 1, stagger: .18, ease: "power3.out" }, 5.25)
        .to($(".intro-light"), { x: 46, y: 32, duration: 10, ease: "none" }, 0)
        .to($(".intro-progress span"), { scaleX: 1, duration: 10, ease: "none" }, 0);

      // 7.8–10s: the same mosaic docks into the live hero, rather than an end card.
      tl.to(statements, { opacity: 0, y: -18, filter: "blur(5px)", duration: .55, stagger: .06, ease: "power2.in" }, 7.8)
        .to(mosaic, { x: toX, y: toY, scale: toScale, duration: 1.55, ease: "power3.inOut" }, 8.05)
        .to($(".intro-paper"), { opacity: 0, duration: .85, ease: "power2.inOut" }, 8.65)
        .to(heroCopy, { opacity: 1, y: 0, duration: .7, stagger: .06, ease: "power3.out" }, 8.85)
        .to(heroExtras, { opacity: 1, duration: .65 }, 9)
        .to(heroArt, { opacity: 1, duration: .35 }, 9.6)
        .to(mosaic, { opacity: 0, duration: .35 }, 9.6)
        .to($(".intro-controls"), { opacity: 0, duration: .2 }, 9.8)
        .to($(".intro-progress"), { opacity: 0, duration: .2 }, 9.8);
      tl.time(0);
    }

    function finish() {
      if (ended) return;
      ended = true;
      const focusWasInside = overlay.contains(document.activeElement);
      tl?.kill();
      cancelAnimationFrame(resizeFrame);
      clearTimeout(safety);
      overlay.hidden = true;
      welcome.inert = inertBefore;
      if (skipLink) skipLink.inert = skipLinkInert;
      root.classList.remove("intro-pending", "intro-running");
      gsap.set([...heroCopy, ...heroExtras, heroArt], { clearProps: "opacity,transform" });
      window.removeEventListener("resize", onResize);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("visibilitychange", onVisibility);
      reduced.removeEventListener("change", onReduced);
      unsubscribe?.();
      if (focusWasInside && !welcome.hidden) {
        const destination = previousFocus && previousFocus !== document.body && !previousFocus.closest("[hidden]") ? previousFocus : document.getElementById("welcome-title");
        destination?.focus({ preventScroll: true });
      }
      window.dispatchEvent(new Event("pos:intro-complete"));
    }

    function seek(time) {
      if (ended) return;
      tl.pause().time(Math.max(0, Math.min(10, Number(time) || 0)), true);
      gsap.ticker.tick();
      update();
    }
    function togglePause() {
      if (ended) return;
      tl.paused(!tl.paused());
      update();
    }
    function onKey(event) {
      if (ended) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); finish(); }
      else if (event.key === " " && event.target === skip) return;
      else if (event.key === " " && event.target !== pause && !event.target.closest("input")) { event.preventDefault(); event.stopImmediatePropagation(); togglePause(); }
      else if (event.key.toLowerCase() === "r" && !event.target.closest("input")) { event.preventDefault(); event.stopImmediatePropagation(); tl.restart(); update(); }
      else if (event.key === "Tab") {
        const controls = [...overlay.querySelectorAll("button, input")].filter(el => el.getClientRects().length);
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        event.stopImmediatePropagation();
      }
    }
    function onResize() {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        if (ended) return;
        const time = tl.time(), paused = tl.paused();
        tl.kill();
        build();
        tl.time(time, true).paused(paused);
        update();
      });
    }
    function onVisibility() { if (document.hidden && !ended) { tl.pause(); update(); } }
    function onReduced() { if (reduced.matches) finish(); }

    try {
      overlay.hidden = false;
      welcome.inert = true;
      if (skipLink) skipLink.inert = true;
      build();
      root.classList.add("intro-running");
      root.classList.remove("intro-pending");
      clearTimeout(safety);
      try { sessionStorage.setItem(storageKey, "1"); } catch (_) { /* Play without persistence. */ }
      $("#intro-debug").hidden = !debug || clean;
      pause.addEventListener("click", togglePause);
      skip.addEventListener("click", finish);
      scrub.addEventListener("input", () => seek(scrub.value));
      document.addEventListener("keydown", onKey, true);
      document.addEventListener("visibilitychange", onVisibility);
      reduced.addEventListener("change", onReduced);
      window.addEventListener("resize", onResize);
      window.POS.intro = { duration: 10, seek, finish, play: () => { if (!ended) { tl.play(); update(); } }, pause: () => { if (!ended) { tl.pause(); update(); } }, get time() { return tl.time(); }, get running() { return !ended; } };
      window.OPENER = { ready: true, W, H, DUR: 10, seek, get tl() { return tl; } };
      skip.focus({ preventScroll: true });
      if (!clean && !debug) tl.play(0);
      update();
      // A restored authenticated session should go straight to work, never wait for branding.
      unsubscribe = window.POS.cloud?.subscribe(status => { if (status.user) finish(); });
      if (window.POS.cloud?.getStatus().user) finish();
      if (ended) unsubscribe?.();
    } catch (error) {
      finish();
      console.warn("Personal OS intro skipped:", error);
    }
  }
})();
