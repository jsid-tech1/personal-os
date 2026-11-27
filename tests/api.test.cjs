const { test } = require("node:test");
const assert = require("node:assert/strict");
const { handler, createHandler } = require("../functions/api.cjs");
const { Readable } = require("node:stream");
const headers = { authorization: "Bearer signed-token", "content-type": "application/json", origin: "http://localhost:8000" };
const valid = { description: "Prepare a five-slide presentation", capacity: 120 };
function response() {
  return { status: 0, body: null, writeHead(status) { this.status = status; return this; }, end(body) { this.body = JSON.parse(body); return this; } };
}
test("AI endpoint rejects anonymous callers before touching a model or admin credentials", async () => {
  const res = response();
  await handler({ method: "POST", headers: {} }, res);
  assert.equal(res.status, 401);
  assert.match(res.body.error, /Sign in/);
});
test("AI endpoint rejects unsafe methods and unapproved browser origins", async () => {
  const method = response(), origin = response();
  await handler({ method: "GET", headers: {} }, method);
  await handler({ method: "POST", headers: { origin: "https://unapproved.example", authorization: "Bearer forged" } }, origin);
  assert.equal(method.status, 405);
  assert.equal(origin.status, 403);
});
test("authenticated goal reaches the agent with only bounded planning input", async () => {
  const api = createHandler({ verify: async token => { assert.equal(token, "signed-token"); return "user-1"; }, generate: async input => {
    assert.deepEqual(input, valid);
    return { title: "Presentation", steps: [{ title: "Outline five slides", duration: 30, milestone: "Draft" }] };
  } });
  const res = response();
  await api({ method: "POST", headers, body: { ...valid, unrelatedWorkspace: "private" } }, res);
  assert.equal(res.status, 200);
  assert.equal(res.body.steps[0].duration, 30);
});
test("invalid identity cannot invoke the agent", async () => {
  const api = createHandler({ verify: async () => { throw new Error("bad token"); }, generate: () => assert.fail("must not call model") });
  const res = response();
  await api({ method: "POST", headers, body: valid }, res);
  assert.equal(res.status, 401);
});
test("API validates input, JSON content type and request size before the model", async () => {
  const api = createHandler({ verify: async () => "user", generate: () => assert.fail("must not call model") });
  for (const [body, overrides, expected] of [
    [{ ...valid, capacity: 0 }, {}, 400],
    [{ ...valid, description: "short" }, {}, 400],
    [valid, { "content-type": "text/plain" }, 415],
    [valid, { "content-length": "16001" }, 413],
  ]) {
    const res = response();
    await api({ method: "POST", headers: { ...headers, ...overrides }, body }, res);
    assert.equal(res.status, expected);
  }
});
test("API accepts streamed JSON and rejects malformed JSON or oversized streams", async () => {
  const api = createHandler({ verify: async () => "user", generate: async () => ({ title: "Valid", steps: [] }) });
  for (const [raw, expected] of [[JSON.stringify(valid), 200], ["not json", 400], ["x".repeat(16001), 413]]) {
    const req = Readable.from([Buffer.from(raw)]), res = response();
    req.method = "POST"; req.headers = headers;
    await api(req, res);
    assert.equal(res.status, expected);
  }
});
test("API rate limits per user without blocking another account", async () => {
  let calls = 0;
  const api = createHandler({ verify: async token => token, generate: async () => { calls++; return {}; } });
  for (let i = 0; i < 6; i++) {
    const res = response();
    await api({ method: "POST", headers, body: valid }, res);
    assert.equal(res.status, i < 5 ? 200 : 429);
  }
  const other = response();
  await api({ method: "POST", headers: { ...headers, authorization: "Bearer another-user" }, body: valid }, other);
  assert.equal(other.status, 200);
  assert.equal(calls, 6);
});
