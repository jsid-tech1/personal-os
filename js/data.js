/* Personal OS — every account starts with its own empty workspace.
   There is no demo persona, no sample tasks and no shared seed data. */
(function () {
  "use strict";
  const POS = window.POS;

  function displayName(user = {}) {
    const name = String(user.name || "").trim();
    if (name) return name;
    const email = String(user.email || "").split("@")[0].replace(/[._-]+/g, " ").trim();
    return email ? email.replace(/\b[a-z]/g, (letter) => letter.toUpperCase()) : "Your workspace";
  }

  function initialsFor(name) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "OS";
  }

  function buildEmpty(user = {}) {
    const name = displayName(user);
    const initials = initialsFor(name);
    return {
      version: 1,
      profile: { name, initials, role: "" },
      projects: [],
      tasks: [],
      events: [],
      habits: [],
      notes: [],
      brainDumps: [],
      notifications: [],
      focusSessions: [],
      settings: {
        name,
        role: "",
        initials,
        capacity: 120,
        workDays: [1, 2, 3, 4, 5],
        weekStartsMonday: true,
        focusLength: 25,
        aiAutoReschedule: true,
        aiTone: "direct",
        notifyTasks: true,
        notifyDeadlines: true,
        notifyHabits: true,
        notifyReschedule: true,
        quietHours: "22:00 – 07:00",
        integration: { calendar: "not-connected", backup: "local" },
        onboarded: false,
      },
      reflection: { wins: [], note: "" },
      plans: {},
      proposals: {},
      mosaics: {},
    };
  }

  POS.buildEmpty = buildEmpty;
})();
