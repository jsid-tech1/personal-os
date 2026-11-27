const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const plan = require("../api/plan.js");
const live = require("../api/live.js");

test("both Vercel functions accept project origins, require sign-in and reject other sites", async t => {
  const env = {
    VERCEL: "1", VERCEL_URL: "deployment.vercel.app", VERCEL_BRANCH_URL: "branch.vercel.app",
    VERCEL_PROJECT_PRODUCTION_URL: "product.vercel.app", APP_ORIGIN: "https://planner.example.org",
  };
  for (const [key, value] of Object.entries(env)) {
    const old = process.env[key];
    process.env[key] = value;
    t.after(() => { if (old === undefined) delete process.env[key]; else process.env[key] = old; });
  }
  const server = createServer((req, res) => (req.url === "/api/plan" ? plan : live)(req, res));
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  for (const route of ["/api/plan", "/api/live"]) {
    const url = `http://127.0.0.1:${server.address().port}${route}`;
    for (const [origin, expected] of [
      ["https://product.vercel.app", 401], ["https://branch.vercel.app", 401],
      ["https://deployment.vercel.app", 401], ["https://planner.example.org", 401],
      ["https://another-project.vercel.app", 403], ["https://product.vercel.app.example.org", 403],
    ]) {
      const res = await fetch(url, { method: "POST", headers: { origin } });
      assert.equal(res.status, expected, `${route} from ${origin}`);
      assert.equal(res.headers.get("cache-control"), "no-store");
      assert.match((await res.json()).error, expected === 401 ? /Sign in/ : /Origin/);
    }
    const invalid = await fetch(url, { method: "POST", headers: { authorization: "Bearer invalid" } });
    assert.equal(invalid.status, 401, `${route} rejects an invalid token`);
    await invalid.json();
  }
});
