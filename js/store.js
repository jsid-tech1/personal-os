/* Personal OS — store: one source of truth, persisted locally. */
(function () {
  "use strict";
  const POS = window.POS;
  const { todayISO, addDays, uid, clamp } = POS.util;
  const KEY = "personal-os:v1";

  let state = null;
  let listeners = [];
  let saveTimer = null;

  const clone = (v) => JSON.parse(JSON.stringify(v));
  const flush = () => {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (!state) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (err) {
      console.warn("Personal OS: could not persist state", err);
    }
  };

  const persist = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 180);
  };

  const emit = (reason) => {
    const snap = state;
    listeners.forEach((fn) => {
      try { fn(snap, reason); } catch (err) { console.error(err); }
    });
  };

  const load = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === 1 && Array.isArray(parsed.tasks)) {
          state = parsed;
          state.plans = state.plans || {};
          state.proposals = state.proposals || {};
          return;
        }
      }
    } catch (err) {
      console.warn("Personal OS: starting fresh", err);
    }
    state = POS.buildSeed();
    persist();
  };

  const get = () => state;

  const set = (mutator, reason = "update") => {
    const result = mutator(state);
    persist();
    emit(reason);
    return result;
  };

  const subscribe = (fn) => {
    listeners.push(fn);
    return () => { listeners = listeners.filter((l) => l !== fn); };
  };

  const reset = () => {
    state = POS.buildSeed();
    persist();
    emit("reset");
  };

  const importState = (obj) => {
    if (!obj || !Array.isArray(obj.tasks) || !Array.isArray(obj.projects)) {
      throw new Error("That file is not a Personal OS backup.");
    }
    state = obj;
    state.plans = state.plans || {};
    state.proposals = state.proposals || {};
    persist();
    emit("import");
  };

  /* ---------- selectors ---------- */

  const project = (id) => state.projects.find((p) => p.id === id) || null;
  const task = (id) => state.tasks.find((t) => t.id === id) || null;
  const note = (id) => state.notes.find((n) => n.id === id) || null;
  const habit = (id) => state.habits.find((h) => h.id === id) || null;

  const activeProjects = () => state.projects.filter((p) => p.status !== "archived");
  const openTasks = () => state.tasks.filter((t) => !t.done);
  const tasksFor = (iso) => state.tasks.filter((t) => t.date === iso);
  const tasksOfProject = (id) => state.tasks.filter((t) => t.projectId === id);

  const overdue = (base = todayISO()) =>
    state.tasks.filter((t) => !t.done && t.date < base);

  const duesoon = (days = 7, base = todayISO()) => {
    const end = addDays(base, days);
    return state.projects
      .filter((p) => p.status !== "archived" && p.deadline >= base && p.deadline <= end)
      .sort((a, b) => a.deadline.localeCompare(b.deadline));
  };

  const projectProgress = (id) => {
    const mine = tasksOfProject(id);
    if (!mine.length) return { total: 0, done: 0, pct: 0 };
    const done = mine.filter((t) => t.done).length;
    return { total: mine.length, done, pct: Math.round((done / mine.length) * 100) };
  };

  const milestoneProgress = (projectId, milestoneId) => {
    const mine = state.tasks.filter((t) => t.projectId === projectId && t.milestoneId === milestoneId);
    if (!mine.length) return { total: 0, done: 0, pct: 0 };
    const done = mine.filter((t) => t.done).length;
    return { total: mine.length, done, pct: Math.round((done / mine.length) * 100) };
  };

  const habitDone = (h, iso = todayISO()) => !!h.log[iso];

  const habitStreak = (h, base = todayISO()) => {
    let streak = 0;
    let d = h.log[base] ? base : addDays(base, -1);
    // today not yet done does not break yesterday's streak
    for (let i = 0; i < 400; i++) {
      if (h.log[d]) { streak++; d = addDays(d, -1); }
      else break;
    }
    return streak;
  };

  const habitWeek = (h, base = todayISO()) => {
    const out = [];
    for (let i = 6; i >= 0; i--) {
      const d = addDays(base, -i);
      out.push({ date: d, done: !!h.log[d] });
    }
    return out;
  };

  const habitConsistency = (h, days = 30, base = todayISO()) => {
    let n = 0;
    for (let i = 0; i < days; i++) if (h.log[addDays(base, -i)]) n++;
    return Math.round((n / days) * 100);
  };

  const todayStats = (base = todayISO()) => {
    const list = tasksFor(base);
    const done = list.filter((t) => t.done).length;
    const plannedMin = list.reduce((n, t) => n + (t.duration || 0), 0);
    const doneMin = list.filter((t) => t.done).reduce((n, t) => n + (t.duration || 0), 0);
    return {
      total: list.length,
      done,
      pct: list.length ? Math.round((done / list.length) * 100) : 0,
      plannedMin,
      doneMin,
    };
  };

  const priorities = (base = todayISO()) => {
    return tasksFor(base).filter((t) => !t.done)
      .sort((a, b) => (a.priority || 2) - (b.priority || 2))
      .slice(0, 3);
  };

  const focusMinutes = (iso) =>
    state.focusSessions.filter((s) => s.date === iso).reduce((n, s) => n + s.minutes, 0);

  const unreadCount = () => state.notifications.filter((n) => !n.read).length;

  const searchAll = (q) => {
    const query = String(q || "").trim().toLowerCase();
    if (!query) return { tasks: [], projects: [], notes: [], habits: [] };
    const has = (s) => String(s || "").toLowerCase().includes(query);
    return {
      tasks: state.tasks.filter((t) => has(t.title)).slice(0, 6),
      projects: state.projects.filter((p) => has(p.name) || has(p.description)).slice(0, 4),
      notes: state.notes.filter((n) => has(n.title) || has(n.body) || (n.tags || []).some(has)).slice(0, 5),
      habits: state.habits.filter((h) => has(h.name)).slice(0, 5),
    };
  };

  const notesForProject = (id) => state.notes.filter((n) => n.projectId === id);
  const tasksForNote = (n) => (n.taskIds || []).map(task).filter(Boolean);

  const relatedNotes = (n) => {
    const tags = new Set(n.tags || []);
    return state.notes
      .filter((o) => o.id !== n.id && (o.tags || []).some((t) => tags.has(t)))
      .slice(0, 4);
  };

  /* ---------- actions ---------- */

  const addTask = (partial) => set((s) => {
    const t = Object.assign({
      id: uid("t"),
      title: "Untitled task",
      projectId: null,
      milestoneId: null,
      date: todayISO(),
      start: null,
      duration: 30,
      priority: 2,
      done: false,
      deps: [],
      notes: "",
      rescheduled: 0,
      createdAt: todayISO(),
      completedAt: null,
    }, partial);
    s.tasks.push(t);
    return t;
  }, "task:add");

  const updateTask = (id, patch) => set((s) => {
    const t = s.tasks.find((x) => x.id === id);
    if (!t) return null;
    Object.assign(t, patch);
    if (patch.done === true && !t.completedAt) t.completedAt = todayISO();
    if (patch.done === false) t.completedAt = null;
    return t;
  }, "task:update");

  const toggleTask = (id) => {
    const t = task(id);
    if (!t) return;
    updateTask(id, { done: !t.done });
  };

  const deleteTask = (id) => set((s) => {
    s.tasks = s.tasks.filter((t) => t.id !== id);
    s.notes.forEach((n) => { n.taskIds = (n.taskIds || []).filter((x) => x !== id); });
  }, "task:delete");

  const moveTask = (id, date, start) => set((s) => {
    const t = s.tasks.find((x) => x.id === id);
    if (!t) return;
    if (t.date !== date) t.rescheduled = (t.rescheduled || 0) + 1;
    t.date = date;
    t.start = start;
  }, "task:move");

  const addProject = (partial) => set((s) => {
    const p = Object.assign({
      id: uid("p"),
      name: "Untitled project",
      color: "cobalt",
      status: "active",
      deadline: addDays(todayISO(), 21),
      description: "",
      createdAt: todayISO(),
      milestones: [],
    }, partial);
    s.projects.push(p);
    return p;
  }, "project:add");

  const updateProject = (id, patch) => set((s) => {
    const p = s.projects.find((x) => x.id === id);
    if (p) Object.assign(p, patch);
    return p;
  }, "project:update");

  const archiveProject = (id) => set((s) => {
    const p = s.projects.find((x) => x.id === id);
    if (p) p.status = p.status === "archived" ? "active" : "archived";
  }, "project:archive");

  const deleteProject = (id) => set((s) => {
    s.projects = s.projects.filter((p) => p.id !== id);
    s.tasks = s.tasks.filter((t) => t.projectId !== id);
    s.notes.forEach((n) => { if (n.projectId === id) n.projectId = null; });
  }, "project:delete");

  const addMilestone = (projectId, title, due) => set((s) => {
    const p = s.projects.find((x) => x.id === projectId);
    if (!p) return null;
    const m = { id: uid("m"), title, due: due || p.deadline };
    p.milestones.push(m);
    return m;
  }, "milestone:add");

  const logHabit = (id, iso, value) => set((s) => {
    const h = s.habits.find((x) => x.id === id);
    if (!h) return;
    if (value) h.log[iso] = true;
    else delete h.log[iso];
  }, "habit:log");

  const toggleHabitToday = (id) => {
    const h = habit(id);
    if (h) logHabit(id, todayISO(), !h.log[todayISO()]);
  };

  const addHabit = (name, unit) => set((s) => {
    s.habits.push({ id: uid("h"), name, unit: unit || "day", createdAt: todayISO(), log: {} });
  }, "habit:add");

  const deleteHabit = (id) => set((s) => {
    s.habits = s.habits.filter((h) => h.id !== id);
  }, "habit:delete");

  const addNote = (partial) => set((s) => {
    const n = Object.assign({
      id: uid("n"),
      title: "Untitled note",
      body: "",
      tags: [],
      projectId: null,
      taskIds: [],
      attachments: [],
      createdAt: todayISO(),
      updatedAt: todayISO(),
    }, partial);
    s.notes.unshift(n);
    return n;
  }, "note:add");

  const updateNote = (id, patch) => set((s) => {
    const n = s.notes.find((x) => x.id === id);
    if (!n) return;
    Object.assign(n, patch);
    n.updatedAt = todayISO();
    return n;
  }, "note:update");

  const deleteNote = (id) => set((s) => {
    s.notes = s.notes.filter((n) => n.id !== id);
  }, "note:delete");

  const addEvent = (partial) => set((s) => {
    const e = Object.assign({
      id: uid("e"),
      title: "New event",
      date: todayISO(),
      start: 600,
      end: 660,
      fixed: true,
      location: "",
    }, partial);
    s.events.push(e);
    return e;
  }, "event:add");

  const updateEvent = (id, patch) => set((s) => {
    const e = s.events.find((x) => x.id === id);
    if (e) Object.assign(e, patch);
  }, "event:update");

  const deleteEvent = (id) => set((s) => {
    s.events = s.events.filter((e) => e.id !== id);
  }, "event:delete");

  const markNotifications = (read = true) => set((s) => {
    s.notifications.forEach((n) => { n.read = read; });
  }, "notifications:read");

  const readNotification = (id) => set((s) => {
    const n = s.notifications.find((x) => x.id === id);
    if (n) n.read = true;
  }, "notification:read");

  const dismissNotification = (id) => set((s) => {
    s.notifications = s.notifications.filter((n) => n.id !== id);
  }, "notification:dismiss");

  const addNotification = (n) => set((s) => {
    s.notifications.unshift(Object.assign({
      id: uid("nt"),
      createdAt: Date.now(),
      read: false,
      actions: ["dismiss"],
    }, n));
  }, "notification:add");

  const addFocusSession = (session) => set((s) => {
    s.focusSessions.unshift(Object.assign({ id: uid("f"), date: todayISO(), mode: "focus" }, session));
  }, "focus:add");

  const updateSettings = (patch) => set((s) => {
    Object.assign(s.settings, patch);
    s.profile.name = s.settings.name;
    s.profile.initials = s.settings.initials;
    s.profile.role = s.settings.role;
  }, "settings:update");

  const setPlan = (iso, plan) => set((s) => {
    s.plans[iso] = plan;
  }, "plan:set");

  const addWin = (text) => set((s) => {
    s.reflection.wins.unshift({ text, date: todayISO() });
  }, "reflection:add");

  /* week ledger used by Reflection */
  const weekStats = (weekStart) => {
    const days = [];
    for (let i = 0; i < 7; i++) days.push(addDays(weekStart, i));
    const inWeek = (iso) => days.includes(iso);
    const tasks = state.tasks.filter((t) => inWeek(t.date));
    const doneTasks = tasks.filter((t) => t.done);
    const focus = state.focusSessions.filter((f) => inWeek(f.date)).reduce((n, f) => n + f.minutes, 0);
    const habitPct = state.habits.length
      ? Math.round(
          (state.habits.reduce((n, h) => n + days.filter((d) => h.log[d]).length, 0) /
            (state.habits.length * 7)) * 100
        )
      : 0;
    return {
      days,
      tasks,
      done: doneTasks.length,
      total: tasks.length,
      pct: tasks.length ? Math.round((doneTasks.length / tasks.length) * 100) : 0,
      focus,
      habitPct,
      doneTasks,
    };
  };

  POS.store = {
    load, get, set, subscribe, reset, importState, flush,
    project, task, note, habit, activeProjects, openTasks, tasksFor, tasksOfProject,
    overdue, duesoon, projectProgress, milestoneProgress,
    habitDone, habitStreak, habitWeek, habitConsistency,
    todayStats, priorities, focusMinutes, unreadCount, searchAll,
    notesForProject, tasksForNote, relatedNotes, weekStats,
    actions: {
      addTask, updateTask, toggleTask, deleteTask, moveTask,
      addProject, updateProject, archiveProject, deleteProject, addMilestone,
      logHabit, toggleHabitToday, addHabit, deleteHabit,
      addNote, updateNote, deleteNote,
      addEvent, updateEvent, deleteEvent,
      markNotifications, readNotification, dismissNotification, addNotification,
      addFocusSession, updateSettings, setPlan, addWin,
    },
  };
})();
