const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const P = require("../js/planning.js");
const { generatePlan } = require("../functions/planner.cjs");
const input = { description: "Prepare a short presentation about my design process", capacity: 60 };
const draft = { title: "Design presentation", steps: [
  { title: "Outline the design story", duration: 30, milestone: "Shape the story" },
  { title: "Build three slides", duration: 45, milestone: "Make the slides" },
  { title: "Rehearse and check the export", duration: 20, milestone: "Make the slides" },
] };
const upstream = (plan = draft, finish = "stop") => new Response(JSON.stringify({ choices: [{ finish_reason: finish, message: { content: JSON.stringify(plan) } }] }));
test("agent calls DeepSeek with JSON mode, server key, and a capacity-aware prompt", async () => {
  const result = await generatePlan(input, { key: "test-only-key", model: "deepseek-flash", fetchImpl: async (url, options) => {
    assert.equal(url, "https://api.deepseek.com/chat/completions");
    assert.equal(options.headers.Authorization, "Bearer test-only-key");
    assert.equal(options.redirect, "error");
    const body = JSON.parse(options.body);
    assert.equal(body.model, "deepseek-flash");
    assert.equal(body.stream, false);
    assert.equal(body.response_format.type, "json_object");
    assert.match(body.messages[0].content, /5 to 60 minutes/);
    assert.equal(JSON.parse(body.messages[1].content).goal, input.description);
    return upstream({ ...draft, secret: "must not be forwarded" });
  } });
  assert.deepEqual(result, draft);
  assert.equal(JSON.stringify(result).includes("test-only-key"), false);
});
test("missing keys and invalid goals are rejected before network access", async () => {
  const fetchImpl = () => assert.fail("network should not be called");
  await assert.rejects(generatePlan(input, { key: "", fetchImpl }), { status: 503 });
  for (const value of [null, { ...input, description: "short" }, { ...input, description: "x".repeat(5001) }, { ...input, capacity: 721 }, { ...input, capacity: 30.5 }]) {
    await assert.rejects(generatePlan(value, { key: "fake", fetchImpl }), { status: 400 });
  }
});
test("agent rejects malformed, empty, truncated, oversized and invalid model plans", async () => {
  const invalid = [null, {}, { ...draft, title: " " }, { ...draft, steps: [] }, { ...draft, steps: Array(51).fill(draft.steps[0]) },
    ...[null, { title: "", duration: 30, milestone: "Stage" }, { title: "Task", duration: 61, milestone: "Stage" }, { title: "Task", duration: 10.5, milestone: "Stage" }, { title: "Task", duration: 30 }, { title: "Task", duration: 30, milestone: " " }].map(step => ({ ...draft, steps: [step] }))];
  for (const plan of invalid) await assert.rejects(generatePlan(input, { key: "fake", fetchImpl: async () => upstream(plan) }), { status: 502 });
  await assert.rejects(generatePlan(input, { key: "fake", fetchImpl: async () => upstream(draft, "length") }), { status: 502 });
  await assert.rejects(generatePlan(input, { key: "fake", fetchImpl: async () => new Response("not JSON") }), { status: 502 });
  await assert.rejects(generatePlan(input, { key: "fake", fetchImpl: async () => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: "   " } }] })) }), { status: 502 });
});
test("agent reports provider auth, credit, rate limits, outages and timeouts without leaking secrets", async () => {
  for (const [status, expected, message] of [[401, 503, /server key/], [402, 503, /balance/], [429, 429, /busy/], [500, 502, /could not generate/]]) {
    await assert.rejects(generatePlan(input, { key: "private", fetchImpl: async () => new Response("private upstream body", { status }) }), error => error.status === expected && message.test(error.message) && !error.message.includes("private"));
  }
  await assert.rejects(generatePlan(input, { key: "private", fetchImpl: async () => { throw new DOMException("private", "TimeoutError"); } }), { status: 504 });
  await assert.rejects(generatePlan(input, { key: "private", fetchImpl: async () => { throw new Error("private"); } }), error => error.status === 502 && !error.message.includes("private"));
});

function browserAgent({ existing = [], fetchImpl, onToken } = {}) {
  const state = { user: { uid: "owner" } };
  const POS = { planning: P, util: { todayISO: () => "2026-11-27", uid: prefix => prefix + Math.random() },
    cloud: { getStatus: () => state, token: async () => { onToken?.(state); return "test-id-token"; } }, store: { get: () => ({ tasks: existing }) } };
  vm.runInNewContext(fs.readFileSync(require.resolve("../js/goal-agent.js"), "utf8"), { window: { POS }, AbortSignal, fetch: fetchImpl || (async () => new Response(JSON.stringify(draft))) });
  return { agent: POS.goalAgent, state };
}
const goal = { title: input.description, description: "Use my existing sketches", capacity: 60, targetDate: "2026-12-04", weekendsOff: true };
test("browser agent schedules milestones around existing work without saving or sharing the calendar", async () => {
  const existing = [{ title: "Private existing task", date: "2026-11-27", duration: 60 }];
  const { agent } = browserAgent({ existing, fetchImpl: async (url, options) => {
    assert.equal(url, "/api/plan");
    assert.equal(options.headers.Authorization, "Bearer test-id-token");
    assert.deepEqual(JSON.parse(options.body), { description: goal.title + "\n\n" + goal.description, capacity: 60 });
    return new Response(JSON.stringify(draft));
  } });
  const plan = await agent.breakdown(goal);
  assert.equal(plan.local, false);
  assert.equal(plan.milestones.length, 2);
  assert.equal(plan.milestones[0].tasks[0].date, "2026-11-30");
  assert.equal(plan.milestones[1].tasks[1].date, "2026-12-02");
  assert.equal(plan.totalMinutes, 95);
  assert.equal(existing.length, 1);
});
test("browser agent reports insufficient calendar space instead of overscheduling", async () => {
  const { agent } = browserAgent();
  await assert.rejects(agent.breakdown({ ...goal, targetDate: "2026-11-27" }), /does not fit/);
});
test("browser agent surfaces API errors and discards cross-account responses", async () => {
  const failure = browserAgent({ fetchImpl: async () => new Response(JSON.stringify({ error: "Account needs credit" }), { status: 503 }) });
  await assert.rejects(failure.agent.breakdown(goal), /Account needs credit/);
  const changed = browserAgent({ onToken: state => { state.user = { uid: "different-owner" }; } });
  await assert.rejects(changed.agent.breakdown(goal), /account changed/);
});
