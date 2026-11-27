/* Browser integration checks with Firebase's network boundary replaced by deterministic SDKs.
   No test authenticates a real user or writes to the production Firebase project. */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

let browser, server, origin;
const root = path.resolve(__dirname, "..");
const modules = {
  "firebase-app.js": `
    let app;
    export const getApps = () => app ? [app] : [];
    export const getApp = () => app;
    export const initializeApp = config => (app = { config });`,
  "firebase-auth.js": `
    const auth = { currentUser: JSON.parse(sessionStorage.getItem('test-auth') || 'null'), authStateReady: async () => {
      if (window.testDelayAuth) await new Promise(resolve => { window.mock.resolveAuth = resolve; });
    } };
    let changed;
    export const getAuth = () => { if (auth.currentUser) auth.currentUser.getIdToken = async () => 'test-token'; return auth; };
    export const getRedirectResult = async () => null;
    export const signInWithRedirect = async () => { window.mock.redirectStarted = true; };
    export const onAuthStateChanged = (a, fn) => { changed = fn; fn(a.currentUser); };
    export class GoogleAuthProvider { setCustomParameters(params) { window.mock.provider = params; } }
    export async function signInWithPopup() {
      if (window.mock.authError) throw { code: window.mock.authError };
      auth.currentUser = { uid: window.mock.uid, email: window.mock.email, displayName: 'Test User', getIdToken: async () => 'test-token' };
      sessionStorage.setItem('test-auth', JSON.stringify(auth.currentUser));
      changed(auth.currentUser);
    }
    export async function signOut() { auth.currentUser = null; sessionStorage.removeItem('test-auth'); changed(null); }
    window.mock.forceSignOut = signOut;
    window.mock.changeAccount = uid => {
      auth.currentUser = { uid, email: uid + '@example.test', getIdToken: async () => 'test-token' };
      changed(auth.currentUser);
    };`,
  "firebase-firestore-lite.js": `
    export const getFirestore = () => ({});
    export const doc = (db, ...parts) => parts.join('/');
    export const serverTimestamp = () => 'SERVER_TIMESTAMP';
    export async function setDoc(ref, data) {
      if (window.mock.dbError) throw { code: window.mock.dbError };
      if (ref.includes('/backups/')) window.mock.writes.push({ ref, data });
      else (window.mock.syncWrites ||= []).push({ ref, data });
      window.mock.docs[ref] = structuredClone(data);
    }
    export async function runTransaction(db, action) {
      const writes = [];
      const result = await action({ get: getDoc, set: (ref, data) => writes.push([ref, data]) });
      for (const [ref, data] of writes) await setDoc(ref, data);
      return result;
    }
    export async function getDoc(ref) {
      if (window.mock.dbError) throw { code: window.mock.dbError };
      const data = window.mock.docs[ref];
      return { exists: () => !!data, data: () => structuredClone(data) };
    }`,
  "firebase-analytics.js": `
    export async function isSupported() { return !window.mock.analyticsBlocked; }
    export function getAnalytics() { window.mock.analyticsStarted = true; return {}; }`,
};

before(async () => {
  server = http.createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      const file = path.resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
      if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
      const type = { ".js": "text/javascript", ".html": "text/html", ".css": "text/css", ".ttf": "font/ttf" }[path.extname(file)];
      res.setHeader("Content-Type", type || "application/octet-stream");
      res.end(await fs.readFile(file));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === "win32" ? "msedge" : undefined) });
});

after(async () => {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

async function open(t, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce", ...options });
  t.after(() => context.close());
  await context.addInitScript(() => {
    window.mock = { uid: "alice", email: "alice@example.test", writes: [], docs: {} };
  });
  await context.route("https://www.gstatic.com/firebasejs/**", route => {
    const name = new URL(route.request().url()).pathname.split("/").pop();
    return route.fulfill({ contentType: "text/javascript", body: modules[name], headers: { "Access-Control-Allow-Origin": "*" } });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.goto(origin + "/#/settings");
  await page.waitForFunction(() => POS.cloud.getStatus().ready);
  return { page, context };
}

async function signIn(page) {
  if (await page.locator("#welcome").isVisible()) await page.locator("#welcome-signin").click();
  await page.locator("#s-cloud-save").waitFor();
  await page.waitForFunction(() => !POS.cloud.getStatus().busy);
}

test("DeepSeek goal draft reviews milestones and only saves after approval", async t => {
  const { page } = await open(t);
  await signIn(page);
  let sent;
  await page.route("**/api/plan", route => {
    sent = route.request().postDataJSON();
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ title: "Design presentation", steps: [
      { title: "Outline the story", duration: 30, milestone: "Shape the story" },
      { title: "Build the slides", duration: 45, milestone: "Build and verify" },
      { title: "Rehearse and export", duration: 20, milestone: "Build and verify" },
    ] }) });
  });
  await page.evaluate(() => { location.hash = "#/goal"; });
  await page.locator("#g-title").fill("Prepare my design presentation");
  await page.locator("#g-desc").fill("Use the sketches I already have");
  await page.locator("#g-cap").fill("120");
  await page.locator("#g-draft").click();
  await page.locator("#g-approve").waitFor();
  assert.deepEqual(sent, { description: "Prepare my design presentation\n\nUse the sketches I already have", capacity: 120 });
  assert.equal(await page.locator(".ms").count(), 2);
  assert.equal(await page.locator(".plan-task").count(), 3);
  assert.equal(await page.evaluate(() => POS.store.get().tasks.length), 0);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: "test-results/deepseek-goal-desktop.png", fullPage: true });
  await page.locator("#g-edit").click();
  await page.locator('[data-edit-title="0-0"]').fill("Outline my presentation story");
  await page.locator("#g-approve").click();
  await page.locator("[data-yes]").click();
  await page.waitForFunction(() => POS.store.get().tasks.length === 3);
  assert.equal(await page.evaluate(() => POS.store.get().tasks[0].title), "Outline my presentation story");
  assert.equal(await page.evaluate(() => POS.store.get().projects[0].milestones.length), 2);
});

