/* Personal OS — seeded sample data.
   Everything is relative to the day the app is first opened, so the
   product always feels lived-in. One person: Chirag, design student. */
(function () {
  "use strict";
  const POS = window.POS;
  const { todayISO, addDays, toISO, fromISO } = POS.util;

  function buildSeed() {
    const T = todayISO();
    const day = (n) => addDays(T, n);

    /* ---------- projects ---------- */
    const projects = [
      {
        id: "portfolio",
        name: "Design Portfolio",
        color: "cobalt",
        status: "active",
        deadline: day(27),
        description:
          "A portfolio that reads like a designed object: three case studies, a clear point of view, and no template energy. Target: live and linked from applications by the end of the month.",
        createdAt: day(-24),
        milestones: [
          { id: "pf_m1", title: "Research & positioning", due: day(1) },
          { id: "pf_m2", title: "Case studies", due: day(8) },
          { id: "pf_m3", title: "Build the site", due: day(18) },
          { id: "pf_m4", title: "Publish & apply", due: day(27) },
        ],
      },
      {
        id: "motion",
        name: "Motion Design",
        color: "teal",
        status: "active",
        deadline: day(45),
        description:
          "Learn motion properly, not superficially. Easing, timing, and restraint first; a twenty-second reel at the end that proves it.",
        createdAt: day(-16),
        milestones: [
          { id: "mo_m1", title: "Core principles", due: day(6) },
          { id: "mo_m2", title: "Studies", due: day(22) },
          { id: "mo_m3", title: "Showreel", due: day(45) },
        ],
      },
      {
        id: "branding",
        name: "Branding Project",
        color: "plum",
        status: "active",
        deadline: day(18),
        description:
          "Identity for Aster Coffee — a quiet, industrial roastery. Client wants restraint: one typeface family, warm neutrals, no illustration.",
        createdAt: day(-31),
        milestones: [
          { id: "br_m1", title: "Identity direction", due: day(2) },
          { id: "br_m2", title: "System", due: day(10) },
          { id: "br_m3", title: "Deliverables", due: day(18) },
        ],
      },
      {
        id: "internships",
        name: "Internship Applications",
        color: "ochre",
        status: "active",
        deadline: day(30),
        description:
          "Eight studios, two batches, follow-ups tracked. The portfolio does the arguing; the applications just need to arrive on time and sound human.",
        createdAt: day(-9),
        milestones: [
          { id: "in_m1", title: "Materials", due: day(5) },
          { id: "in_m2", title: "Shortlist", due: day(7) },
          { id: "in_m3", title: "Send & follow up", due: day(30) },
        ],
      },
      {
        id: "archive_1",
        name: "Type Specimen Zine",
        color: "slate",
        status: "archived",
        deadline: day(-40),
        description: "A 16-page specimen printed for the end-of-term show. Archived after the print run.",
        createdAt: day(-120),
        milestones: [{ id: "tz_m1", title: "Print & bind", due: day(-40) }],
      },
    ];

    /* ---------- tasks ---------- */
    /* t title · p project · m milestone index · d day offset · s start · dur minutes
       pri 1 high 2 normal 3 low · done · deps titles for dependency copy */
    const raw = [
      // portfolio — today and overdue
      { t: "Audit five portfolios I admire", p: "portfolio", m: 0, d: -3, s: 600, dur: 45, done: true },
      { t: "Write the positioning statement", p: "portfolio", m: 0, d: -2, s: 600, dur: 40, done: true },
      { t: "Pick the three case studies to tell", p: "portfolio", m: 0, d: 0, s: 540, dur: 30, pri: 1 },
      { t: "Outline case study 1: Ledger redesign", p: "portfolio", m: 1, d: 0, s: 600, dur: 90, pri: 1, deps: ["Pick the three case studies to tell"] },
      { t: "Draft case study 1 copy", p: "portfolio", m: 1, d: -1, s: 900, dur: 60, pri: 1, deps: ["Outline case study 1: Ledger redesign"] },
      { t: "Outline case study 2: Transit app", p: "portfolio", m: 1, d: 1, s: 540, dur: 75, pri: 2 },
      { t: "Gather process artefacts", p: "portfolio", m: 1, d: 1, s: 840, dur: 45, pri: 3 },
      { t: "Choose type & colour system", p: "portfolio", m: 2, d: 2, s: 600, dur: 60, pri: 2 },
      { t: "Build home + project index", p: "portfolio", m: 2, d: 3, s: 570, dur: 120, pri: 1 },
      { t: "Build case study template", p: "portfolio", m: 2, d: 4, s: 570, dur: 120, pri: 2 },
      { t: "Responsive pass at 390px", p: "portfolio", m: 2, d: 5, s: 900, dur: 60, pri: 2 },
      { t: "Write the about page", p: "portfolio", m: 3, d: 6, s: 600, dur: 45, pri: 3 },
      { t: "Lighthouse and accessibility pass", p: "portfolio", m: 3, d: 7, s: 660, dur: 60, pri: 2 },
      { t: "Deploy and check every link", p: "portfolio", m: 3, d: 8, s: 540, dur: 30, pri: 1 },

      // motion
      { t: "Watch easing fundamentals", p: "motion", m: 0, d: -4, s: 780, dur: 45, done: true },
      { t: "Recreate three UI transitions", p: "motion", m: 0, d: -1, s: 840, dur: 60, pri: 2, deps: ["Watch easing fundamentals"] },
      { t: "Notes on timing curves", p: "motion", m: 0, d: 0, s: 960, dur: 30, pri: 3 },
      { t: "Five-second logo reveal study", p: "motion", m: 1, d: 2, s: 840, dur: 90, pri: 2 },
      { t: "Micro-interaction study: toggles", p: "motion", m: 1, d: 4, s: 840, dur: 60, pri: 3 },
      { t: "Loading sequence study", p: "motion", m: 1, d: 6, s: 840, dur: 90, pri: 3 },
      { t: "Select the best six clips", p: "motion", m: 2, d: 8, s: 960, dur: 45, pri: 2 },
      { t: "Cut the 20-second showreel", p: "motion", m: 2, d: 10, s: 900, dur: 120, pri: 1 },

      // branding
      { t: "Moodboard: quiet industrial", p: "branding", m: 0, d: -5, s: 660, dur: 60, done: true },
      { t: "Three wordmark directions", p: "branding", m: 0, d: -2, s: 600, dur: 90, done: true },
      { t: "Pick direction with the client", p: "branding", m: 0, d: 0, s: 690, dur: 45, pri: 2 },
      { t: "Colour and type tokens", p: "branding", m: 1, d: 1, s: 660, dur: 60, pri: 2 },
      { t: "Grid and layout rules", p: "branding", m: 1, d: 2, s: 540, dur: 60, pri: 3 },
      { t: "Component sketch sheet", p: "branding", m: 1, d: 3, s: 840, dur: 75, pri: 3 },
      { t: "Brand guide PDF", p: "branding", m: 2, d: 7, s: 600, dur: 120, pri: 1 },
      { t: "Export the asset pack", p: "branding", m: 2, d: 9, s: 660, dur: 45, pri: 2 },

      // internships
      { t: "Rewrite the CV for studio roles", p: "internships", m: 0, d: 0, s: 840, dur: 60, pri: 2 },
      { t: "Portfolio PDF v1", p: "internships", m: 0, d: 3, s: 960, dur: 90, pri: 2, deps: ["Build home + project index"] },
      { t: "Shortlist eight studios", p: "internships", m: 1, d: 2, s: 990, dur: 30, pri: 2 },
      { t: "Find three warm intros", p: "internships", m: 1, d: 4, s: 990, dur: 30, pri: 3 },
      { t: "Send applications, batch one", p: "internships", m: 2, d: 5, s: 600, dur: 60, pri: 1, deps: ["Portfolio PDF v1"] },
      { t: "Send applications, batch two", p: "internships", m: 2, d: 8, s: 600, dur: 60, pri: 2 },
      { t: "Follow up, seven days later", p: "internships", m: 2, d: 14, s: 600, dur: 30, pri: 3 },

      // personal
      { t: "Book the dentist", p: null, m: null, d: 2, s: 900, dur: 15, pri: 3 },
      { t: "Renew library books", p: null, m: null, d: 0, dur: 10, pri: 3 },
      { t: "Review the monthly budget", p: null, m: null, d: 1, s: 1080, dur: 30, pri: 3 },
      { t: "Buy a new sketchbook", p: null, m: null, d: 4, s: 1080, dur: 15, pri: 3 },
    ];

    const tasks = raw.map((r, i) => ({
      id: "t" + String(i + 1).padStart(3, "0"),
      title: r.t,
      projectId: r.p,
      milestoneId: r.p && r.m != null ? projects.find((p) => p.id === r.p).milestones[r.m].id : null,
      date: day(r.d),
      start: r.s != null ? r.s : null,
      duration: r.dur,
      priority: r.pri || 2,
      done: !!r.done,
      deps: r.deps || [],
      notes: "",
      rescheduled: 0,
      createdAt: day(r.d - 2),
      completedAt: r.done ? day(r.d) : null,
    }));

    /* ---------- calendar events (fixed, external) ---------- */
    const events = [
      { id: "e1", title: "Studio standup", date: day(0), start: 570, end: 585, fixed: true, location: "Room 2.4" },
      { id: "e2", title: "Design review — Aster", date: day(0), start: 900, end: 960, fixed: true, location: "Video call" },
      { id: "e3", title: "Gym", date: day(0), start: 1110, end: 1170, fixed: false, location: "" },
      { id: "e4", title: "Type systems lecture", date: day(1), start: 780, end: 870, fixed: true, location: "Lecture hall B" },
      { id: "e5", title: "Call with Maya", date: day(2), start: 660, end: 690, fixed: true, location: "Phone" },
      { id: "e6", title: "Print pickup", date: day(3), start: 1020, end: 1060, fixed: false, location: "Press room" },
      { id: "e7", title: "Tutor session", date: day(4), start: 600, end: 660, fixed: true, location: "Office hours" },
    ];

    /* ---------- habits ---------- */
    const habitSeed = [
      { name: "Deep work · 90 min", unit: "session", pattern: "111101111011110111101111011110" },
      { name: "Read 20 pages", unit: "pages", pattern: "110111011011110110111101111011" },
      { name: "Walk 8,000 steps", unit: "walk", pattern: "111011110111101111011110011110" },
      { name: "No phone before 9", unit: "morning", pattern: "101101011010110101101011010110" },
      { name: "Sketch one frame", unit: "frame", pattern: "110110111011011011101101110110" },
    ];
    const habits = habitSeed.map((h, idx) => {
      const log = {};
      for (let i = 0; i < 30; i++) {
        const d = addDays(T, i - 29);
        if (h.pattern[i] === "1") log[d] = true;
      }
      // today starts unlogged so the dashboard has something to do
      delete log[T];
      return {
        id: "h" + (idx + 1),
        name: h.name,
        unit: h.unit,
        createdAt: day(-90),
        log,
      };
    });

    /* ---------- notes ---------- */
    const notes = [
      {
        id: "n1",
        title: "Portfolio positioning",
        body:
          "The thread across all three case studies: I take messy operational problems and make them feel calm.\n\nLedger: reconciliation that took four screens becomes one.\nTransit: a schedule that people stopped trusting becomes legible.\nAster: a brand with eleven typefaces becomes one family.\n\nSo the sentence is: \"Design that makes complex systems feel obvious.\" Not \"passionate designer\" — a claim someone could disagree with.",
        tags: ["portfolio", "writing"],
        projectId: "portfolio",
        taskIds: ["t003", "t004"],
        attachments: [],
        createdAt: day(-6),
        updatedAt: day(-1),
      },
      {
        id: "n2",
        title: "Motion: timing is the whole job",
        body:
          "Re-watched the easing fundamentals. Two things worth keeping:\n\n1. Linear motion reads as mechanical because nothing in the physical world starts and stops instantly. The curve is the material.\n2. The 100–200ms range is for feedback; 300–500ms is for transitions between states. Anything longer needs a reason a person can see.\n\nStudy list: toggles, loading, page transitions, drag inertia.",
        tags: ["motion", "learning"],
        projectId: "motion",
        taskIds: ["t016"],
        attachments: [],
        createdAt: day(-3),
        updatedAt: day(-3),
      },
      {
        id: "n3",
        title: "Client call — Aster direction",
        body:
          "They picked direction B (the narrower wordmark, warm neutrals). Two constraints from the call:\n\n- No illustration. Photography only, and only if it is actually theirs.\n- One typeface family across print and screen.\n\nThey asked for the guide by the 24th. I should show the grid rules before the asset pack, not after.",
        tags: ["branding", "client"],
        projectId: "branding",
        taskIds: ["t026", "t030"],
        attachments: [{ name: "aster-call-notes.txt", size: "2 KB" }],
        createdAt: day(-2),
        updatedAt: day(-2),
      },
      {
        id: "n4",
        title: "Studio shortlist",
        body:
          "Eight to start, in order of honest fit:\n\n1. Output — product work with a strong type culture\n2. DIA — brand systems, slow and careful\n3. Order — editorial leaning, small team\n4. Studio Nari — motion-adjacent\n5. Pentagram (long shot) — needs a sharper portfolio first\n6. Raw Color — colour and material\n7. Build — digital, ships fast\n8. Resn — playful, motion heavy\n\nWarm intros: Priya (Output), Tom (Order), the second-year group chat (DIA).",
        tags: ["internships", "research"],
        projectId: "internships",
        taskIds: ["t033", "t034"],
        attachments: [],
        createdAt: day(-4),
        updatedAt: day(-1),
      },
      {
        id: "n5",
        title: "Reading — The Elements of Typographic Style",
        body:
          "Chapter on the grand design: the page is a system before it is a surface. Measure, leading, and the ratio between them do more work than any decoration.\n\nQuotes to keep:\n\"The typographer's one essential task is to interpret and communicate the text.\"\n\"Letters have a life and dignity of their own.\"",
        tags: ["reading", "typography"],
        projectId: null,
        taskIds: [],
        attachments: [],
        createdAt: day(-12),
        updatedAt: day(-8),
      },
      {
        id: "n6",
        title: "Week 46 review",
        body:
          "What moved: portfolio structure, two case study outlines, Aster direction locked.\nWhat stalled: motion study two days in a row; I kept waiting for a clean hour.\nWhat to change: put the study at 9am before email, not at 4pm after everything.\n\nOne win worth naming: the positioning statement is honest and I would put it on a wall.",
        tags: ["reflection", "weekly"],
        projectId: null,
        taskIds: [],
        attachments: [],
        createdAt: day(-5),
        updatedAt: day(-5),
      },
    ];

    /* ---------- brain dumps ---------- */
    const brainDumps = [
      {
        id: "bd1",
        text:
          "I want to finish the portfolio in 30 days, learn motion design properly, apply to eight studios and finish the Aster branding. Also need to renew library books and book a dentist at some point.",
        createdAt: day(-1) + "T18:42",
        status: "processed",
        extracted: 9,
      },
      {
        id: "bd2",
        text:
          "Case study copy is harder than the design. Maybe write it as a conversation with Maya instead of an essay. Also: ask Tom for a reference before Friday.",
        createdAt: day(-2) + "T21:10",
        status: "processed",
        extracted: 3,
      },
      {
        id: "bd3",
        text: "Idea: the portfolio could open with the three problems, not the three projects. Try it as a variant before committing.",
        createdAt: day(-4) + "T09:05",
        status: "kept",
        extracted: 1,
      },
    ];

    /* ---------- notifications ---------- */
    const notifications = [
      {
        id: "nt1",
        type: "reminder",
        title: "Design review starts in 15 minutes",
        body: "Aster branding · Video call · 3:00 pm",
        createdAt: Date.now() - 12 * 60000,
        read: false,
        taskId: null,
        actions: ["start", "dismiss"],
      },
      {
        id: "nt2",
        type: "overdue",
        title: "Draft case study 1 copy is a day behind",
        body: "I can move it to tomorrow at 9:00 and keep the rest of the week intact.",
        createdAt: Date.now() - 3 * 3600000,
        read: false,
        taskId: "t005",
        actions: ["reschedule", "dismiss"],
      },
      {
        id: "nt3",
        type: "deadline",
        title: "Portfolio milestone due in 2 days",
        body: "Case studies — 4 of 5 tasks done.",
        createdAt: Date.now() - 5 * 3600000,
        read: false,
        taskId: null,
        actions: ["view", "dismiss"],
      },
      {
        id: "nt4",
        type: "habit",
        title: "Sketch one frame",
        body: "You have drawn on 18 of the last 30 days. The streak is at 4.",
        createdAt: Date.now() - 9 * 3600000,
        read: true,
        taskId: null,
        actions: ["done", "dismiss"],
      },
      {
        id: "nt5",
        type: "reschedule",
        title: "Three tasks need a new home this week",
        body: "There is room on Thursday and Friday without touching your fixed events.",
        createdAt: Date.now() - 26 * 3600000,
        read: true,
        taskId: null,
        actions: ["reschedule", "dismiss"],
      },
    ];

    /* ---------- focus sessions ---------- */
    const focusSessions = [
      { id: "f1", taskId: "t001", date: day(-3), minutes: 45, mode: "focus" },
      { id: "f2", taskId: "t002", date: day(-2), minutes: 40, mode: "focus" },
      { id: "f3", taskId: "t014", date: day(-1), minutes: 25, mode: "pomodoro" },
      { id: "f4", taskId: "t015", date: day(-1), minutes: 50, mode: "pomodoro" },
      { id: "f5", taskId: "t004", date: day(0), minutes: 50, mode: "pomodoro" },
      { id: "f6", taskId: "t004", date: day(0), minutes: 25, mode: "pomodoro" },
    ];

    /* ---------- settings ---------- */
    const settings = {
      name: "Chirag Sharma",
      role: "Design student · Rotterdam",
      initials: "CS",
      capacity: 300,
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
      onboarded: true,
    };

    const reflection = {
      wins: [
        { text: "Positioning statement finally said something specific", date: day(-2) },
        { text: "Aster picked direction B without changes", date: day(-2) },
        { text: "Two case study outlines done in one sitting", date: day(-1) },
      ],
      note: "The week worked when the hard thing came first. It fell apart on the days I opened email before the file.",
    };

    return {
      version: 1,
      seededAt: T,
      profile: {
        name: settings.name,
        initials: settings.initials,
        role: settings.role,
      },
      projects,
      tasks,
      events,
      habits,
      notes,
      brainDumps,
      notifications,
      focusSessions,
      settings,
      reflection,
      plans: {},
      proposals: {},
    };
  }

  // Demo data is opt-in. A new account starts with its own empty workspace.
  function buildEmpty(user = {}) {
    const data = buildSeed();
    for (const key of ["projects", "tasks", "events", "habits", "notes", "brainDumps", "notifications", "focusSessions"]) data[key] = [];
    const name = user.name || "Your workspace";
    const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join("").toUpperCase();
    Object.assign(data.settings, { name, initials, role: "", onboarded: false, capacity: 120, workDays: [1, 2, 3, 4, 5] });
    data.mosaics = {};
    data.profile = { name, initials, role: "" };
    data.reflection = { wins: [], note: "" };
    return data;
  }

  POS.buildSeed = buildSeed;
  POS.buildEmpty = buildEmpty;
})();
