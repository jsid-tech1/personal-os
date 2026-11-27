/* Personal OS — mock intelligence.
   Deterministic, local, explainable. No model, no network, no key.
   Every result is a proposal; only the views may commit it. */
(function () {
  "use strict";
  const POS = window.POS;
  const { todayISO, addDays, fromISO, fmtDate, fmtDur, minutesOf, fmtMin, todayISO: today } = POS.util;

  const wait = (ms) => POS.util.delay(ms);

  /* =========================================================
     Capture parsing
     ========================================================= */

  const PROJECT_WORDS = {
    portfolio: ["portfolio", "case study", "case studies", "site", "website"],
    motion: ["motion", "animation", "animate", "easing", "reel", "after effects"],
    branding: ["brand", "branding", "identity", "aster", "logo", "wordmark"],
    internships: ["internship", "internships", "studio", "application", "apply", "cv", "résumé", "resume"],
  };

  const VERBS = [
    "book", "renew", "email", "call", "buy", "order", "pay", "draft", "write", "review",
    "send", "ask", "outline", "finish", "read", "watch", "sketch", "plan", "make", "fix",
    "update", "prepare", "schedule", "cancel", "print", "export", "deploy", "pick", "choose",
    "gather", "shortlist", "follow", "rewrite", "build", "cut", "record", "test",
  ];

  const DURATION_HINTS = [
    [/\b(call|email|message|text|book|renew|buy|order|pay|cancel)\b/i, 15],
    [/\b(review|read|test|check|update|follow up|shortlist|choose|pick)\b/i, 30],
    [/\b(write|draft|outline|prepare|plan|sketch|record|gather)\b/i, 45],
    [/\b(build|design|finish|cut|edit|rewrite)\b/i, 60],
    [/\b(learn|study|master)\b/i, 90],
  ];

  function parseWhen(text, base = todayISO()) {
    const t = String(text).toLowerCase();
    let m;
    if (/\btoday\b/.test(t)) return { date: base, label: "Today" };
    if (/\btomorrow\b/.test(t)) return { date: addDays(base, 1), label: "Tomorrow" };
    if ((m = t.match(/\bin (\d{1,2}) days?\b/))) {
      const n = Number(m[1]);
      return { date: addDays(base, n), label: `In ${n} days` };
    }
    if (/\bnext week\b/.test(t)) return { date: addDays(base, 7), label: "Next week" };
    if (/\bthis weekend\b/.test(t)) return { date: addDays(base, 2), label: "This weekend" };
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    for (let i = 0; i < days.length; i++) {
      const re = new RegExp("\\b(by |on |this )?" + days[i] + "\\b");
      if (re.test(t)) {
        const now = fromISO(base).getDay();
        let diff = (i - now + 7) % 7;
        if (diff === 0) diff = 7;
        return { date: addDays(base, diff), label: days[i][0].toUpperCase() + days[i].slice(1) };
      }
    }
    if ((m = t.match(/\bby the (\d{1,2})(?:st|nd|rd|th)?\b/))) {
      const dayN = Number(m[1]);
      let d = new Date(fromISO(base));
      d.setDate(dayN);
      if (d < fromISO(base)) d.setMonth(d.getMonth() + 1);
      return { date: POS.util.toISO(d), label: `By the ${dayN}${ordinal(dayN)}` };
    }
    return null;
  }

  function ordinal(n) {
    if (n > 3 && n < 21) return "th";
    return ["th", "st", "nd", "rd"][n % 10] || "th";
  }

  function guessProject(text) {
    const t = String(text).toLowerCase();
    let best = null;
    let bestScore = 0;
    Object.entries(PROJECT_WORDS).forEach(([id, words]) => {
      const score = words.reduce((n, w) => n + (t.includes(w) ? w.split(" ").length : 0), 0);
      if (score > bestScore) { bestScore = score; best = id; }
    });
    return bestScore > 0 ? best : null;
  }

  function guessDuration(text) {
    for (const [re, min] of DURATION_HINTS) if (re.test(text)) return min;
    return 30;
  }

  function cleanTitle(s) {
    return String(s)
      .replace(/^(also\s+|and\s+|then\s+|i (also )?(need|want|should|have) to\s+|i want to\s+|i'd like to\s+)/i, "")
      .replace(/\b(at some point|sometime|soon|asap|please)\b/gi, "")
      .replace(/\s+/g, " ")
      .replace(/[.,;]+$/, "")
      .trim()
      .replace(/^./, (c) => c.toUpperCase());
  }

  function splitAmbitions(text) {
    const cleaned = String(text).replace(/\r/g, "").trim();
    const sentences = cleaned.split(/(?<=[.!?])\s+|\n+/).filter(Boolean);
    const out = [];
    sentences.forEach((sentence) => {
      const wants = /^i (want|need|would like|'d like)\b/i.test(sentence.trim());
      let parts;
      if (wants && /,| and /.test(sentence)) {
        parts = sentence
          .replace(/^i (want|need|would like|'d like) (to\s+)?/i, "")
          .split(/,\s*|\s+and\s+/i);
      } else if (/\band\b/i.test(sentence) && sentence.split(/\s+/).length > 8) {
        parts = sentence.split(/\s+and\s+/i);
      } else {
        parts = [sentence];
      }
      parts.forEach((p) => { if (p.trim()) out.push(p.trim()); });
    });
    return out;
  }

  function classify(fragment) {
    const s = fragment.toLowerCase();
    const when = parseWhen(fragment);
    const projectId = guessProject(fragment);
    const words = fragment.split(/\s+/).length;

    if (/^(idea|note|remember|thought|maybe|what if)\b/.test(s)) {
      return { type: "note", title: cleanTitle(fragment), confidence: 0.78 };
    }
    if (/\b(deadline|due|submission|hand in)\b/.test(s) && words <= 9) {
      return { type: "deadline", title: cleanTitle(fragment), confidence: 0.72 };
    }
    if (/^(i want|i need|i'd like|goal|learn|finish|complete|build|launch)\b/.test(s) && words > 3) {
      return { type: "goal", title: cleanTitle(fragment), confidence: 0.86 };
    }
    if (VERBS.some((v) => new RegExp("\\b" + v + "\\b").test(s)) || words <= 6) {
      return { type: "task", title: cleanTitle(fragment), confidence: when ? 0.91 : 0.8 };
    }
    return { type: "note", title: cleanTitle(fragment), confidence: 0.6 };
  }

  async function parseCapture(text, opts = {}) {
    await wait(opts.instant ? 60 : 850);
    const fragments = splitAmbitions(text);
    const items = fragments.map((frag, i) => {
      const base = classify(frag);
      const when = parseWhen(frag);
      const projectId = guessProject(frag);
      const duration = base.type === "task" ? guessDuration(frag) : null;
      return {
        id: "item" + i,
        type: base.type,
        title: base.title.replace(/^(Complete|Finish|Learn|Apply|Book)\b/, (m) => m),
        raw: frag,
        projectId,
        date: when ? when.date : base.type === "task" ? today() : null,
        duration,
        confidence: base.confidence,
        selected: true,
        note: when ? `Read “${when.label}” from your text.` : "",
      };
    });

    const goals = items.filter((i) => i.type === "goal");
    const tasks = items.filter((i) => i.type === "task");
    const notes = items.filter((i) => i.type === "note");
    const projectsTouched = [...new Set(items.map((i) => i.projectId).filter(Boolean))];

    const question =
      goals.length > 1
        ? `These look like ${goals.length} separate goals. Do you want ${goals.length} projects, or one project with parallel tracks?`
        : goals.length === 1 && !goals[0].projectId
        ? "Is this a new project, or part of something you already have?"
        : null;

    return {
      items,
      summary:
        items.length + " " + (items.length === 1 ? "thing" : "things") + " found: " +
        [
          goals.length ? `${goals.length} goal${goals.length > 1 ? "s" : ""}` : null,
          tasks.length ? `${tasks.length} task${tasks.length > 1 ? "s" : ""}` : null,
          notes.length ? `${notes.length} note${notes.length > 1 ? "s" : ""}` : null,
        ].filter(Boolean).join(", ") +
        ". Nothing is saved yet.",
      question,
      projectsTouched,
      local: true,
    };
  }

  /* =========================================================
     Goal breakdown
     ========================================================= */

  const TEMPLATES = {
    portfolio: {
      milestones: [
        {
          title: "Research & positioning",
          tasks: [
            { title: "Audit six portfolios and note what works", dur: 45 },
            { title: "Write the one-sentence positioning", dur: 40 },
            { title: "Choose three case studies", dur: 30 },
          ],
        },
        {
          title: "Case studies",
          tasks: [
            { title: "Outline case study one", dur: 90 },
            { title: "Draft case study one copy", dur: 60, after: 0 },
            { title: "Outline case study two", dur: 75 },
            { title: "Draft case study two copy", dur: 60, after: 2 },
            { title: "Write the third, shorter case study", dur: 45 },
          ],
        },
        {
          title: "Build the site",
          tasks: [
            { title: "Set type, colour and spacing tokens", dur: 60 },
            { title: "Build the home and project index", dur: 120 },
            { title: "Build the case study template", dur: 120 },
            { title: "Responsive pass at 390px", dur: 60 },
          ],
        },
        {
          title: "Publish & apply",
          tasks: [
            { title: "Write the about page", dur: 45 },
            { title: "Accessibility and performance pass", dur: 60 },
            { title: "Deploy and check every link", dur: 30 },
          ],
        },
      ],
      note: "The case study copy is the long pole. It is scheduled before any site work so the writing does not arrive last.",
    },
    motion: {
      milestones: [
        {
          title: "Core principles",
          tasks: [
            { title: "Study easing and timing fundamentals", dur: 60 },
            { title: "Recreate three UI transitions", dur: 90, after: 0 },
            { title: "Write your own timing rules", dur: 30, after: 1 },
          ],
        },
        {
          title: "Studies",
          tasks: [
            { title: "Five-second logo reveal", dur: 90 },
            { title: "Micro-interaction study: toggles and menus", dur: 60 },
            { title: "Loading sequence study", dur: 90 },
          ],
        },
        {
          title: "Showreel",
          tasks: [
            { title: "Select the six best clips", dur: 45 },
            { title: "Cut and grade a 20-second reel", dur: 120, after: 0 },
            { title: "Export at three aspect ratios", dur: 30, after: 1 },
          ],
        },
      ],
      note: "Each study is short on purpose. Motion is learned by finishing small things, not by watching more tutorials.",
    },
    branding: {
      milestones: [
        {
          title: "Direction",
          tasks: [
            { title: "Moodboard and reference set", dur: 60 },
            { title: "Three wordmark directions", dur: 90 },
            { title: "Client check-in and decision", dur: 45, after: 1 },
          ],
        },
        {
          title: "System",
          tasks: [
            { title: "Colour and type tokens", dur: 60 },
            { title: "Grid and layout rules", dur: 60 },
            { title: "Component and stationery sheet", dur: 75 },
          ],
        },
        {
          title: "Deliverables",
          tasks: [
            { title: "Brand guide, first full draft", dur: 120 },
            { title: "Export the asset pack", dur: 45 },
            { title: "Handover call and notes", dur: 30 },
          ],
        },
      ],
      note: "Direction is locked before any system work. Anything that arrives after approval goes into a separate phase.",
    },
    internships: {
      milestones: [
        {
          title: "Materials",
          tasks: [
            { title: "Rewrite the CV for studio roles", dur: 60 },
            { title: "Portfolio PDF, portrait and landscape", dur: 90 },
            { title: "One short, human cover note template", dur: 30 },
          ],
        },
        {
          title: "Shortlist",
          tasks: [
            { title: "Shortlist eight studios with real fit", dur: 30 },
            { title: "Find three warm introductions", dur: 30 },
            { title: "Check every application requirement", dur: 20 },
          ],
        },
        {
          title: "Send & follow up",
          tasks: [
            { title: "Send batch one, four studios", dur: 60 },
            { title: "Send batch two, four studios", dur: 60 },
            { title: "Follow up after seven days", dur: 30 },
          ],
        },
      ],
      note: "Two batches, a week apart. That gives the first four replies time to land before you send the rest.",
    },
    writing: {
      milestones: [
        { title: "Shape", tasks: [
          { title: "Write the argument in five sentences", dur: 30 },
          { title: "Outline the structure", dur: 45 },
          { title: "Collect sources and quotes", dur: 45 },
        ]},
        { title: "Draft", tasks: [
          { title: "First draft, no editing", dur: 120 },
          { title: "Cut ten percent", dur: 45 },
          { title: "Read it aloud and fix the seams", dur: 30 },
        ]},
        { title: "Ship", tasks: [
          { title: "Edit pass with fresh eyes", dur: 45 },
          { title: "Publish and write the summary", dur: 30 },
        ]},
      ],
      note: "Drafting happens in one block. Editing happens on a different day, by design.",
    },
    learning: {
      milestones: [
        { title: "Foundations", tasks: [
          { title: "Map the field and pick three sources", dur: 45 },
          { title: "Study the core vocabulary", dur: 60 },
          { title: "Write what you can explain already", dur: 30 },
        ]},
        { title: "Practice", tasks: [
          { title: "Exercise one, deliberately small", dur: 60 },
          { title: "Exercise two, slightly harder", dur: 60 },
          { title: "Exercise three, from memory", dur: 60 },
        ]},
        { title: "Proof", tasks: [
          { title: "Make one real thing with it", dur: 90 },
          { title: "Ask someone to critique it", dur: 30 },
          { title: "Write the summary for yourself", dur: 30 },
        ]},
      ],
      note: "Three exercises beat ten tutorials. The real thing is scheduled before the deadline, not after.",
    },
    default: {
      milestones: [
        { title: "Define", tasks: [
          { title: "Write the outcome in one sentence", dur: 30 },
          { title: "List what is already known", dur: 30 },
          { title: "Name the first obstacle", dur: 20 },
        ]},
        { title: "Build", tasks: [
          { title: "Make the smallest useful version", dur: 90 },
          { title: "Review it against the outcome", dur: 30 },
          { title: "Fix the one thing that matters", dur: 60 },
        ]},
        { title: "Finish", tasks: [
          { title: "Final pass and polish", dur: 45 },
          { title: "Deliver or publish", dur: 30 },
        ]},
      ],
      note: "The plan starts with the smallest useful version, so there is something real to react to early.",
    },
  };

  function templateFor(text) {
    const t = String(text).toLowerCase();
    if (/portfolio|case stud|website|site\b/.test(t)) return TEMPLATES.portfolio;
    if (/motion|animation|animate|easing|reel/.test(t)) return TEMPLATES.motion;
    if (/brand|identity|logo|wordmark|client/.test(t)) return TEMPLATES.branding;
    if (/internship|application|job|studio|apply/.test(t)) return TEMPLATES.internships;
    if (/write|article|essay|newsletter|book|zine/.test(t)) return TEMPLATES.writing;
    if (/learn|study|course|master|teach/.test(t)) return TEMPLATES.learning;
    return TEMPLATES.default;
  }

  function addWorkingDays(baseISO, capacity, planned, excludeWeekend = false) {
    let cursor = baseISO;
    let left = capacity;
    return (minutes) => {
      let guard = 0;
      while (guard++ < 400) {
        const dow = fromISO(cursor).getDay();
        const weekend = excludeWeekend && (dow === 0 || dow === 6);
        if (!weekend && left >= minutes) {
          left -= minutes;
          return cursor;
        }
        cursor = addDays(cursor, 1);
        left = capacity;
      }
      return cursor;
    };
  }

  async function breakdown(input, opts = {}) {
    await wait(opts.instant ? 80 : 1000);
    const title = (input.title || "Untitled goal").trim();
    const start = input.startDate || todayISO();
    const target = input.targetDate || addDays(start, 30);
    const capacity = Math.max(45, Number(input.capacity) || 240);
    const template = templateFor(title + " " + (input.description || ""));
    const totalDays = Math.max(1, POS.util.diffDays(target, start));
    const milestoneSpan = Math.max(1, Math.floor(totalDays / template.milestones.length));

    const nextDate = addWorkingDays(start, capacity, 0, input.weekendsOff !== false);
    const flat = [];
    const milestones = template.milestones.map((m, mi) => ({
      id: "ms" + (mi + 1),
      title: m.title,
      due: addDays(start, Math.min(totalDays, milestoneSpan * (mi + 1))),
      tasks: [],
    }));

    template.milestones.forEach((m, mi) => {
      m.tasks.forEach((t, ti) => {
        const date = nextDate(t.dur);
        const depIdx = t.after != null ? flat.findIndex((x) => x.mi === mi && x.ti === t.after) : -1;
        const task = {
          id: `ms${mi + 1}_t${ti + 1}`,
          title: t.title,
          duration: t.dur,
          date,
          milestoneId: milestones[mi].id,
          milestoneIndex: mi,
          priority: mi < 2 ? 1 : 2,
          dep: depIdx >= 0 ? flat[depIdx].id : null,
          depTitle: depIdx >= 0 ? flat[depIdx].title : null,
        };
        milestones[mi].tasks.push(task);
        flat.push({ mi, ti, ...task });
      });
    });

    const totalMinutes = flat.reduce((n, t) => n + t.duration, 0);
    const workdays = POS.util.DIFF || 0;
    const available = Math.max(0, totalDays) * capacity;
    const overbooked = totalMinutes > available;
    const endDate = flat.reduce((latest, t) => (t.date > latest ? t.date : latest), start);

    return {
      id: "goal_" + Date.now().toString(36),
      title,
      description: input.description || "",
      startDate: start,
      targetDate: target,
      capacity,
      milestones,
      totalMinutes,
      endDate,
      overbooked,
      explanation:
        `${flat.length} tasks across ${template.milestones.length} milestones — about ${fmtDur(totalMinutes)} of work. ` +
        `At ${fmtDur(capacity)} a day, the draft lands on ${fmtDate(endDate, "medium")}, ` +
        (overbooked
          ? `which is after your ${fmtDate(target, "medium")} target. Shorten the scope or add ${fmtDur(totalMinutes - available)} of capacity.`
          : `${Math.max(0, POS.util.diffDays(target, endDate))} days before your target.`),
      warnings: overbooked
        ? [`The work needs ${fmtDur(totalMinutes)}; the calendar only has ${fmtDur(available)} before ${fmtDate(target, "medium")}.`]
        : [],
      note: template.note,
      local: true,
    };
  }

  /* =========================================================
     Day planning
     ========================================================= */

  const DAY_START = 480;   // 8:00
  const DAY_END = 1260;    // 21:00

  function freeWindows(tasks, events, date, { includeCompleted = false, notBefore = DAY_START } = {}) {
    const busy = [];
    (events || []).filter((e) => e.date === date).forEach((e) => busy.push([e.start, e.end]));
    (tasks || []).filter((t) => t.date === date && t.start != null && (!t.done || includeCompleted))
      .forEach((t) => busy.push([t.start, t.start + t.duration]));
    busy.sort((a, b) => a[0] - b[0]);
    const windows = [];
    let cursor = Math.max(DAY_START, notBefore);
    busy.forEach(([s, e]) => {
      if (s > cursor) windows.push([cursor, Math.min(s, DAY_END)]);
      cursor = Math.max(cursor, e);
    });
    if (cursor < DAY_END) windows.push([cursor, DAY_END]);
    return windows.filter(([s, e]) => e > s);
  }

  function place(windows, minutes, buffer = 0) {
    for (let i = 0; i < windows.length; i++) {
      const [s, e] = windows[i];
      if (e - s >= minutes) {
        const start = s;
        windows[i] = [s + minutes + buffer, e];
        if (windows[i][1] - windows[i][0] < 10) windows.splice(i, 1);
        return start;
      }
    }
    return null;
  }

  function draftDay(date, { notBefore = DAY_START } = {}) {
    const store = POS.store;
    const st = store.get();
    const events = st.events;
    const windows = freeWindows(st.tasks, events, date, { includeCompleted: true, notBefore });
    const capacity = Math.max(60, Number(st.settings.capacity) || 300);

    const candidates = st.tasks
      .filter((t) => !t.done && t.date <= date)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
        if (a.priority !== b.priority) return a.priority - b.priority;
        return (b.duration || 0) - (a.duration || 0);
      });

    const placed = [];
    const blockItems = { morning: [], afternoon: [], evening: [] };
    const unplaced = [];
    let load = 0;

    const addToBlock = (t, start) => {
      blockItems[start < 720 ? "morning" : start < 1020 ? "afternoon" : "evening"].push({ id: t.id, start });
    };

    /* Work already on this day is a commitment: it consumes capacity first. */
    const fixedToday = candidates.filter((t) => t.start != null && t.date === date);
    fixedToday.forEach((t) => {
      const duration = t.duration || 30;
      placed.push({ taskId: t.id, start: t.start, duration, kept: true });
      addToBlock(t, t.start);
      load += duration;
    });

    /* Everything else is proposed into what capacity and free time remain. */
    candidates.filter((t) => !(t.start != null && t.date === date)).forEach((t) => {
      const duration = t.duration || 30;
      if (load + duration > capacity) { unplaced.push(t.id); return; }
      const start = place(windows, duration, 5);
      if (start == null) { unplaced.push(t.id); return; }
      placed.push({ taskId: t.id, start, duration });
      addToBlock(t, start);
      load += duration;
    });

    const blocks = {};
    Object.keys(blockItems).forEach((key) => {
      blocks[key] = blockItems[key].sort((a, b) => a.start - b.start).map((x) => x.id);
    });

    const remaining = candidates.length - placed.length;
    const overduePlaced = placed.filter((p) => {
      const t = candidates.find((c) => c.id === p.taskId);
      return t && t.date < date;
    }).length;

    return {
      date,
      blocks,
      placed,
      unplaced,
      load,
      capacity,
      explanation:
        `${fixedToday.length} scheduled task${fixedToday.length === 1 ? " stays" : "s stay"} in place. ` +
        (overduePlaced
          ? `${overduePlaced} overdue item${overduePlaced === 1 ? " is" : "s are"} included first. `
          : "") +
        (remaining
          ? `${remaining} task${remaining === 1 ? "" : "s"} did not fit inside ${fmtDur(capacity)} of work and stay unscheduled.`
          : `Everything selected fits inside your ${fmtDur(capacity)} working day.`),
      remaining,
      local: true,
    };
  }

  async function planDay(date, opts = {}) {
    await wait(opts.instant ? 60 : 900);
    return draftDay(date, opts);
  }

  /* =========================================================
     Adaptive rescheduling
     ========================================================= */

  async function rescheduleProposal(opts = {}) {
    await wait(opts.instant ? 60 : 950);
    const store = POS.store;
    const st = store.get();
    const base = todayISO();
    const missed = st.tasks.filter((t) => !t.done && t.date < base)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (!missed.length) {
      return { empty: true, moves: [], summary: "Nothing is behind. There is nothing to reschedule.", local: true };
    }

    const moves = [];
    let cursorDay = base;
    let windows = freeWindows(st.tasks.filter((t) => t.date >= base), st.events, cursorDay);
    let minutesLeft = st.settings.capacity;
    let totalMin = 0;

    missed.forEach((t) => {
      let guard = 0;
      let slot = null;
      let day = cursorDay;
      let dayWindows = windows;
      while (guard++ < 40) {
        if (minutesLeft >= t.duration) {
          const start = place(dayWindows, t.duration, 5);
          if (start != null) {
            slot = { date: day, start };
            minutesLeft -= t.duration;
            break;
          }
        }
        day = addDays(day, 1);
        const dow = fromISO(day).getDay();
        minutesLeft = dow === 0 || dow === 6 ? Math.round(st.settings.capacity * 0.5) : st.settings.capacity;
        dayWindows = freeWindows(st.tasks.filter((x) => x.date > day), st.events, day);
      }
      if (!slot) return;
      cursorDay = day;
      windows = dayWindows;
      totalMin += t.duration;
      const conflict = st.events.some(
        (e) => e.date === slot.date && !(slot.start + t.duration <= e.start || slot.start >= e.end)
      );
      moves.push({
        taskId: t.id,
        from: { date: t.date, start: t.start },
        to: slot,
        reason:
          t.date === addDays(base, -1)
            ? "Missed yesterday. This is the first slot with enough room."
            : "Left over from an earlier day. Moved without touching fixed events.",
        conflict,
      });
    });

    const days = [...new Set(moves.map((m) => m.to.date))].sort();
    const impact =
      moves.length + " " + (moves.length === 1 ? "task moves" : "tasks move") +
      `, ${fmtDur(totalMin)} of work, into ${days.map((d) => fmtDate(d, "medium")).join(" and ")}. ` +
      "Fixed events and everything already completed stay where they are.";

    return {
      empty: false,
      moves,
      summary: impact,
      totalMin,
      days,
      warnings: moves.some((m) => m.conflict) ? ["One slot overlaps a flexible event. Review before approving."] : [],
      local: true,
    };
  }

  /* =========================================================
     Assistant replies
     ========================================================= */

  async function assistantReply(prompt, { topic = null } = {}) {
    await wait(700);
    const message = String(prompt || "").trim();
    const q = message.toLowerCase();
    const store = POS.store;
    const st = store.get();
    const today = todayISO();
    const over = store.overdue(today);
    const followup = /^(why|how so|what about that|tell me more|explain|go on)[.!?]*$/.test(q);
    if (followup && topic) {
      const explanations = {
        draft: "A draft uses cues in your words, such as task verbs and dates. Edit a title or exclude anything that doesn’t fit. Only the items you add are saved.",
        plan: "I keep existing blocks in place, then look for time between tasks and events without exceeding your daily work limit. The planner shows what would change.",
        overdue: "These are open tasks with a date before today. The changes in Rescheduling are proposals until you approve them.",
        focus: "I order open tasks for today by priority. You can start with any of them.",
        progress: "The weekly summary counts completed scheduled tasks, logged focus sessions and completed habits from this device.",
        search: "These are matches in your saved workspace. Open a result to see its full details.",
      };
      if (explanations[topic]) return { title: "How I worked that out", text: explanations[topic], topic };
    }
    const searchQuery = message.match(/^(?:find|search for|look up|what do i have on)\s+(.+?)\s*[?!.]*$/i)?.[1];
    if (searchQuery) {
      const hits = store.searchAll(searchQuery);
      const bullets = [
        ...hits.tasks.slice(0, 3).map((t) => `Task: ${t.title}`),
        ...hits.projects.slice(0, 3).map((p) => `Project: ${p.name}`),
        ...hits.notes.slice(0, 3).map((n) => `Note: ${n.title}`),
        ...hits.habits.slice(0, 3).map((h) => `Habit: ${h.name}`),
      ];
      return { title: "Workspace search", text: bullets.length ? `Here’s what matches “${searchQuery}”.` : `Nothing saved matches “${searchQuery}”.`,
        bullets, actions: bullets.length ? [{ label: "Open tasks", href: "#/tasks" }, { label: "Open notes", href: "#/notes" }] : [], topic: "search" };
    }

    if (/reschedul|behind|missed|overdue|late/.test(q)) {
      const proposal = await rescheduleProposal({ instant: true });
      return {
        title: proposal.empty ? "Nothing is behind" : "A way to catch up",
        text: proposal.empty
          ? "Every task has a home and nothing is past its day. I would leave the week as it is."
          : proposal.summary,
        bullets: proposal.empty ? [] : proposal.moves.map((m) => `${store.task(m.taskId).title} → ${fmtDate(m.to.date, "medium")}, ${fmtMin(m.to.start)}`),
        actions: proposal.empty ? [] : [{ label: "Review the changes", href: "#/reschedule" }],
        topic: "overdue",
      };
    }
    if (/\b(focus|priority|priorities|first task|start with)\b/.test(q)) {
      const top = store.priorities(today);
      return {
        title: "What to start with",
        text: top.length ? "Here are today’s open tasks in priority order." : "No open tasks are planned for today.",
        bullets: top.map((t) => `${t.title} · ${fmtDur(t.duration)}`),
        actions: top.length ? [{ label: `Start: ${top[0].title}`, href: `#/focus?task=${top[0].id}` }] : [],
        topic: "focus",
      };
    }
    if (/\b(summari[sz]e|week|review|progress)\b/.test(q) && !/\b(plan|schedule)\b/.test(q)) {
      const ws = store.weekStats(POS.util.startOfWeek(today));
      return {
        title: "This week, in numbers",
        text: `${ws.done} of ${ws.total} scheduled tasks done, ${fmtDur(ws.focus)} in focus sessions, habits at ${ws.habitPct}%.`,
        bullets: [
          over.length ? `${over.length} task${over.length > 1 ? "s" : ""} behind` : "Nothing behind",
          `${st.projects.filter((p) => p.status !== "archived").length} active projects`,
        ],
        actions: [{ label: "Open reflection", href: "#/reflection" }],
        topic: "progress",
      };
    }
    if (/\b(plan my day|daily plan|my schedule|schedule today|today[’']s (?:plan|schedule|tasks)|what(?:[’']s| is) on today|what do i have today)\b/.test(q)) {
      const now = POS.util.nowMinutes();
      const plan = draftDay(today, { notBefore: now });
      const proposed = plan.placed.filter((row) => !row.kept);
      return {
        title: "A plan for today",
        text: plan.explanation,
        bullets: [
          `${POS.util.plural(proposed.length, "proposed placement")}; nothing has changed`,
          plan.unplaced.length ? `${plan.unplaced.length} still need a slot` : "Everything fits",
        ],
        actions: [{ label: "Open daily planner", href: `#/planner?from=${now}` }],
        topic: "plan",
      };
    }
    if (/\b(notes?|write|remember|save|capture|add a task)\b/.test(q)) {
      return {
        title: "Make a draft",
        text: "Use “Draft tasks or notes” on your message to see what can be saved. You can edit or discard the draft.",
        topic: "draft",
      };
    }
    return {
      title: "I don’t have an answer for that",
      text: "This local assistant uses rules, not a general-purpose model. I can help with your workspace or turn what you wrote into a draft.",
      bullets: [
        "“Plan my day around the design review.”",
        "“I missed two tasks — find them a new home.”",
        "“What should I focus on this afternoon?”",
      ],
      actions: [{ label: "Capture an intention", href: "#/dump" }],
    };
  }

  POS.ai = {
    parseCapture,
    breakdown,
    draftDay,
    planDay,
    rescheduleProposal,
    assistantReply,
    freeWindows,
    templateFor,
  };
})();