test("DeepSeek goal errors stay visible on mobile and on-device fallback is explicit", async t => {
  const { page } = await open(t, { viewport: { width: 390, height: 844 } });
  await signIn(page);
  await page.route("**/api/plan", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "The DeepSeek account has insufficient balance. Choose On-device templates." }) }));
  await page.evaluate(() => { location.hash = "#/goal"; });
  await page.locator("#g-title").fill("Finish my design portfolio");
  await page.locator("#g-draft").click();
  await page.locator('.goal-form [role="alert"]:not([hidden])').waitFor();
  assert.match(await page.locator('.goal-form [role="alert"]').innerText(), /insufficient balance/);
  assert.equal(await page.locator("#g-approve").count(), 0);
  assert.equal(await page.evaluate(() => POS.store.get().tasks.length), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: "test-results/deepseek-goal-mobile-error.png", fullPage: true });
  await page.locator("#g-provider").selectOption("local");
  await page.locator("#g-draft").click();
  await page.locator("#g-approve").waitFor();
  assert.match(await page.locator(".page-sub").innerText(), /On-device draft/);
  assert.equal(await page.evaluate(() => POS.store.get().tasks.length), 0);
});

test("DeepSeek goal approval rechecks edited dates and changed calendar capacity", async t => {
  const { page } = await open(t);
  await signIn(page);
  await page.route("**/api/plan", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ title: "Design presentation", steps: [{ title: "Draft the presentation", duration: 60, milestone: "Draft" }] }) }));
  await page.evaluate(() => { location.hash = "#/goal"; });
  await page.locator("#g-title").fill("Prepare my design presentation");
  await page.locator("#g-cap").fill("60");
  await page.locator("#g-draft").click();
  await page.locator("#g-approve").waitFor();
  await page.locator("#g-edit").click();
  await page.locator('[data-edit-date="0-0"]').fill("2020-01-01");
  await page.locator("#g-approve").click();
  assert.equal(await page.locator("[data-yes]").count(), 0);
  assert.equal(await page.evaluate(() => POS.store.get().tasks.length), 0);
  const original = await page.locator("#g-date").inputValue();
  const workingDay = await page.evaluate(deadline => { let date = deadline; while ([0, 6].includes(new Date(date + "T12:00").getDay())) date = POS.planning.add(date, -1); return date; }, original);
  await page.locator('[data-edit-date="0-0"]').fill(workingDay);
  await page.evaluate(date => POS.store.actions.addTask({ title: "Existing commitment", date, duration: 60 }), workingDay);
  await page.locator("#g-approve").click();
  assert.equal(await page.locator("[data-yes]").count(), 0);
  assert.equal(await page.evaluate(() => POS.store.get().tasks.length), 1);
});

test("DeepSeek goal drafts disappear when the account changes", async t => {
  const { page } = await open(t);
  await signIn(page);
  await page.route("**/api/plan", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ title: "Alice private goal", steps: [{ title: "Private draft", duration: 30, milestone: "Private milestone" }] }) }));
  await page.evaluate(() => { location.hash = "#/goal"; });
  await page.locator("#g-title").fill("Alice private goal description");
  await page.locator("#g-draft").click();
  await page.locator("#g-approve").waitFor();
  await page.evaluate(() => mock.changeAccount("bob"));
  await page.waitForFunction(() => POS.cloud.getStatus().user?.uid === "bob");
  await page.locator("#g-title").waitFor();
  assert.equal(await page.locator("#g-approve").count(), 0);
  assert.equal(await page.locator("#g-title").inputValue(), "");
  assert.equal(await page.evaluate(() => POS.store.get().tasks.length), 0);
});

test("initialization and Google sign-in preserve local work; explicit backup is account-scoped", async t => {
  const { page } = await open(t);
  await page.evaluate(() => POS.store.actions.addTask({ title: "Local task to preserve" }));
  await page.evaluate(() => POS.store.flush());
  const local = await page.evaluate(() => JSON.stringify(POS.store.get()));
  await signIn(page);
  assert.equal(await page.evaluate(() => JSON.stringify(POS.store.get())), local);
  assert.equal(await page.evaluate(() => mock.writes.length), 0);
  await page.locator("#s-cloud-save").click();
  await page.waitForFunction(() => !!POS.cloud.getStatus().lastSaved);
  const write = await page.evaluate(() => mock.writes[0]);
  assert.equal(write.ref, "users/alice/backups/workspace");
  assert.equal(write.data.payload, local);
  assert.equal(write.data.updatedAt, "SERVER_TIMESTAMP");
  assert.equal(write.data.schemaVersion, 1);
  assert.deepEqual(await page.evaluate(() => mock.provider), { prompt: "select_account" });
  await page.locator("#s-cloud").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/firebase-desktop.png" });
  await page.locator("#s-cloud-signout").click();
  await page.locator("#welcome-signin").waitFor();
  assert.equal(await page.locator("#app").isVisible(), false);
  assert.equal(await page.evaluate(() => JSON.stringify(POS.store.get())), local);
  await page.evaluate(() => { mock.uid = "bob"; mock.email = "bob@example.test"; });
  await signIn(page);
  assert.equal(await page.evaluate(() => POS.store.get().tasks.length), 0, "legacy work is adopted only once");
  await page.evaluate(() => mock.changeAccount("alice"));
  assert.equal(await page.evaluate(() => JSON.stringify(POS.store.get())), local);
});

test("restore confirms replacement, cancellation preserves work, restored data survives reload", async t => {
  const { page } = await open(t);
  await signIn(page);
  await page.locator("#s-cloud-save").click();
  await page.waitForFunction(() => !POS.cloud.getStatus().busy);
  await page.evaluate(() => POS.store.actions.addTask({ title: "Only on this device" }));
  await page.locator("#s-cloud-restore").click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(await page.evaluate(() => POS.store.get().tasks.some(t => t.title === "Only on this device")), true);
  await page.locator("#s-cloud-restore").click();
  await page.locator(".modal [data-yes]").click();
  await page.waitForFunction(() => !POS.cloud.getStatus().busy);
  assert.equal(await page.evaluate(() => POS.store.get().tasks.some(t => t.title === "Only on this device")), false);
  await page.reload();
  assert.equal(await page.evaluate(() => POS.store.get().tasks.some(t => t.title === "Only on this device")), false);
});

