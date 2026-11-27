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
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "chrome" });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

async function open(t, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ...options });
  t.after(() => context.close());
  await context.route("https://www.gstatic.com/firebasejs/**", route => route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.goto(origin + "/?intro=0");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1000);
  return { page, flower: page.getByRole("button", { name: "Make the pixel flower bloom" }) };
}

const active = page => page.locator(".hero-art-grid .tile-earned").evaluateAll(tiles => tiles.flatMap(tile => tile.getAnimations()).filter(a => a.playState !== "finished").length);

test("pointer moves nearby fragments; leaving restores the exact composition", async t => {
  const { page, flower } = await open(t);
  const rect = await flower.boundingBox();
  await page.mouse.move(rect.x + rect.width * .52, rect.y + rect.height * .32);
  await page.waitForFunction(() => [...document.querySelectorAll(".hero-art-grid .tile-earned")].some(tile => Math.abs(parseFloat(tile.style.getPropertyValue("--flower-x"))) > .1));
  await page.mouse.move(0, 0);
  assert.equal(await flower.locator(".tile-earned").evaluateAll(tiles => tiles.every(tile => !tile.style.getPropertyValue("--flower-x"))), true);
});

test("clicks replay a bounded bloom; Enter and Space activate the same button", async t => {
  const { page, flower } = await open(t);
  for (let i = 0; i < 3; i++) await flower.click({ position: { x: 180, y: 130 } });
  assert.equal(await active(page), 121, "rapid clicks replace rather than stack ripples");
  await page.waitForFunction(() => document.querySelector(".hero-art-grid").getAnimations({ subtree: true }).every(a => a.playState === "finished"));
  await flower.focus();
  for (const key of ["Enter", "Space"]) {
    await page.keyboard.press(key);
    assert.equal(await active(page), 121);
    await page.waitForFunction(() => document.querySelector(".hero-art-grid").getAnimations({ subtree: true }).every(a => a.playState === "finished"));
  }
  assert.equal(await flower.evaluate(el => el.matches(":focus-visible")), true);
});

test("touch activates the flower without hover or horizontal overflow", async t => {
  const { page, flower } = await open(t, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await flower.tap({ position: { x: 160, y: 100 } });
  assert.equal(await active(page), 121);
  assert.equal(await flower.locator(".tile-earned").evaluateAll(tiles => tiles.every(tile => !tile.style.getPropertyValue("--flower-x"))), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
});

test("reduced motion keeps feedback non-spatial and preference changes cancel motion", async t => {
  const { page, flower } = await open(t, { reducedMotion: "reduce" });
  await flower.click();
  assert.equal(await flower.locator(".tile-earned").evaluateAll(tiles => tiles.every(tile => tile.getAnimations().every(a => a.effect.getKeyframes().every(frame => !("transform" in frame))))), true);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await flower.click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(() => document.querySelector(".hero-art-grid").getAnimations({ subtree: true }).length === 0);
  assert.equal(await active(page), 0);
});

test("flower motion frames", { skip: !process.env.FLOWER_SHOTS }, async t => {
  await fs.mkdir("test-results/flower", { recursive: true });
  for (const reducedMotion of ["no-preference", "reduce"]) {
    const { page, flower } = await open(t, { colorScheme: "dark", reducedMotion });
    await flower.evaluate(el => el.click());
    await flower.locator(".tile-earned").evaluateAll(tiles => tiles.forEach(tile => tile.getAnimations().filter(a => !(a instanceof CSSAnimation)).forEach(a => a.pause())));
    for (const time of [0, 80, 180, 320, 500, 800]) {
      await flower.locator(".tile-earned").evaluateAll((tiles, time) => tiles.forEach(tile => tile.getAnimations().filter(a => !(a instanceof CSSAnimation)).forEach(a => { a.currentTime = time; })), time);
      await page.locator(".hero-art").screenshot({ path: `test-results/flower/${reducedMotion}-${time}.png` });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator(".hero-art").screenshot({ path: `test-results/flower/${reducedMotion}-mobile.png` });
  }
});
