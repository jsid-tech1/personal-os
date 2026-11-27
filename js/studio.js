/* Focused product views. Historical routes remain intact; account data is never discarded. */
(function () {
  "use strict";
  const POS = window.POS, U = POS.util, S = POS.store, P = POS.planning, M = POS.mosaic;
  const esc = U.escapeHTML, icon = U.icon;
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const fmt = (iso, opts = { month: "short", day: "numeric" }) => new Date(iso + "T12:00:00").toLocaleDateString(undefined, opts);
  const button = label => `<button class="btn btn-primary" data-plan>${icon("plus")} ${label}</button>`;
  const head = (title, description, action = "") => `<header class="studio-page-head"><div><h1>${title}</h1><p>${description}</p></div>${action}</header>`;
  function empty(title, description, action = "") { return `<div class="studio-empty"><span class="empty-pixels" aria-hidden="true"><i></i><i></i><i></i><i></i></span><h3>${title}</h3><p>${description}</p>${action}</div>`; }
  function rows(tasks) {
    return `<div class="studio-task-list">${tasks.map(t => {
      const project = S.project(t.projectId);
      return `<div class="studio-task ${t.done ? "is-done" : ""}"><label class="task-check"><input type="checkbox" data-complete="${esc(t.id)}" ${t.done ? "checked" : ""} aria-label="${t.done ? "Reopen" : "Complete"} ${esc(t.title)}"><span></span></label><div class="task-copy"><strong>${esc(t.title)}</strong><p>${project ? esc(project.name) : "Personal task"}${t.date ? " / " + fmt(t.date) : ""}</p></div><span class="task-duration">${t.duration || 30} min</span><a class="icon-btn" href="#/focus?task=${encodeURIComponent(t.id)}" aria-label="Focus on ${esc(t.title)}">${icon("play")}</a><button class="icon-btn" data-edit-task="${esc(t.id)}" aria-label="Edit ${esc(t.title)}">${icon("more")}</button></div>`;
    }).join("")}</div>`;
  }
  function bind(main) {
    main.querySelectorAll("[data-plan]").forEach(el => { el.onclick = () => POS.planEditor.open(); });
    main.querySelectorAll("[data-complete]").forEach(el => { el.onchange = () => { el.blur(); M.toggle(el.dataset.complete); POS.app.render(); POS.ui.toast(el.checked ? "Task complete. A little more colour." : "Task reopened. Mosaic updated."); }; });
    main.querySelectorAll("[data-edit-task]").forEach(el => { el.onclick = () => editTask(el.dataset.editTask); });
  }
  function editTask(id) {
    const task = S.task(id);
    if (!task) return;
    const wrap = document.createElement("div");
    wrap.className = "modal-wrap plan-overlay";
    wrap.innerHTML = `<section class="plan-dialog small-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-title"><h2 id="edit-title">Edit task</h2><form class="stack gap-4"><label>Task<input class="input" name="title" maxlength="200" required value="${esc(task.title)}"></label><label>Assigned day<input class="input" name="date" type="date" required value="${esc(task.date)}"></label><label>Estimated minutes<input class="input" name="duration" type="number" min="5" max="720" required value="${task.duration}"></label><p class="field-help" role="alert" id="edit-error"></p><div class="plan-actions"><button class="btn btn-primary" type="submit">Save task</button><button class="btn" data-close type="button">Cancel</button><button class="btn btn-danger" data-delete type="button">Delete task</button></div></form></section>`;
    const close = () => { wrap.remove(); POS.ui.lockScroll(false); };
    wrap._close = close;
    document.getElementById("overlay-root").append(wrap);
    POS.ui.lockScroll(true);
    wrap.querySelector("input").focus();
    wrap.querySelector("[data-close]").onclick = close;
    wrap.onkeydown = e => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const nodes = [...wrap.querySelectorAll("input,button")];
        if (e.shiftKey && document.activeElement === nodes[0]) { e.preventDefault(); nodes.at(-1).focus(); }
        else if (!e.shiftKey && document.activeElement === nodes.at(-1)) { e.preventDefault(); nodes[0].focus(); }
      }
    };
    wrap.querySelector("[data-delete]").onclick = async () => {
      const accepted = await POS.ui.confirm({ title: "Delete this task?", body: "This removes the task from your calendar. Any artwork already earned remains in your archive.", confirmLabel: "Delete task" });
      if (!accepted || !wrap.isConnected) return;
      close(); S.actions.deleteTask(id); POS.app.render();
    };
    wrap.querySelector("form").onsubmit = e => {
      e.preventDefault();
      try {
        const form = e.currentTarget, title = form.elements.title.value.trim(), date = form.elements.date.value, duration = Number(form.elements.duration.value);
        if (!title || !P.validDate(date) || !Number.isInteger(duration) || duration < 5 || duration > 720) throw new Error("Check the title, date and duration.");
        const settings = S.get().settings, days = settings.workDays || [1, 2, 3, 4, 5], capacity = settings.capacity || 120;
        if (!task.done) {
          const project = S.project(task.projectId);
          P.validate([{ title, date, duration }], { start: U.todayISO(), deadline: project?.deadline || P.add(U.todayISO(), 366), capacity, days }, S.get().tasks.filter(t => t.id !== id));
          const siblings = S.tasksOfProject(task.projectId).filter(t => t.id !== id && !t.done && t.order != null);
          if (task.order != null && siblings.some(t => (t.order < task.order && t.date > date) || (t.order > task.order && t.date < date))) throw new Error("Keep the project's steps in their original sequence.");
        }
        close(); S.actions.updateTask(id, { title, date, duration }); POS.app.render(); POS.ui.toast("Task updated.");
      } catch (error) { wrap.querySelector("#edit-error").textContent = error.message; }
    };
  }
  function today(main) {
    const s = S.get(), today = U.todayISO(), tasks = S.tasksFor(today), stats = S.todayStats(), mosaic = M.current();
    const upcoming = s.projects.filter(p => p.status !== "archived" && S.tasksOfProject(p.id).some(t => !t.done)).sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 4);
    const first = !s.tasks.length;
    main.innerHTML = `<div class="page studio-page">${head(`Hello, ${esc(s.settings.name.split(" ")[0] || "there")}.`, fmt(today, { weekday: "long", day: "numeric", month: "long" }), button("Add task"))}
      ${first ? `<section class="first-idea"><div><p class="subtle">One idea is a good place to start.</p><h2>Make room for what<br>you want to finish.</h2><p>Describe your work. Review the steps and dates. Then take it one task at a time.</p>${button("Add your first task")}</div><div class="first-idea-art">${M.html(0, mosaic.key)}<span>Your canvas is waiting.</span></div></section>` : ""}
      <div class="studio-dashboard-grid"><section class="studio-work"><div class="studio-section-head"><h2>Today’s tasks</h2><span class="subtle">${stats.done} / ${stats.total} done</span></div><progress class="studio-progress" max="${stats.total || 1}" value="${stats.done}" aria-label="Today's task progress"></progress>${tasks.length ? rows(tasks) : empty(first ? "Nothing planned yet" : "A little breathing room", first ? "Your approved plan will appear here." : "No tasks assigned for today. Check your week or plan something new.")}
      <div class="studio-section-head section-space"><h2>Your week</h2><a class="text-link" href="#/calendar">Open calendar</a></div><div class="mini-week">${Array.from({ length: 7 }, (_, i) => {
        const date = P.add(P.week(today), i), list = S.tasksFor(date);
        return `<a href="#/calendar?day=${date}" class="mini-day ${date === today ? "is-today" : ""}"><span>${fmt(date, { weekday: "short" })}</span><strong>${new Date(date + "T12:00").getDate()}</strong><span class="day-dots">${list.length ? "▪".repeat(Math.min(list.length, 3)) : "—"}</span></a>`;
      }).join("")}</div></section>
      <aside class="studio-aside"><section class="mosaic-widget"><div class="studio-section-head"><h2>This week’s mosaic</h2><span class="tiny-square"></span></div>${M.html(mosaic.ids.length, mosaic.key)}<p>${mosaic.ids.length ? `${mosaic.ids.length} tasks finished. Every bit counts.` : "An empty canvas. Each completed task reveals 8 fragments."}</p><a href="#/mosaic" class="text-link">View my mosaic</a></section><a href="#/focus" class="focus-invite"><span>${icon("focus")} A little time, just for this.</span><strong>Start a focus session ${icon("arrowRight")}</strong><span>15, 25 or 45 minutes</span></a></aside></div>
      <section class="studio-deadlines"><div class="studio-section-head"><h2>On the horizon</h2><span class="subtle">Upcoming deadlines</span></div>${upcoming.length ? upcoming.map(p => { const progress = S.projectProgress(p.id); return `<a class="deadline-line" href="#/tasks?project=${encodeURIComponent(p.id)}"><span>${esc(p.name)}</span><span>${progress.done}/${progress.total} steps</span><strong>${fmt(p.deadline)}</strong></a>`; }).join("") : `<p class="quiet-empty">No deadlines yet. Add a task when you’re ready.</p>`}</section></div>`;
    bind(main);
  }
  let taskFilter = "open";
  function tasks(main, params = {}) {
    const s = S.get(), filtered = s.tasks.filter(t => (!params.project || t.projectId === params.project) && (taskFilter === "all" || (taskFilter === "done" ? t.done : !t.done))).sort((a, b) => a.date.localeCompare(b.date));
    const project = params.project ? S.project(params.project) : null;
    const projects = s.projects.filter(p => p.status !== "archived");
    const projectControl = projects.length ? `<label class="project-filter">Project<select class="select" id="task-project-filter"><option value="">All projects</option>${projects.map(p => `<option value="${esc(p.id)}" ${project?.id === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>` : "";
    const deadlineControl = project ? `<form class="project-deadline" id="project-deadline-form"><label>Project deadline<input class="input" type="date" name="deadline" required value="${esc(project.deadline)}"></label><button class="btn" type="submit">Update deadline</button><p class="field-help" id="project-deadline-message" role="status"></p></form>` : "";
    main.innerHTML = `<div class="page studio-page">${head(project ? esc(project.name) : "A little at a time.", "Your work, broken down into doable steps.", button("Add task"))}<div class="studio-toolbar"><div class="studio-tabs" role="group" aria-label="Filter tasks">${[["open", "To do"], ["done", "Completed"], ["all", "All tasks"]].map(([id, label]) => `<button class="btn ${id === taskFilter ? "is-active" : ""}" data-task-filter="${id}" aria-pressed="${id === taskFilter}">${label}</button>`).join("")}</div>${projectControl}</div>${deadlineControl}${filtered.length ? rows(filtered) : empty("No tasks here yet", "Describe something you want to finish, then review the proposed plan.", button("Plan a task"))}</div>`;
    main.querySelector("#task-project-filter")?.addEventListener("change", e => { location.hash = "#/tasks" + (e.target.value ? "?project=" + encodeURIComponent(e.target.value) : ""); });
    main.querySelector("#project-deadline-form")?.addEventListener("submit", e => {
      e.preventDefault();
      const value = e.currentTarget.elements.deadline.value;
      if (!P.validDate(value) || value < U.todayISO() || value > P.add(U.todayISO(), 366) || S.tasksOfProject(project.id).some(t => !t.done && t.date > value)) {
        main.querySelector("#project-deadline-message").textContent = "Use a future deadline within a year, after all unfinished steps.";
        return;
      }
      document.activeElement?.blur(); S.actions.updateProject(project.id, { deadline: value }); POS.app.render(); POS.ui.toast("Project deadline updated.");
    });
    main.querySelectorAll("[data-task-filter]").forEach(el => { el.onclick = () => { taskFilter = el.dataset.taskFilter; tasks(main, params); }; }); bind(main);
  }
  let selected = U.todayISO();
  function calendar(main, params = {}) {
    if (P.validDate(params.day)) selected = params.day;
    const start = P.week(selected), settings = S.get().settings, capacity = settings.capacity || 120;
    const selectedTasks = S.tasksFor(selected), missed = S.get().tasks.filter(t => !t.done && t.date < U.todayISO());
    main.innerHTML = `<div class="page studio-page">${head("A week with room to work.", "Choose a day. Keep the workload human.", button("Add task"))}<div class="studio-toolbar"><div class="calendar-switch"><button class="icon-btn" id="week-prev" aria-label="Previous week">${icon("chevronLeft")}</button><h2>${fmt(start)} – ${fmt(P.add(start, 6))}</h2><button class="icon-btn" id="week-next" aria-label="Next week">${icon("chevronRight")}</button></div><button class="btn" id="week-today">This week</button></div>
      ${missed.length ? `<div class="reschedule-note"><div><strong>${missed.length} unfinished ${missed.length === 1 ? "task needs" : "tasks need"} a new day.</strong><p>Review a redistribution that respects your capacity and deadlines.</p></div><button class="btn" id="redistribute">Redistribute work</button></div>` : ""}
      <div class="week-grid" aria-label="Weekly calendar">${Array.from({ length: 7 }, (_, i) => {
        const date = P.add(start, i), ts = S.tasksFor(date), load = ts.reduce((n, t) => n + Number(t.duration || 0), 0), deadlines = S.get().projects.filter(p => p.deadline === date && p.status !== "archived");
        return `<button class="week-column ${date === selected ? "is-selected" : ""} ${date === U.todayISO() ? "is-today" : ""}" data-day="${date}" aria-pressed="${date === selected}"><span class="week-day-name">${fmt(date, { weekday: "short" })}</span><strong class="week-date">${new Date(date + "T12:00").getDate()}</strong><span class="week-load ${load > capacity ? "danger" : ""}">${load} / ${capacity} min</span><span class="week-events">${ts.slice(0, 4).map(t => `<span class="week-task ${t.done ? "is-done" : ""}">${t.done ? "✓ " : ""}${esc(t.title)}</span>`).join("")}${ts.length > 4 ? `<span>+${ts.length - 4} more</span>` : ""}${deadlines.map(p => `<span class="week-deadline">Due: ${esc(p.name)}</span>`).join("")}${!ts.length && !deadlines.length ? `<span class="week-free">Unplanned</span>` : ""}</span></button>`;
      }).join("")}</div><section class="calendar-day-detail"><div class="studio-section-head"><h2>${fmt(selected, { weekday: "long", month: "long", day: "numeric" })}</h2><span class="subtle">${selectedTasks.length} tasks</span></div>${selectedTasks.length ? rows(selectedTasks) : empty("Room for something good", "No tasks assigned to this day. Your approved plans appear automatically.")}</section><p id="redistribute-error" class="plan-message" role="status"></p></div>`;
    main.querySelectorAll("[data-day]").forEach(el => { el.onclick = () => { selected = el.dataset.day; history.replaceState(null, "", "#/calendar?day=" + selected); calendar(main); }; });
    main.querySelector("#week-prev").onclick = () => { selected = P.add(selected, -7); history.replaceState(null, "", "#/calendar"); calendar(main); };
    main.querySelector("#week-next").onclick = () => { selected = P.add(selected, 7); history.replaceState(null, "", "#/calendar"); calendar(main); };
    main.querySelector("#week-today").onclick = () => { selected = U.todayISO(); history.replaceState(null, "", "#/calendar"); calendar(main); };
    main.querySelector("#redistribute")?.addEventListener("click", async () => {
      try {
        const stateBefore = JSON.stringify(S.get()), ids = new Set(missed.map(t => t.id)), existing = S.get().tasks.filter(t => !ids.has(t.id));
        const moves = [];
        for (const task of [...missed].sort((a, b) => a.date.localeCompare(b.date) || (a.order || 0) - (b.order || 0))) {
          const project = S.project(task.projectId), deadline = project?.deadline || P.add(U.todayISO(), 14);
          const nextSibling = existing.filter(t => !t.done && t.projectId === task.projectId && t.order > task.order).sort((a, b) => a.date.localeCompare(b.date))[0];
          const limit = nextSibling && nextSibling.date < deadline ? nextSibling.date : deadline;
          const [scheduled] = P.schedule([task], { start: U.todayISO(), deadline: limit, capacity, days: settings.workDays || [1, 2, 3, 4, 5] }, existing);
          moves.push({ id: task.id, date: scheduled.date }); existing.push({ ...task, date: scheduled.date });
        }
        const accepted = await POS.ui.confirm({ title: "Redistribute unfinished work?", body: moves.map(move => `${S.task(move.id).title}: ${fmt(move.date)}`).join("\n"), confirmLabel: "Approve new dates" });
        if (!accepted) return;
        if (stateBefore !== JSON.stringify(S.get())) throw new Error("Your workspace changed during review. Redistribute again to recalculate.");
        S.set(s => { moves.forEach(move => { const task = s.tasks.find(t => t.id === move.id); task.date = move.date; task.rescheduled = (task.rescheduled || 0) + 1; }); }, "tasks:redistribute");
        POS.app.render(); POS.ui.toast("New dates approved.");
      } catch (e) { main.querySelector("#redistribute-error").textContent = e.message; }
    });
    bind(main);
  }
  let archiveMonth = U.todayISO().slice(0, 7);
  function mosaic(main) {
    const current = M.current(), records = M.records(), weeks = Object.keys(records).filter(k => k !== current.key).sort().reverse();
    const monthWeeks = [...new Set([...Object.keys(records), current.key])].filter(k => k.slice(0, 7) === archiveMonth || P.add(k, 6).slice(0, 7) === archiveMonth).sort();
    main.innerHTML = `<div class="page studio-page">${head("Your progress takes shape.", "A small collection made by showing up. No perfect weeks required.")}<div class="mosaic-main"><div class="mosaic-canvas">${M.html(current.ids.length, current.key)}</div><div class="mosaic-story"><p class="subtle">Week of ${fmt(current.key)}</p><h2>One task.<br>A little more colour.</h2><p>Each completed task reveals 8 fragments. Your composition grows with your work, even if you only finish a little.</p><strong class="mosaic-count">${current.ids.length} tasks completed</strong><p>A new canvas begins every Monday. Previous weeks stay in your archive, just as you left them.</p><a class="btn btn-primary" href="#/today">Back to today</a></div></div>
      <section class="mosaic-archive"><div class="studio-section-head"><h2>Your collection</h2><label class="archive-month">Month<input class="input" type="month" id="mosaic-month" value="${archiveMonth}"></label></div><div class="mosaic-month-grid">${monthWeeks.map(k => { const count = records[k]?.taskIds.length || 0; return `<article class="archive-piece">${M.html(count, k)}<h3>Week of ${fmt(k)}</h3><p>${count} ${count === 1 ? "task" : "tasks"} completed${k === current.key ? " / In progress" : ""}</p></article>`; }).join("")}</div>${!monthWeeks.length ? `<p class="quiet-empty">No saved canvases in this month yet.</p>` : !weeks.length ? `<p class="quiet-empty">Your collection starts here. This week’s artwork will remain when next week begins.</p>` : ""}${weeks.length ? `<div class="archive-history">${weeks.map(k => `<details><summary>Week of ${fmt(k)} / ${records[k].taskIds.length} completed tasks</summary>${M.html(records[k].taskIds.length, k)}</details>`).join("")}</div>` : ""}</section></div>`;
    main.querySelector("#mosaic-month").onchange = e => { if (/^\d{4}-\d{2}$/.test(e.target.value)) { archiveMonth = e.target.value; mosaic(main); } };
  }
  let focusInterval, focusDraft = null, focusOwner = null;
  function persistFocus() { try { sessionStorage.setItem("personal-os:focus:" + focusOwner, JSON.stringify(focusDraft)); } catch { /* Timer remains usable without session storage. */ } }
  function focus(main, params = {}) {
    clearInterval(focusInterval);
    const uid = POS.cloud.getStatus().user?.uid;
    if (focusOwner !== uid) { focusDraft = null; focusOwner = uid; }
    if (!focusDraft) { try { focusDraft = JSON.parse(sessionStorage.getItem("personal-os:focus:" + uid)); } catch { /* Start fresh. */ } }
    const open = S.get().tasks.filter(t => !t.done);
    if (!focusDraft) focusDraft = { minutes: 25, remaining: 1500, running: false, started: false, taskId: params.task || open[0]?.id || "" };
    if (params.task && !focusDraft.started && focusDraft.taskId !== params.task) focusDraft.taskId = params.task;
    const draft = focusDraft;
    main.innerHTML = `<div class="page studio-page">${head("Just this, for now.", "One task. A little uninterrupted time.")}<section class="focus-studio"><label class="label" for="focus-task">What are you focusing on?</label><select class="select" id="focus-task" ${draft.started ? "disabled" : ""}><option value="">Choose a task</option>${open.map(t => `<option value="${esc(t.id)}" ${t.id === draft.taskId ? "selected" : ""}>${esc(t.title)}</option>`).join("")}${draft.started && S.task(draft.taskId)?.done ? `<option selected value="${esc(draft.taskId)}">${esc(S.task(draft.taskId).title)}</option>` : ""}</select>${!open.length && !draft.started ? `<p class="field-help">Add a task first to link your focus time to real work.</p>` : ""}<div class="focus-presets" role="group" aria-label="Focus duration">${[15, 25, 45].map(n => `<button class="btn ${draft.minutes === n ? "is-active" : ""}" data-preset="${n}" aria-pressed="${draft.minutes === n}" ${draft.started ? "disabled" : ""}>${n} min</button>`).join("")}</div><div class="focus-clock" id="focus-clock" role="timer" aria-label="Time remaining"></div><p id="focus-status" role="status">${draft.started ? "A little room to concentrate." : "When you’re ready, begin."}</p><div class="plan-actions"><button class="btn btn-primary" id="focus-start">${draft.running ? "Pause" : draft.started ? "Resume" : "Start focus"}</button><button class="btn" id="focus-end" ${draft.started ? "" : "disabled"}>End session</button><a class="btn btn-ghost" href="#/today">Back to today</a></div><p class="field-help">Completed timers are recorded. Ending early does not mark the task complete.</p></section><section class="focus-history"><h2>Recent sessions</h2>${S.get().focusSessions.length ? S.get().focusSessions.slice(0, 8).map(f => `<div class="deadline-line"><span>${esc(S.task(f.taskId)?.title || "Past task")}</span><span>${f.minutes} min</span><span>${fmt(f.date)}</span></div>`).join("") : `<p class="quiet-empty">Your completed sessions will appear here.</p>`}</section></div>`;
    const clock = main.querySelector("#focus-clock"), status = main.querySelector("#focus-status");
    function finish() {
      if (focusDraft !== draft) return;
      clearInterval(focusInterval);
      const session = { taskId: draft.taskId, minutes: draft.minutes, date: U.todayISO() };
      focusDraft = null; persistFocus();
      S.actions.addFocusSession(session); POS.app.render(); POS.ui.toast("Focus session complete. Time well spent.");
    }
    function tick() {
      if (!clock.isConnected) { clearInterval(focusInterval); return; }
      const seconds = draft.running ? Math.max(0, Math.ceil((draft.endsAt - Date.now()) / 1000)) : draft.remaining;
      clock.textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
      if (draft.running && !seconds) finish();
    }
    main.querySelector("#focus-task").onchange = e => { draft.taskId = e.target.value; persistFocus(); };
    main.querySelectorAll("[data-preset]").forEach(el => { el.onclick = () => { draft.minutes = Number(el.dataset.preset); draft.remaining = draft.minutes * 60; persistFocus(); focus(main); }; });
    main.querySelector("#focus-start").onclick = () => {
      if (!S.task(draft.taskId)) { status.textContent = "Choose a task before starting."; return; }
      if (draft.running) { draft.remaining = Math.max(0, Math.ceil((draft.endsAt - Date.now()) / 1000)); draft.running = false; }
      else { draft.started = true; draft.running = true; draft.endsAt = Date.now() + draft.remaining * 1000; }
      persistFocus(); focus(main);
    };
    main.querySelector("#focus-end").onclick = () => { clearInterval(focusInterval); focusDraft = null; persistFocus(); focus(main); POS.ui.toast("Session ended. No task or completion was added."); };
    focusInterval = setInterval(tick, 500); tick();
  }
  POS.cloud.subscribe(status => { if (!status.user || status.user.uid !== focusOwner) { clearInterval(focusInterval); focusDraft = null; focusOwner = null; } });
  POS.views.today = { render: today };
  POS.views.tasks = { render: tasks };
  POS.views.calendar = { render: calendar };
  POS.views.mosaic = { render: mosaic };
  POS.views.focus = { render: focus, destroy: () => clearInterval(focusInterval) };
  POS.studio = { bind, editTask };
  // Every entry point, including keyboard capture, opens the real review flow.
  POS.ui.openCapture = POS.planEditor.open;
  POS.ui.openAssistant = POS.planEditor.open;
})();