test("another account cannot restore the first account's snapshot", async t => {
  const { page } = await open(t);
  await signIn(page);
  await page.evaluate(() => POS.cloud.saveBackup());
  await page.evaluate(() => { mock.changeAccount("bob"); });
  const result = await page.evaluate(async () => {
    try { await POS.cloud.restoreBackup(async () => true); } catch (e) { return e.message; }
  });
  assert.match(result, /No cloud backup exists/);
  assert.equal(await page.evaluate(() => mock.writes.length), 1);
});

test("restore rejects a changed account or local edits while confirmation is open", async t => {
  const { page } = await open(t);
  await signIn(page);
  const accountError = await page.evaluate(async () => {
    await POS.cloud.saveBackup();
    try {
      await POS.cloud.restoreBackup(async () => { mock.changeAccount("bob"); return true; });
    } catch (e) { return e.message; }
  });
  assert.match(accountError, /account changed/);
  const editError = await page.evaluate(async () => {
    mock.changeAccount("alice");
    try {
      await POS.cloud.restoreBackup(async () => { POS.store.actions.addTask({ title: "Concurrent edit" }); return true; });
    } catch (e) { return e.message; }
  });
  assert.match(editError, /workspace changed/);
  assert.equal(await page.evaluate(() => POS.store.get().tasks.some(t => t.title === "Concurrent edit")), true);
});

test("malformed and oversized snapshots are rejected without losing local data", async t => {
  const { page } = await open(t);
  await signIn(page);
  const local = await page.evaluate(() => JSON.stringify(POS.store.get()));
  for (const payload of ["not json", JSON.stringify({ version: 1, tasks: [], projects: [] })]) {
    const error = await page.evaluate(async payload => {
      mock.docs["users/alice/backups/workspace"] = { schemaVersion: 1, payload };
      try { await POS.cloud.restoreBackup(async () => true); } catch (e) { return e.message; }
    }, payload);
    assert.match(error, /Nothing was replaced/);
    assert.equal(await page.evaluate(() => JSON.stringify(POS.store.get())), local);
  }
  const sizeError = await page.evaluate(async () => {
    POS.store.actions.addNote({ title: "Large note", body: "x".repeat(900000) });
    try { await POS.cloud.saveBackup(); } catch (e) { return e.message; }
  });
  assert.match(sizeError, /900 KB/);
  assert.equal(await page.evaluate(() => mock.writes.length), 0);
});

test("auth and permission errors are actionable; offline work continues", async t => {
  const { page, context } = await open(t);
  await page.evaluate(() => { mock.authError = "auth/operation-not-allowed"; });
  await page.locator("#welcome-signin").click();
  await page.waitForFunction(() => !!POS.cloud.getStatus().error);
  assert.match(await page.locator("#welcome-error").innerText(), /Enable Google sign-in/);
  await page.evaluate(() => { mock.authError = null; });
  await signIn(page);
  await page.evaluate(() => { mock.dbError = "permission-denied"; });
  await page.locator("#s-cloud-save").click();
  await page.waitForFunction(() => !!POS.cloud.getStatus().error);
  assert.match(await page.locator("#s-cloud [role=alert]").innerText(), /Publish firestore.rules/);
  assert.equal(await page.evaluate(() => mock.writes.length), 0);
  await context.setOffline(true);
  const error = await page.evaluate(async () => {
    POS.store.actions.addTask({ title: "Offline edit" });
    POS.store.flush();
    try { await POS.cloud.saveBackup(); } catch (e) { return e.message; }
  });
  assert.match(error, /offline/);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem(POS.store.storageKey())).tasks.some(t => t.title === "Offline edit")), true);
});

test("SDK loading failure keeps workspace locked and retry can initialize Firebase", async t => {
  const { page, context } = await open(t);
  await context.route("**/firebase-auth.js", route => route.abort());
  await page.reload();
  await page.waitForFunction(() => !POS.cloud.getStatus().busy);
  assert.equal(await page.evaluate(() => POS.cloud.getStatus().ready), false);
  assert.equal(await page.locator("#app").isVisible(), false);
  assert.equal(await page.locator("#welcome-retry").isVisible(), true);
  await context.unroute("**/firebase-auth.js");
  await page.locator("#welcome-retry").click();
  await page.waitForFunction(() => POS.cloud.getStatus().ready, {}, { timeout: 5000 });
});

test("cloud settings stay usable at mobile widths and preserve unsaved profile text", async t => {
  const { page } = await open(t, { viewport: { width: 390, height: 844 }, colorScheme: "dark" });
  await page.evaluate(() => { mock.email = "a-very-long-google-account-name-for-mobile-testing@example.test"; });
  await signIn(page);
  await page.locator("#s-name").fill("Unsaved profile text");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.locator("#s-cloud-save").click();
  await page.waitForFunction(() => !POS.cloud.getStatus().busy);
  assert.equal(await page.locator("#s-name").inputValue(), "Unsaved profile text");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.locator("#s-cloud").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/firebase-mobile-dark.png" });
});

test("blocked Analytics does not prevent sign-in or cloud backup", async t => {
  const { page, context } = await open(t);
  await context.route("**/firebase-analytics.js", route => route.abort());
  await page.reload();
  await page.waitForFunction(() => POS.cloud.getStatus().analytics === "unavailable");
  assert.equal(await page.evaluate(() => POS.cloud.getStatus().ready), true);
  await signIn(page);
  await page.locator("#s-cloud-save").click();
  await page.waitForFunction(() => !!POS.cloud.getStatus().lastSaved);
  assert.equal(await page.evaluate(() => mock.writes.length), 1);
});

