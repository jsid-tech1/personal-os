const { test } = require("node:test");
const assert = require("node:assert/strict");
const P = require("../js/planning.js");
const options = { start: "2026-11-27", deadline: "2026-12-04", capacity: 60, days: [1, 2, 3, 4, 5] };
test("scheduler skips unavailable days and includes existing daily work", () => {
  const result = P.schedule([{ title: "Research", duration: 30 }, { title: "Design", duration: 45 }], options, [{ date: "2026-11-27", duration: 45, done: false }]);
  assert.deepEqual(result.map(t => t.date), ["2026-11-30", "2026-12-01"]);
  assert.equal(P.validate(result, options, [{ date: "2026-11-27", duration: 45 }]), true);
  assert.equal(P.schedule([{ title: "More work", duration: 30 }], options, [{ date: "2026-11-27", duration: 45, done: true }])[0].date, "2026-11-30", "finished work still consumed capacity");
});
test("scheduler rejects impossible workload instead of silently overloading tomorrow", () => {
  assert.throws(() => P.schedule([{ title: "Too long", duration: 80 }], options), /Split longer/);
  assert.throws(() => P.schedule([{ title: "One", duration: 50 }, { title: "Two", duration: 50 }], { ...options, deadline: options.start }), /does not fit/);
});
test("approval validates edited dates, duration, order and capacity", () => {
  const step = { title: "Research", duration: 45, date: "2026-11-27" };
  assert.throws(() => P.validate([{ ...step, date: "2026-11-28" }], options), /available working day/);
  assert.throws(() => P.validate([step, { ...step, title: "Another" }], options), /exceeds/);
  assert.throws(() => P.validate([{ ...step, date: "2026-11-30" }, step], options), /chronological/);
  assert.throws(() => P.validate([{ ...step, title: " " }], options), /title/);
  assert.throws(() => P.validate([{ ...step, duration: -10 }], options), /duration/);
});
test("week boundaries are Monday-local and malformed dates cannot enter the calendar", () => {
  assert.equal(P.week("2026-11-29"), "2026-11-23");
  assert.equal(P.week("2026-11-30"), "2026-11-30");
  assert.equal(P.validDate("2026-02-30"), false);
  assert.equal(P.validDate("not-a-date"), false);
  assert.throws(() => P.schedule([{ title: "Task", duration: 30 }], { ...options, days: [] }), /at least one/);
});
test("a date in the task description can prefill the deadline without inventing missing details", () => {
  assert.equal(P.extractDeadline("My submission is on 10 December.", "2026-11-27"), "2026-12-10");
  assert.equal(P.extractDeadline("due 2026-12-11", "2026-11-27"), "2026-12-11");
  assert.equal(P.extractDeadline("due by 31 February", "2026-11-27"), null);
  assert.equal(P.extractDeadline("Make my poster", "2026-11-27"), null);
});
