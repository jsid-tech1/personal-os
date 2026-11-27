/* One headless Chrome; no real authentication or production writes. */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

let browser, server, origin;
const root = path.resolve(__dirname, "..");
before(async () => {
  server = http.createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      const file = path.resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
      if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
      const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".otf": "font/otf", ".woff2": "font/woff2" };
      res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
      res.end(await fs.readFile(file));
    } catch (_) { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

async function open(t, options = {}) {
  const { url = "/?intro=1&clean=1", blockGSAP, blockStorage, ...contextOptions } = options;
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "light", reducedMotion: "no-preference", ...contextOptions });
  t.after(() => context.close());
  await context.route("https://www.gstatic.com/firebasejs/**", route => route.abort());
  if (blockGSAP) await context.route("**/assets/vendor/gsap.min.js*", route => route.abort());
  if (blockStorage) await context.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", { get() { throw new DOMException("Blocked", "SecurityError"); } });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.goto(origin + url);
  if (!blockGSAP && contextOptions.reducedMotion !== "reduce" && !url.includes("#") && !url.includes("intro=0")) {
    await page.waitForFunction(() => window.POS?.intro?.running);
  }
  await page.evaluate(() => document.fonts.ready);
  if (blockGSAP) await page.waitForFunction(() => !document.documentElement.classList.contains("intro-pending"));
  return { context, page };
}

test("10-second timeline: product completion, mosaic formation, deterministic seek, live-hero handoff", async t => {
  const { page } = await open(t);
  assert.equal(await page.evaluate(() => OPENER.tl.duration()), 10);
  assert.equal(await page.locator("#welcome").evaluate(el => el.inert), true);
  await page.evaluate(() => POS.intro.seek(2.9));
  const checks = await page.locator(".intro-check path").evaluateAll(els => els.map(el => parseFloat(getComputedStyle(el).strokeDashoffset)));
  assert.ok(checks.every(offset => offset < 1));
  await page.evaluate(() => POS.intro.seek(7.5));
  const snapshot = () => page.locator(".intro-tile").evaluateAll(els => els.map(el => el.style.cssText));
  const first = await snapshot();
  const tileCount = await page.locator(".intro-tile").count();
  assert.ok(tileCount > 80);
  assert.equal(await page.locator(".intro-tile").evaluateAll(els => els.every(el => +getComputedStyle(el).opacity === 1)), true);
  await page.evaluate(() => { POS.intro.seek(1); POS.intro.seek(7.5); });
  assert.deepEqual(await snapshot(), first, "backwards scrub restores the identical fragment state");
  await page.evaluate(() => POS.intro.seek(9.6));
  const geometry = await page.evaluate(() => {
    const a = document.querySelector(".intro-mosaic").getBoundingClientRect();
    const b = document.querySelector(".hero-art-grid .mosaic-art").getBoundingClientRect();
    return { dx: a.left - b.left, dy: a.top - b.top, dw: a.width - b.width };
  });
  assert.ok(Object.values(geometry).every(value => Math.abs(value) < 1), JSON.stringify(geometry));
  await page.evaluate(() => POS.intro.finish());
  assert.equal(await page.locator("#site-intro").isHidden(), true);
  assert.equal(await page.locator("#welcome").evaluate(el => el.inert), false);
  assert.equal(await page.locator("#welcome-title").evaluate(el => !!el.getClientRects().length), true);
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains("intro-running")), false);
});

test("pause, keyboard focus trap, Escape, and once-per-tab reload", async t => {
  const { page } = await open(t, { url: "/?intro=1&debug=1" });
  await page.locator("#intro-pause").click();
  await page.waitForFunction(() => POS.intro.time > .15);
  await page.locator("#intro-pause").click();
  const time = await page.evaluate(() => POS.intro.time);
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => POS.intro.time), time);
  await page.locator("#intro-pause").focus();
  await page.keyboard.press("Shift+Tab");
  assert.equal(await page.evaluate(() => document.activeElement.id), "intro-scrub");
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement.id), "intro-pause");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#site-intro").isHidden(), true);
  assert.equal(await page.evaluate(() => document.activeElement.id), "welcome-title");
  await page.goto(origin + "/");
  assert.equal(await page.locator("#site-intro").isHidden(), true);
  assert.equal(await page.evaluate(() => !!POS.intro), false);
});