test("welcome requires Google sign-in and protects routes and keyboard shortcuts", async t => {
  const { page } = await open(t);
  assert.equal(await page.locator("#welcome").isVisible(), true);
  assert.equal(await page.locator("#app").isVisible(), false);
  assert.equal(await page.locator("#main").innerHTML(), "");
  await page.screenshot({ path: "test-results/welcome-desktop-light.png" });
  await page.keyboard.press("Control+k");
  assert.equal(await page.locator(".palette-wrap").count(), 0);
  await page.evaluate(() => { location.hash = "#/notes"; POS.app.render(); });
  assert.equal(await page.locator("#main").innerHTML(), "");
  await page.locator("#welcome-signin").focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => !document.getElementById("app").hidden);
  assert.match(await page.title(), /Notes/);
  assert.equal(await page.locator("#welcome").isVisible(), false);
  assert.equal(await page.locator("#main").evaluate(el => el === document.activeElement), true);
});

test("returning sessions enter their route after auth resolves without rendering work early", async t => {
  const { page, context } = await open(t);
  await signIn(page);
  await context.addInitScript(() => { window.testDelayAuth = true; });
  await page.reload();
  await page.waitForFunction(() => typeof mock.resolveAuth === "function");
  assert.equal(await page.locator("#app").isVisible(), false);
  assert.equal(await page.locator("#main").innerHTML(), "");
  assert.equal(await page.locator("#welcome-signin").isEnabled(), true);
  assert.match(await page.locator("#welcome-signin-label").innerText(), /Connecting/);
  await page.evaluate(() => mock.resolveAuth());
  await page.locator("#s-name").waitFor();
  assert.equal(await page.locator("#welcome").isVisible(), false);
  assert.match(await page.title(), /Profile/);
});

test("profile logout returns to welcome and preserves account work", async t => {
  const { page } = await open(t, { viewport: { width: 390, height: 844 } });
  await signIn(page);
  await page.locator("#s-name").fill("Profile logout check");
  await page.locator("#s-save-profile").click();
  const logout = page.locator("#set-profile #s-profile-logout");
  assert.equal(await logout.isEnabled(), true);
  await logout.click();
  await page.locator("#welcome").waitFor();
  assert.equal(await page.locator("#app").isVisible(), false);
  assert.equal(await page.evaluate(() => POS.cloud.getStatus().user), null);
  await signIn(page);
  assert.equal(await page.locator("#s-name").inputValue(), "Profile logout check");
});

test("sign-out closes open dialogs and returns keyboard focus to welcome", async t => {
  const { page } = await open(t);
  await signIn(page);
  await page.evaluate(() => POS.cloud.saveBackup());
  await page.locator("#s-cloud-restore").click();
  await page.locator(".modal [data-yes]").waitFor();
  await page.evaluate(() => mock.forceSignOut());
  await page.waitForFunction(() => !POS.cloud.getStatus().busy);
  assert.equal(await page.locator(".modal-wrap").count(), 0);
  assert.equal(await page.locator("#main").innerHTML(), "");
  assert.equal(await page.locator("#welcome-title").evaluate(el => el === document.activeElement), true);
  await signIn(page);
  await page.locator("#search-btn").click();
  await page.evaluate(() => mock.forceSignOut());
  await page.keyboard.press("Enter");
  assert.equal(await page.locator(".palette-wrap, .sheet-wrap").count(), 0);
  assert.equal(await page.locator("#welcome").isVisible(), true);
});

test("welcome supports dark mode, narrow screens, cancelled sign-in and retry", async t => {
  const { page } = await open(t, { viewport: { width: 390, height: 844 }, colorScheme: "dark" });
  await page.screenshot({ path: "test-results/welcome-mobile-dark.png" });
  await page.locator("#welcome-theme-btn").click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
  await page.locator("#welcome-theme-btn").click();
  for (const [width, height] of [[1440, 900], [1024, 768], [820, 1180], [768, 1024], [390, 844]]) {
    await page.setViewportSize({ width, height });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}px welcome fits`);
    assert.equal(await page.locator(".hero-art .mosaic-tile").count(), 400);
    assert.equal(await page.locator(".product-live-preview").count(), 1);
    const cta = await page.locator("#welcome-signin").boundingBox();
    assert.ok(cta.y + cta.height <= height, `${width}px signup remains above the fold`);
    await page.screenshot({ path: `test-results/welcome-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 320, height: 700 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.evaluate(() => { mock.authError = "auth/popup-closed-by-user"; });
  await page.locator("#welcome-signin").click();
  await page.waitForFunction(() => !!POS.cloud.getStatus().error);
  assert.match(await page.locator("#welcome-error").innerText(), /cancelled/);
  assert.equal(await page.locator("#welcome-signin").isEnabled(), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.evaluate(() => { mock.authError = null; });
  await signIn(page);
  assert.equal(await page.locator("#theme-btn").getAttribute("aria-pressed"), "true");
});

test("first-time AI review saves only after approval, populates calendar and earns a real mosaic", async t => {
  const { page } = await open(t);
  await page.route("**/api/plan", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ title: "Typography project", steps: [{ title: "Gather type references", duration: 30 }, { title: "Refine letterforms", duration: 45 }, { title: "Prepare the presentation", duration: 30 }] }) }));
  await page.evaluate(() => { location.hash = "#/today"; });
  await page.locator("#welcome-signin").click();
  await page.getByRole("button", { name: "Add your first task", exact: true }).waitFor();
  assert.equal(await page.evaluate(() => POS.store.get().tasks.length), 0);
  assert.equal(await page.evaluate(() => POS.store.get().settings.name), "Test User");
  await page.getByRole("button", { name: "Add your first task", exact: true }).click();
  await page.locator("#plan-description").fill("Finish my typography project with research, letterforms and presentation");
  await page.locator("#plan-generate").click();
  await page.locator("#plan-approve").waitFor();
  assert.equal(await page.evaluate(() => POS.store.get().tasks.length), 0);
  await page.locator('.plan-step [name="title"]').first().fill("Gather typography references");
  await page.locator("#plan-approve").click();
  await page.locator(".week-grid").waitFor();
  assert.equal(await page.evaluate(() => POS.store.get().tasks.length), 3);
  await page.getByRole("checkbox", { name: "Complete Gather typography references", exact: true }).click();
  assert.equal(await page.evaluate(() => POS.store.get().tasks[0].done), true);
  assert.equal(await page.evaluate(() => POS.mosaic.current().ids.length), 1);
  await page.evaluate(() => { location.hash = "#/mosaic"; });
  await page.locator(".mosaic-canvas").waitFor();
  assert.equal(await page.locator(".mosaic-canvas .tile-earned").count(), 8);
  await page.evaluate(() => POS.cloud.saveBackup());
  await page.waitForFunction(() => !!POS.cloud.getStatus().lastSaved);
  const snapshot = await page.evaluate(() => JSON.parse(mock.docs["users/alice/backups/workspace"].payload));
  assert.equal(snapshot.tasks[0].title, "Gather typography references");
  assert.equal(snapshot.tasks[0].done, true);
  await page.reload();
  await page.locator(".mosaic-canvas").waitFor();
  assert.equal(await page.evaluate(() => POS.store.get().tasks[0].done), true);
  assert.equal(await page.locator(".mosaic-canvas .tile-earned").count(), 8);
  await page.screenshot({ path: "test-results/first-use-desktop.png" });
});

