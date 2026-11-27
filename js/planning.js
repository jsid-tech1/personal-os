/* Deterministic scheduling: AI proposes work; this module enforces dates and capacity. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.POS.planning = api;
})(typeof window === "undefined" ? globalThis : window, function () {
  "use strict";
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const date = s => new Date(s + "T12:00:00");
  const validDate = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(date(s).getTime()) && iso(date(s)) === s;
  const add = (s, n) => { const d = date(s); d.setDate(d.getDate() + n); return iso(d); };
  function preferences(p) {
    if (!Number.isInteger(p.capacity) || p.capacity < 15 || p.capacity > 720) throw new Error("Daily capacity must be between 15 and 720 minutes.");
    if (!Array.isArray(p.days) || !p.days.length || p.days.some(d => !Number.isInteger(d) || d < 0 || d > 6)) throw new Error("Choose at least one working day.");
  }
  function scheduleDraft(steps, options, existing = []) {
    preferences(options);
    if (!validDate(options.start) || !validDate(options.deadline) || options.deadline < options.start || options.deadline > add(options.start, 366)) throw new Error("Choose a deadline within the next year.");
    if (!Array.isArray(steps) || !steps.length || steps.length > 100) throw new Error("A plan needs between 1 and 100 steps.");
    const loads = {};
    existing.forEach(t => { loads[t.date] = (loads[t.date] || 0) + Number(t.duration || 0); });
    let cursor = options.start;
    return steps.map(step => {
      const duration = Number(step.duration), title = String(step.title || "").trim();
      if (!title || title.length > 200 || !Number.isInteger(duration) || duration < 5 || duration > options.capacity) throw new Error("Each step needs a title and 5–" + options.capacity + " minutes. Split longer steps.");
      while (cursor <= options.deadline && (!options.days.includes(date(cursor).getDay()) || (loads[cursor] || 0) + duration > options.capacity)) cursor = add(cursor, 1);
      if (cursor > options.deadline) return { title, duration, date: "" };
      loads[cursor] = (loads[cursor] || 0) + duration;
      return { title, duration, date: cursor };
    });
  }
  function schedule(steps, options, existing = []) {
    const draft = scheduleDraft(steps, options, existing);
    if (draft.some(step => !step.date)) throw new Error("This work does not fit before the deadline. Extend it, increase capacity, or reduce the plan.");
    return draft;
  }
  function validate(steps, options, existing = []) {
    preferences(options);
    if (!validDate(options.start) || !validDate(options.deadline) || options.deadline < options.start) throw new Error("Check the deadline.");
    const loads = {};
    existing.forEach(t => { loads[t.date] = (loads[t.date] || 0) + Number(t.duration || 0); });
    if (!steps.length || steps.length > 100) throw new Error("Add at least one step (100 maximum).");
    let previous = options.start;
    steps.forEach(t => {
      if (!String(t.title || "").trim() || t.title.length > 200 || !Number.isInteger(t.duration) || t.duration < 5 || t.duration > options.capacity) throw new Error("Check each step's title and duration.");
      if (!validDate(t.date) || t.date < options.start || t.date > options.deadline || !options.days.includes(date(t.date).getDay())) throw new Error("Use an available working day between today and the deadline.");
      if (t.date < previous) throw new Error("Keep steps in chronological order.");
      previous = t.date;
      loads[t.date] = (loads[t.date] || 0) + t.duration;
      if (loads[t.date] > options.capacity) throw new Error(t.date + " exceeds your daily capacity. Move work to another day.");
    });
    return true;
  }
  function week(s) { return add(s, -((date(s).getDay() + 6) % 7)); }
  function extractDeadline(text, base) {
    const direct = String(text).match(/\b(\d{4}-\d{2}-\d{2})\b/);
    if (direct && validDate(direct[1])) return direct[1];
    const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
    const match = String(text).toLowerCase().match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+(\d{4}))?\b/);
    if (match && validDate(base)) {
      const year = Number(match[3]) || date(base).getFullYear(), month = months.indexOf(match[2]);
      let value = `${year}-${String(month + 1).padStart(2, "0")}-${match[1].padStart(2, "0")}`;
      if (!match[3] && value < base) value = String(year + 1) + value.slice(4);
      return validDate(value) ? value : null;
    }
    if (/\b(?:due|by|on) tomorrow\b/i.test(text)) return add(base, 1);
    if (/\b(?:due|by) today\b/i.test(text)) return base;
    return null;
  }
  return { iso, add, week, validDate, preferences, scheduleDraft, schedule, validate, extractDeadline };
});