test("autoplay finishes at ten seconds and restores the landing page", async t => {
  const { page } = await open(t, { url: "/?intro=1" });
  await page.waitForFunction(() => !POS.intro.running, undefined, { timeout: 13000 });
  assert.equal(await page.evaluate(() => POS.intro.time), 10);
  assert.equal(await page.locator("#welcome").evaluate(el => el.inert), false);
  assert.equal(await page.locator("#welcome-signin").evaluate(el => el.style.opacity), "");
});

test("responsive resize preserves playback and Skip restores page interaction", async t => {
  const { page } = await open(t);
  await page.evaluate(() => POS.intro.seek(6.4));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => document.querySelector("#site-intro").classList.contains("is-portrait"));
  assert.equal(await page.evaluate(() => POS.intro.time), 6.4);
  const text = await page.locator(".intro-statement").boundingBox();
  assert.ok(text.x >= 0 && text.x + text.width <= 390);
  await page.locator("#intro-skip").click();
  assert.equal(await page.locator("#welcome").evaluate(el => el.inert), false);
  assert.equal(await page.locator(".skip-link").evaluate(el => el.inert), false);
});

test("reduced motion, hash deep links, and missing GSAP never block entry", async t => {
  for (const options of [{ reducedMotion: "reduce" }, { url: "/#/today" }, { blockGSAP: true }, { url: "/?intro=0" }]) {
    const { page } = await open(t, options);
    assert.equal(await page.locator("#site-intro").isHidden(), true);
    assert.equal(await page.locator("#welcome").evaluate(el => el.inert), false);
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains("intro-pending")), false);
  }
});

test("blocked storage works; a reduced-motion change immediately cleans up", async t => {
  const { page } = await open(t, { blockStorage: true });
  assert.equal(await page.locator("#site-intro").isVisible(), true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(() => !POS.intro.running);
  assert.equal(await page.locator("#welcome").evaluate(el => el.inert), false);
});

test("keyframe captures at desktop, tablet and phone widths", { skip: !process.env.INTRO_SHOTS }, async t => {
  await fs.mkdir("test-results/intro", { recursive: true });
  const frames = [];
  for (const [width, height] of [[1440, 900], [1024, 768], [768, 1024], [390, 844], [320, 640]]) {
    const { page } = await open(t, { viewport: { width, height } });
    for (const time of [0, 1.9, 3.8, 5.9, 7.5, 8.9, 9.7]) {
      await page.evaluate(time => POS.intro.seek(time), time);
      const filename = `${width}-${time}.png`;
      await page.screenshot({ path: `test-results/intro/${filename}` });
      if (width === 1440 || width === 390) frames.push({ width, height, time, filename });
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.close();
  }
  // Review all selected frames in one image, rather than render/export a video.
  const page = await browser.newPage({ viewport: { width: 1440, height: 1600 } });
  await page.goto(origin + "/?intro=0");
  await page.setContent(`<html><body style="margin:0;padding:16px;background:#e9ede5;font:14px monospace;display:grid;grid-template-columns:repeat(4,1fr);gap:12px">${frames.map(frame => `<div><p>${frame.width}px · ${frame.time}s</p><img style="width:100%;height:280px;object-fit:contain;background:#f3f4f0" src="${origin}/test-results/intro/${frame.filename}"></div>`).join("")}</body></html>`);
  await page.locator("img").evaluateAll(els => Promise.all(els.map(el => el.decode())));
  await page.screenshot({ path: "test-results/intro/contact-sheet.png", fullPage: true });
  await page.close();
});