test("account changes isolate local tasks, drafts and stored work, including after reload", async t => {
  const { page } = await open(t);
  await signIn(page);
  await page.evaluate(() => POS.store.actions.addTask({ title: "Alice private task" }));
  await page.locator("#search-btn").click();
  await page.evaluate(() => mock.changeAccount("bob"));
  assert.equal(await page.locator(".palette-wrap").count(), 0);
  assert.equal(await page.evaluate(() => POS.store.get().tasks.length), 0);
  await page.evaluate(() => POS.store.actions.addTask({ title: "Bob private task" }));
  await page.evaluate(() => mock.changeAccount("alice"));
  assert.deepEqual(await page.evaluate(() => POS.store.get().tasks.map(task => task.title)), ["Alice private task"]);
  await page.reload();
  await page.locator("#s-cloud-save").waitFor();
  assert.deepEqual(await page.evaluate(() => POS.store.get().tasks.map(task => task.title)), ["Alice private task"]);
  await page.evaluate(() => mock.changeAccount("bob"));
  assert.deepEqual(await page.evaluate(() => POS.store.get().tasks.map(task => task.title)), ["Bob private task"]);
});

test("empty screens and manual planning work on a narrow phone without AI credentials", async t => {
  const { page } = await open(t, { viewport: { width: 390, height: 844 } });
  await signIn(page);
  for (const route of ["today", "tasks", "calendar", "mosaic", "focus", "settings"]) {
    await page.evaluate(route => { location.hash = "#/" + route; POS.app.render(); }, route);
    assert.equal(await page.locator("#err-reload").count(), 0, route);
  }
  await page.evaluate(() => { location.hash = "#/today"; });
  await page.getByRole("button", { name: "Add your first task", exact: true }).waitFor();
  await page.setViewportSize({ width: 320, height: 700 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.getByRole("button", { name: "Add your first task", exact: true }).click();
  await page.locator("#plan-description").fill("Prepare my presentation");
  await page.locator("#plan-manual").click();
  await page.locator('.plan-step [name="title"]').fill("Prepare presentation outline");
  assert.match(await page.locator("#plan-message").innerText(), /no AI was used/);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: "test-results/plan-mobile.png", fullPage: true });
  await page.locator("#plan-approve").click();
  await page.locator(".week-grid").waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: "test-results/first-use-mobile.png", fullPage: true });
});

test("storage failure is visible and retry preserves the unsaved task", async t => {
  const { page } = await open(t);
  await signIn(page);
  await page.evaluate(() => {
    window.realSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("personal-os:v1:user:")) throw new DOMException("Quota exceeded", "QuotaExceededError");
      return window.realSetItem.call(this, key, value);
    };
    POS.store.actions.addTask({ title: "Keep this unsaved task" });
    POS.store.flush();
  });
  assert.equal(await page.locator("#storage-error").isVisible(), true);
  await page.evaluate(() => { Storage.prototype.setItem = window.realSetItem; });
  await page.locator("#storage-retry").click();
  assert.equal(await page.locator("#storage-error").isVisible(), false);
  await page.reload();
  await page.locator("#s-cloud-save").waitFor();
  assert.equal(await page.evaluate(() => POS.store.get().tasks[0].title), "Keep this unsaved task");
});

test("landing product screenshot is real app UI", { skip: !process.env.UPDATE_PRODUCT_PREVIEW }, async t => {
  const { page } = await open(t, { viewport: { width: 1440, height: 760 } });
  await signIn(page);
  await page.evaluate(() => { POS.store.importState(POS.buildSeed()); location.hash = "#/today"; });
  await page.locator(".studio-dashboard-grid").waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: "assets/product-today.png" });
});

test("Firestore loading failure does not prevent Google sign-in", async t => {
  const { page, context } = await open(t);
  await context.route("**/firebase-firestore-lite.js", route => route.abort());
  await page.reload();
  await page.waitForFunction(() => POS.cloud.getStatus().ready);
  await signIn(page);
  assert.equal(await page.locator("#app").isVisible(), true);
  const message = await page.evaluate(async () => {
    try { await POS.cloud.saveBackup(); } catch (error) { return error.message; }
  });
  assert.ok(message);
  assert.equal(await page.evaluate(() => POS.cloud.getStatus().ready), true);
  assert.equal(await page.locator("#app").isVisible(), true);
});

test("a stalled auth session times out visibly and connection retry recovers", async t => {
  const { page, context } = await open(t);
  await context.addInitScript(() => { window.testDelayAuth = true; });
  await page.clock.install();
  await page.reload();
  await page.waitForFunction(() => typeof mock.resolveAuth === "function");
  await page.locator("#welcome-signin").click();
  assert.match(await page.locator("#welcome-status").innerText(), /Connecting to Google/);
  await page.clock.fastForward(13000);
  await page.locator("#welcome-retry").waitFor();
  assert.match(await page.locator("#welcome-error").innerText(), /too long/);
  assert.equal(await page.locator("#welcome-signin").isEnabled(), true);
  await page.evaluate(() => { window.testDelayAuth = false; mock.resolveAuth(); });
  await page.locator("#welcome-retry").click();
  await page.waitForFunction(() => POS.cloud.getStatus().ready);
  await signIn(page);
});

