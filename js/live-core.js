/* Personal OS — pure helpers for live voice: workspace snapshot + confirmation gate.
   No DOM, no network: this file is loaded in the browser and required by the tests. */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) {
    root.POS = root.POS || {};
    root.POS.liveCore = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MAX_CONTEXT = 6000;
  const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const AFFIRM = /^(?:yes|yeah|yep|yup|sure|ok|okay|correct|confirm|confirmed|affirmative|absolutely|definitely|do it|go ahead|please do|sounds good|that'?s right)\b/i;
  const DECLINE = /^(?:no|nope|don'?t|cancel|stop|wait|not yet|hold on|never mind)\b/i;

  const pad = (n) => String(n).padStart(2, "0");
  const isoDay = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const addDays = (date, days) => {
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
    next.setDate(next.getDate() + days);
    return next;
  };
  const parseDay = (iso) => {
    const [year, month, day] = String(iso).split("-").map(Number);
    return new Date(year, month - 1, day, 12);
  };
  const shortDay = (iso) => {
    const date = parseDay(iso);
    if (Number.isNaN(date.getTime())) return String(iso);
    return `${WEEKDAYS_SHORT[date.getDay()]} ${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
  };
  const clean = (value, max = 120) => String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max);

  function isAffirmative(text) {
    const value = String(text || "").trim().toLowerCase().replace(/[.!?,;:]+$/g, "");
    if (!value || value.length > 90) return false;
    if (DECLINE.test(value)) return false;
    if (AFFIRM.test(value)) return true;
    return /\b(?:yes|confirm|do it|go ahead|please do)\b/.test(value.slice(0, 60));
  }

  function createActions({ now = () => Date.now(), ttl = 120000, limit = 4 } = {}) {
    let sequence = 0;
    const pending = new Map();
    let lastUser = null;
    const stamp = () => Number(now());
    const prune = () => {
      const at = stamp();
      for (const [id, item] of pending) if (at - item.createdAt > ttl) pending.delete(id);
    };
    const get = (id) => { prune(); return pending.get(id) || null; };

    return {
      noteUser(text) { lastUser = { text: String(text || ""), at: stamp() }; },
      resetUser() { lastUser = null; },
      lastUser() { return lastUser; },
      propose(kind, payload = {}) {
        prune();
        const item = { id: `live_${++sequence}`, kind, payload, createdAt: stamp() };
        pending.set(item.id, item);
        while (pending.size > limit) pending.delete(pending.keys().next().value);
        return item;
      },
      get,
      list() { prune(); return [...pending.values()]; },
      cancel(id) { prune(); return pending.delete(id); },
      clear() { pending.clear(); lastUser = null; },
      canCommit(id, { tapped = false } = {}) {
        const item = get(id);
        if (!item) return { ok: false, reason: "That proposal is no longer open. Ask again." };
        if (tapped) return { ok: true, item };
        if (!lastUser) return { ok: false, reason: "Ask the user to confirm out loud, or they can tap Apply." };
        if (stamp() - lastUser.at > 60000) return { ok: false, reason: "The confirmation was too long ago. Ask again." };
        if (!isAffirmative(lastUser.text)) return { ok: false, reason: "The user hasn't agreed yet. Read the change back and ask for a clear yes." };
        return { ok: true, item };
      },
    };
  }

  function taskLine(task, today, projects) {
    const project = task.projectId ? projects.find((p) => p.id === task.projectId) : null;
    const bits = [clean(task.title, 90)];
    if (project) bits.push(clean(project.name, 60));
    if (task.duration) bits.push(`${Number(task.duration)} min`);
    if (task.date && task.date !== today) bits.push(shortDay(task.date));
    return `- [${task.done ? "done" : "open"}] ${bits.join(" — ")}`;
  }

  function buildContext({ state = {}, now = new Date(), screen = "", max = MAX_CONTEXT } = {}) {
    const s = state || {};
    const settings = s.settings || {};
    const tasks = Array.isArray(s.tasks) ? s.tasks : [];
    const projects = Array.isArray(s.projects) ? s.projects : [];
    const notes = Array.isArray(s.notes) ? s.notes : [];
    const habits = Array.isArray(s.habits) ? s.habits : [];
    const events = Array.isArray(s.events) ? s.events : [];
    const today = isoDay(now);
    const tomorrow = isoDay(addDays(now, 1));
    const weekEnd = isoDay(addDays(now, 7));
    const open = tasks.filter((t) => !t.done);
    const activeProjects = projects.filter((p) => p.status !== "archived");

    const sections = [];
    const clock = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    sections.push({
      key: "now",
      text: [
        `Now: ${WEEKDAYS[now.getDay()]} ${now.getDate()} ${MONTHS_SHORT[now.getMonth()]} ${now.getFullYear()}, ${clock} (local time).`,
        `Person: ${clean(settings.name, 60) || "the user"}${settings.role ? `, ${clean(settings.role, 60)}` : ""}. Capacity ${Number(settings.capacity) || 120} min per working day.`,
        `Today is ${today}; tomorrow is ${tomorrow}.`,
      ].join("\n"),
    });
    if (screen) sections.push({ key: "screen", text: `Current screen: ${clean(screen, 160)}.` });

    const todayTasks = tasks.filter((t) => t.date === today);
    const todayLines = todayTasks.slice(0, 12).map((t) => taskLine(t, today, projects));
    const todayEvents = events.filter((e) => e.date === today).slice(0, 5)
      .map((e) => `- ${clean(e.title, 80)}${e.start ? ` ${e.start}${e.end ? `–${e.end}` : ""}` : ""}`);
    if (todayLines.length || todayEvents.length) {
      const done = todayTasks.filter((t) => t.done).length;
      sections.push({
        key: "today",
        text: [
          `Today (${shortDay(today)}) — ${todayTasks.length - done} open, ${done} done${todayTasks.length ? ":" : "."}`,
          ...todayLines,
          ...(todayEvents.length ? ["Events today:", ...todayEvents] : []),
        ].join("\n"),
      });
    }

    const overdue = open.filter((t) => t.date && t.date < today).sort((a, b) => a.date.localeCompare(b.date));
    if (overdue.length) {
      sections.push({
        key: "overdue",
        text: `Overdue — ${overdue.length}:\n${overdue.slice(0, 8).map((t) => taskLine(t, today, projects)).join("\n")}`,
      });
    }

    const upcoming = open.filter((t) => t.date && t.date > today && t.date <= weekEnd);
    const deadlines = activeProjects.filter((p) => p.deadline && p.deadline <= weekEnd).sort((a, b) => a.deadline.localeCompare(b.deadline));
    if (upcoming.length || deadlines.length) {
      sections.push({
        key: "next",
        text: [
          `Next 7 days — ${upcoming.length} open ${upcoming.length === 1 ? "task" : "tasks"}.`,
          ...deadlines.slice(0, 6).map((p) => {
            const own = tasks.filter((t) => t.projectId === p.id);
            return `- Deadline ${shortDay(p.deadline)}: ${clean(p.name, 70)} (${own.filter((t) => t.done).length}/${own.length} steps)`;
          }),
        ].join("\n"),
      });
    }

    if (activeProjects.length) {
      const lines = activeProjects
        .slice()
        .sort((a, b) => String(a.deadline || "9999").localeCompare(String(b.deadline || "9999")))
        .slice(0, 8)
        .map((p) => {
          const own = tasks.filter((t) => t.projectId === p.id);
          const next = own.filter((t) => !t.done).sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))[0];
          return `- ${clean(p.name, 70)} — due ${p.deadline ? shortDay(p.deadline) : "no date"} — ${own.filter((t) => t.done).length}/${own.length} steps${next ? ` — next: ${clean(next.title, 70)}` : ""}`;
        });
      sections.push({ key: "projects", text: `Projects (${activeProjects.length}):\n${lines.join("\n")}` });
    }

    if (notes.length) {
      const lines = notes
        .slice()
        .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")))
        .slice(0, 5)
        .map((n) => `- ${clean(n.title, 80)}${Array.isArray(n.tags) && n.tags.length ? ` (${n.tags.slice(0, 3).map((tag) => clean(tag, 20)).join(", ")})` : ""}`);
      sections.push({ key: "notes", text: `Notes (recent ${lines.length}):\n${lines.join("\n")}` });
    }

    if (habits.length) {
      const lines = habits.slice(0, 8).map((habit) => {
        const log = habit.log || {};
        let streak = 0;
        let cursor = log[today] ? today : isoDay(addDays(now, -1));
        for (let i = 0; i < 400; i++) {
          if (!log[cursor]) break;
          streak++;
          cursor = isoDay(addDays(parseDay(cursor), -1));
        }
        return `- ${clean(habit.name, 60)} — ${streak}-day streak — ${log[today] ? "done today" : "not done today"}`;
      });
      sections.push({ key: "habits", text: `Habits (${habits.length}):\n${lines.join("\n")}` });
    }

    // Drop the least useful blocks first when the snapshot is too long.
    for (const key of ["habits", "notes", "projects", "next", "overdue"]) {
      const joined = sections.map((section) => section.text).join("\n\n");
      if (joined.length <= max) break;
      const index = sections.findIndex((section) => section.key === key);
      if (index >= 0) sections.splice(index, 1);
    }
    let text = sections.map((section) => section.text).join("\n\n");
    if (text.length > max) {
      const cut = text.lastIndexOf("\n", max);
      text = text.slice(0, cut > max * 0.7 ? cut : max);
    }
    return text;
  }

  return { MAX_CONTEXT, buildContext, createActions, isAffirmative };
});