test("blocked popup offers same-tab sign-in; the header action uses the same auth flow", async t => {
  const { page } = await open(t);
  await page.evaluate(() => { mock.authError = "auth/popup-blocked"; });
  await page.locator(".welcome-nav-signin").click();
  await page.locator("#welcome-redirect").waitFor();
  await page.locator("#welcome-redirect").click();
  assert.equal(await page.evaluate(() => mock.redirectStarted), true);
  await page.evaluate(() => { mock.authError = null; });
  await signIn(page);
});

test("versioned assets bypass old entry files and missing app code exposes recovery", async t => {
  const { page, context } = await open(t);
  await context.route("**/css/welcome.css", route => route.fulfill({ contentType: "text/css", body: ".welcome-main { display:grid; grid-template-columns:1fr 1fr; }" }));
  await context.route("**/js/welcome.js", route => route.fulfill({ contentType: "text/javascript", body: "/* stale cached file */" }));
  await page.reload();
  await page.waitForFunction(() => POS.cloud.getStatus().ready);
  assert.equal(await page.locator(".welcome-copy").evaluate(element => getComputedStyle(element).textAlign), "left");
  const versions = await page.evaluate(() => [...document.querySelectorAll('script[src^="js/"], link[href^="css/"]')].every(element => new URL(element.src || element.href).searchParams.has("v")));
  assert.equal(versions, true);
  await signIn(page);
  await page.evaluate(() => mock.forceSignOut());
  await context.route("**/js/app.js?*", route => route.abort());
  await page.reload();
  await page.locator("#welcome-reload").waitFor();
  assert.match(await page.locator("#welcome-error").innerText(), /app files did not load/);
  await context.unroute("**/js/app.js?*");
  await page.locator("#welcome-reload").click();
  await page.waitForFunction(() => window.POS?.cloud?.getStatus().ready);
  await signIn(page);
});

test("automatic sync writes account state and detects another device without losing local edits", async t => {
  const { page } = await open(t);
  await signIn(page);
  await page.waitForFunction(() => mock.syncWrites?.length > 0);
  await page.evaluate(() => POS.store.actions.addTask({ title: "My local idea" }));
  await page.waitForFunction(() => mock.syncWrites?.some(w => JSON.parse(w.data.payload).tasks.some(t => t.title === "My local idea")));
  const before = await page.evaluate(() => POS.store.get().tasks.length);
  await page.evaluate(async () => {
    const ref = "users/alice/state/workspace", saved = mock.docs[ref];
    const remote = JSON.parse(saved.payload);
    remote.tasks.push({ ...remote.tasks[0], id: "remote-task", title: "Other device idea" });
    mock.docs[ref] = { ...saved, revision: saved.revision + 1, payload: JSON.stringify(remote) };
    POS.store.actions.addTask({ title: "Unsynced local idea" });
    await POS.sync.refresh();
  });
  assert.match(await page.evaluate(() => POS.sync.status().error), /Another device/);
  assert.equal(await page.evaluate(() => POS.store.get().tasks.length), before + 1);
  assert.equal(await page.evaluate(() => POS.store.get().tasks.some(t => t.title === "Other device idea")), false);
  await page.evaluate(() => POS.sync.refresh("remote"));
  assert.equal(await page.evaluate(() => POS.store.get().tasks.some(t => t.title === "Other device idea")), true);
  assert.equal(await page.evaluate(() => POS.store.get().tasks.some(t => t.title === "Unsynced local idea")), false);
  await page.evaluate(() => mock.changeAccount("bob"));
  await page.waitForFunction(() => mock.docs["users/bob/state/workspace"]);
  assert.equal(await page.evaluate(() => POS.store.get().tasks.length), 0);
});

test("AI failure stays honest; invalid review cannot save and cancelled proposal leaves no tasks", async t => {
  const { page } = await open(t);
  await signIn(page);
  await page.route("**/api/plan", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "AI is not configured. Use Create manually." }) }));
  await page.locator("#capture-btn").click();
  await page.locator("#plan-description").fill("Finish my poster project");
  await page.locator("#plan-generate").click();
  await page.waitForFunction(() => document.querySelector("#plan-message").textContent.includes("not configured"));
  assert.equal(await page.evaluate(() => POS.store.get().tasks.length), 0);
  await page.locator("#plan-manual").click();
  await page.locator('.plan-step [name="duration"]').fill("999");
  await page.locator("#plan-approve").click();
  assert.match(await page.locator("#plan-message").innerText(), /duration/);
  assert.equal(await page.evaluate(() => POS.store.get().tasks.length), 0);
  await page.getByRole("button", { name: "Close task planner" }).click();
  assert.equal(await page.evaluate(() => POS.store.get().projects.length), 0);
});

test("focus presets pause, resume and record completed time against the task", async t => {
  const { page } = await open(t);
  await signIn(page);
  await page.evaluate(() => { const task = POS.store.actions.addTask({ title: "Read my references" }); location.hash = "#/focus?task=" + task.id; });
  await page.locator("#focus-start").waitFor();
  await page.clock.install();
  await page.getByRole("button", { name: "15 min", exact: true }).click();
  await page.locator("#focus-start").click();
  await page.clock.fastForward(60000);
  assert.equal(await page.locator("#focus-clock").innerText(), "14:00");
  await page.locator("#focus-start").click();
  await page.clock.fastForward(60000);
  assert.equal(await page.locator("#focus-clock").innerText(), "14:00");
  await page.locator("#focus-start").click();
  await page.clock.fastForward(14 * 60000 + 1000);
  assert.equal(await page.evaluate(() => POS.store.get().focusSessions.length), 1);
  assert.equal(await page.evaluate(() => POS.store.get().focusSessions[0].minutes), 15);
  assert.equal(await page.evaluate(() => POS.store.get().focusSessions[0].taskId === POS.store.get().tasks[0].id), true);
  assert.equal(await page.evaluate(() => POS.mosaic.current().ids.length), 0, "focus time is not a fake task completion");
});

test("mosaic contributions undo cleanly and historical canvases survive week rollover and account changes", async t => {
  const { page } = await open(t);
  await signIn(page);
  await page.evaluate(() => { const t = POS.store.actions.addTask({ title: "A real task" }); POS.mosaic.toggle(t.id); });
  assert.equal(await page.evaluate(() => POS.mosaic.current().ids.length), 1);
  await page.evaluate(() => POS.mosaic.toggle(POS.store.get().tasks[0].id));
  assert.equal(await page.evaluate(() => POS.mosaic.current().ids.length), 0);
  await page.evaluate(() => POS.mosaic.toggle(POS.store.get().tasks[0].id));
  const week = await page.evaluate(() => POS.mosaic.current().key);
  await page.clock.install();
  await page.clock.setFixedTime(new Date(week + "T12:00:00").getTime() + 8 * 86400000);
  assert.equal(await page.evaluate(() => POS.mosaic.current().ids.length), 0);
  assert.equal(await page.evaluate(week => POS.mosaic.records()[week].taskIds.length, week), 1);
  await page.evaluate(() => mock.changeAccount("bob"));
  assert.deepEqual(await page.evaluate(() => POS.mosaic.records()), {});
});

test("mobile AI review supports editable steps and fits the dialog at 320px", async t => {
  const { page } = await open(t, { viewport: { width: 320, height: 700 } });
  await signIn(page);
  await page.route("**/api/plan", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ title: "My presentation", steps: [{ title: "Outline the talk", duration: 30 }, { title: "Rehearse once", duration: 30 }] }) }));
  await page.evaluate(() => { location.hash = "#/today"; });
  await page.getByRole("button", { name: "Add your first task", exact: true }).click();
  await page.locator("#plan-description").fill("Prepare a presentation and rehearse it");
  await page.locator("#plan-generate").click();
  await page.locator("#plan-approve").waitFor();
  await page.locator('[data-remove-step]').last().click();
  await page.locator("#plan-add-step").click();
  await page.locator('.plan-step [name="title"]').last().fill("Practice the final presentation");
  await page.locator("#plan-distribute").click();
  assert.equal(await page.locator(".plan-overlay").evaluate(el => el.scrollWidth <= el.clientWidth), true);
  await page.screenshot({ path: "test-results/plan-review-320.png" });
  await page.locator("#plan-approve").click();
  await page.locator(".week-grid").waitFor();
  assert.deepEqual(await page.evaluate(() => POS.store.get().tasks.map(t => t.title)), ["Outline the talk", "Practice the final presentation"]);
  await page.evaluate(() => { location.hash = "#/today"; });
  await page.getByRole("checkbox", { name: "Complete Outline the talk", exact: true }).click();
  await page.evaluate(() => { location.hash = "#/mosaic"; });
  await page.locator(".mosaic-canvas").waitFor();
  assert.equal(await page.locator(".mosaic-canvas .tile-earned").count(), 8);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: "test-results/mosaic-mobile.png", fullPage: true });
});

test("unfinished work is redistributed only after approval and never overloads the day", async t => {
  const { page } = await open(t);
  await signIn(page);
  await page.evaluate(() => {
    const today = POS.util.todayISO();
    POS.store.actions.updateSettings({ capacity: 60, workDays: [0, 1, 2, 3, 4, 5, 6] });
    const project = POS.store.actions.addProject({ name: "A real deadline", deadline: POS.planning.add(today, 7) });
    POS.store.actions.addTask({ title: "Unfinished research", date: POS.planning.add(today, -1), duration: 30, projectId: project.id, order: 0 });
    POS.store.actions.addTask({ title: "Already planned work", date: today, duration: 45 });
    location.hash = "#/calendar";
  });
  await page.locator("#redistribute").click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(await page.evaluate(() => POS.store.overdue().length), 1);
  await page.locator("#redistribute").click();
  await page.locator(".modal [data-yes]").click();
  assert.equal(await page.evaluate(() => POS.store.overdue().length), 0);
  const moved = await page.evaluate(() => POS.store.get().tasks[0]);
  const today = await page.evaluate(() => POS.util.todayISO());
  assert.notEqual(moved.date, today);
  assert.equal(moved.rescheduled, 1);
  await page.reload();
  await page.locator(".week-grid").waitFor();
  assert.equal(await page.evaluate(() => POS.store.get().tasks[0].date), moved.date);
});

test("a second device restores the automatically saved private workspace on sign-in", async t => {
  const first = await open(t);
  await signIn(first.page);
  await first.page.evaluate(() => POS.store.actions.addTask({ title: "Available on my other device" }));
  await first.page.waitForFunction(() => mock.syncWrites?.some(w => JSON.parse(w.data.payload).tasks.length === 1));
  const remote = await first.page.evaluate(() => mock.docs);
  const second = await open(t);
  await second.context.route("**/firebase-firestore-lite.js", route => route.fulfill({ contentType: "text/javascript", headers: { "Access-Control-Allow-Origin": "*" }, body: modules["firebase-firestore-lite.js"] + "\nwindow.mock.docs = " + JSON.stringify(remote) + ";" }));
  await signIn(second.page);
  await second.page.waitForFunction(() => POS.store.get().tasks.some(t => t.title === "Available on my other device"));
  assert.equal(await second.page.evaluate(() => POS.sync.status().ready), true);
  await second.page.evaluate(() => mock.changeAccount("bob"));
  assert.equal(await second.page.evaluate(() => POS.store.get().tasks.length), 0);
});

test("spoken project conversation retains context and creates a brief without saving tasks", async t => {
  const { page } = await open(t, { viewport: { width: 390, height: 844 } });
  await signIn(page);
  await page.evaluate(() => {
    window.SpeechRecognition = class {
      start() { window.voiceMock = this; this.onstart(); }
      stop() { this.onend?.(); }
      abort() { window.voiceAborted = true; this.onend?.(); }
    };
  });
  const requests = [];
  await page.route("**/api/plan", async route => {
    const body = route.request().postDataJSON(); requests.push(body);
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ reply: requests.length === 1 ? "What needs to be ready for the submission?" : "We can plan research, sketches and a presentation.", brief: "Typography project: research, sketches and a presentation. Deadline: 10 December 2026.", ready: requests.length > 1 }) });
  });
  await page.locator("#capture-btn").click();
  await page.locator("#project-conversation summary").click();
  await page.locator("#conversation-mic").click();
  await page.evaluate(() => { voiceMock.onresult({ results: [[{ transcript: "I am making a typography project" }]] }); voiceMock.onend(); });
  assert.equal(await page.locator("#conversation-input").inputValue(), "I am making a typography project");
  assert.equal(requests.length, 0, "dictation is not sent without explicit approval");
  await page.locator("#conversation-send").click();
  await page.locator(".conversation-bubble.assistant").filter({ hasText: "What needs" }).waitFor();
  await page.locator("#conversation-input").fill("Research, sketches and a presentation, due on 10 December");
  await page.locator("#conversation-send").click();
  await page.locator(".conversation-bubble.assistant").filter({ hasText: "We can plan" }).waitFor();
  assert.equal(requests[1].messages.length, 3);
  assert.equal(requests[1].messages[1].role, "assistant");
  await page.locator("#conversation-use").click();
  assert.match(await page.locator("#plan-description").inputValue(), /Typography project/);
  assert.equal(await page.locator("#plan-deadline").inputValue(), "2026-12-10");
  assert.equal(await page.evaluate(() => POS.store.get().tasks.length), 0);
  await page.getByRole("button", { name: "Close task planner" }).click();
  assert.equal(await page.evaluate(() => voiceAborted), true);
});

test("voice permission failure and unavailable recognition keep typing usable", async t => {
  const { page } = await open(t);
  await signIn(page);
  await page.evaluate(() => { window.SpeechRecognition = class { start() { this.onerror({ error: "not-allowed" }); this.onend(); } abort() {} }; });
  await page.locator("#capture-btn").click();
  await page.locator("#project-conversation summary").click();
  await page.locator("#conversation-mic").click();
  assert.match(await page.locator("#conversation-status").innerText(), /permission was denied/);
  assert.equal(await page.locator("#conversation-send").isEnabled(), true);
  await page.getByRole("button", { name: "Close task planner" }).click();
  await page.evaluate(() => { window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined; });
  await page.locator("#capture-btn").click();
  await page.locator("#project-conversation summary").click();
  assert.equal(await page.locator("#conversation-mic").isVisible(), false);
  await page.locator("#conversation-input").fill("I can still describe my project");
  assert.match(await page.locator("#conversation-voice-help").innerText(), /unavailable/);
});

test("readable typography is maintained across landing, tasks and conversation on desktop and phone", async t => {
  const { page } = await open(t);
  const size = selector => page.locator(selector).first().evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  assert.ok(await size("body") >= 16);
  assert.ok(await size(".landing-description") >= 18);
  assert.ok(await size(".welcome-account-help") >= 14);
  await signIn(page);
  await page.evaluate(() => { POS.store.actions.addTask({ title: "A clearly readable task" }); location.hash = "#/today"; });
  await page.locator(".task-copy strong").waitFor();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await size(".task-copy strong") >= 16, `${width}px task title`);
    assert.ok(await size(".task-copy p") >= 14, `${width}px task details`);
    assert.ok(await size(".studio-page-head p") >= 14, `${width}px date label`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}px dashboard fits`);
  }
  await page.locator("#capture-btn").click();
  await page.locator("#project-conversation summary").click();
  assert.ok(await size(".conversation-bubble") >= 16);
  assert.ok(await size("#conversation-input") >= 16);
  assert.ok(await size(".field-help") >= 14);
  assert.equal(await page.locator(".plan-overlay").evaluate(el => el.scrollWidth > el.clientWidth), false);
  await page.screenshot({ path: "test-results/readable-conversation-320.png" });
});

test("mosaic reveals expire, never intercept controls and do not replay on task updates", async t => {
  const { page } = await open(t, { reducedMotion: "no-preference" });
  await page.waitForFunction(() => !document.getElementById("mosaic-loader"));
  assert.equal(await page.locator("html").evaluate(el => el.classList.contains("mosaic-loading")), false);
  await signIn(page);
  await page.evaluate(() => { POS.store.actions.addTask({ title: "Click through the mosaic" }); location.hash = "#/today"; });
  await page.locator(".task-copy strong").waitFor();
  const reveal = await page.evaluate(() => {
    const main = document.getElementById("main");
    POS.loader.reveal(main);
    const button = main.querySelector("[data-plan]"), rect = button.getBoundingClientRect();
    return { tiles: main.querySelectorAll(".route-mosaic .loader-grid i").length, pointer: getComputedStyle(main.querySelector(".route-mosaic")).pointerEvents, receivesClick: button.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)) };
  });
  assert.equal(reveal.tiles, 64);
  assert.equal(reveal.pointer, "none");
  assert.equal(reveal.receivesClick, true);
  await page.waitForFunction(() => !document.querySelector(".route-mosaic"));
  await page.getByRole("checkbox", { name: "Complete Click through the mosaic", exact: true }).click();
  assert.equal(await page.locator(".route-mosaic").count(), 0);
  await page.reload();
  await page.waitForFunction(() => !document.getElementById("mosaic-loader"));
  assert.equal(await page.locator(".studio-dashboard-grid").isVisible(), true);
});

test("reduced motion skips mosaic screen reveals and missing loader code cannot trap the page", async t => {
  const { page, context } = await open(t);
  await signIn(page);
  await page.evaluate(() => POS.loader.reveal(document.getElementById("main")));
  assert.equal(await page.locator(".route-mosaic").count(), 0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await context.route("**/js/loader.js?*", route => route.abort());
  await page.reload();
  await page.waitForFunction(() => getComputedStyle(document.getElementById("mosaic-loader")).visibility === "hidden");
  assert.equal(await page.locator("#mosaic-loader").isVisible(), false);
  assert.equal(await page.locator("#app").isVisible(), true);
});
