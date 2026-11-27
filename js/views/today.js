/* Today — the morning decision surface. */
(function () {
  "use strict";
  const POS = window.POS;
  const U = POS.util;
  const { icon, esc } = { icon: U.icon, esc: U.escapeHTML };
  const store = POS.store;
  const ui = POS.ui;

  function render(main) {
    const st = store.get();
    const today = U.todayISO();
    const stats = store.todayStats(today);
    const priorities = store.priorities(today);
    const todayTasks = store.tasksFor(today);
    const events = st.events.filter((e) => e.date === today).sort((a, b) => a.start - b.start);
    const timeline = todayTasks
      .filter((t) => t.start != null && !t.done)
      .map((t) => ({ kind: "task", at: t.start, item: t }))
      .concat(events.map((e) => ({ kind: "event", at: e.start, item: e })))
      .sort((a, b) => a.at - b.at);
    const upcoming = st.tasks
      .filter((t) => !t.done && t.date > today && t.date <= U.addDays(today, 6))
      .sort((a, b) => (a.date + String(a.start || 0)).localeCompare(b.date + String(b.start || 0)))
      .slice(0, 6);
    const deadlines = st.projects
      .filter((p) => p.status !== "archived")
      .sort((a, b) => a.deadline.localeCompare(b.deadline))
      .slice(0, 4);
    const habits = st.habits.slice(0, 5);
    const hours = Math.round((stats.plannedMin / 60) * 10) / 10;
    const capacity = st.settings.capacity;
    const focusMin = store.focusMinutes(today);
    const first = st.settings.name.split(" ")[0];

    main.innerHTML = `
    <div class="page">
      <header class="page-head">
        <div>
          <h1 class="page-title">${esc(U.greeting())}, <em>${esc(first)}</em>.</h1>
          <div class="page-sub">
            <span>${U.fmtDate(today, "long")}</span>
            <span class="dot-sep">·</span>
            <span>${stats.total} tasks today</span>
            <span class="dot-sep">·</span>
            <span>${hours}h planned</span>
          </div>
        </div>
        <div class="page-actions">
          <button class="btn btn-ghost" data-act="assistant">${icon("sparkles")} Ask</button>
          <button class="btn" data-act="goto" data-href="#/planner">${icon("columns")} Plan my day</button>
          <button class="btn btn-primary" data-act="add-task">${icon("plus")} Add task</button>
        </div>
      </header>

      ${POS.onboarding.html()}

      <div class="grid grid-12">
        <div class="col-8 rail-stack">

          <section class="panel" aria-labelledby="focus-h">
            <div class="panel-head">
              <div class="row gap-3">
                <h2 id="focus-h">Your focus today</h2>
                <span class="tag tag-accent tag-mono">${priorities.length} PRIORITIES</span>
              </div>
              <span class="meta">${U.fmtDur(priorities.reduce((n, t) => n + t.duration, 0))} of work</span>
            </div>
            <div class="rows" id="focus-rows">
              ${priorities.length
                ? priorities.map((t, i) => `
                  <div class="focus-row" data-task="${t.id}">
                    <span class="focus-index serif">${String(i + 1).padStart(2, "0")}</span>
                    <label class="check ${t.done ? "is-done" : ""}">
                      <input type="checkbox" data-act="toggle-task" data-id="${t.id}" aria-label="Complete ${esc(t.title)}" />
                      <span class="check-label grow">
                        <span class="focus-title">${esc(t.title)}</span>
                        <span class="row-meta">
                          ${t.projectId ? ui.projectTag(t.projectId) : '<span class="tag tag-outline">Personal</span>'}
                          <span class="sep">·</span>
                          <span>${t.start != null ? U.fmtMin(t.start) : "Unscheduled"}</span>
                          ${t.date < today ? `<span class="sep">·</span><span class="danger">${Math.abs(U.diffDays(t.date, today))}d late</span>` : ""}
                        </span>
                      </span>
                    </label>
                    <span class="mono focus-dur">${U.fmtDur(t.duration)}</span>
                    <button class="icon-btn icon-btn-sm" data-act="focus-task" data-id="${t.id}" aria-label="Focus on ${esc(t.title)}" title="Focus">
                      ${icon("play")}
                    </button>
                  </div>`).join("")
                : ui.emptyState("Nothing is on fire", "No open tasks for today. Add one, or bring something forward from this week.",
                    `<button class="btn btn-sm" data-act="add-task">${icon("plus")} Add a task</button>`)}
            </div>
            <div class="panel-foot">
              <div class="spread" style="margin-bottom:7px">
                <span style="font-size:11.5px;color:var(--ink-3)">Day load</span>
                <span class="mono" style="font-size:10.5px;color:var(--ink-2)">${hours}h / ${Math.round(capacity / 60)}h</span>
              </div>
              ${ui.meter(Math.round((stats.plannedMin / capacity) * 100))}
            </div>
          </section>

          <section class="panel" aria-labelledby="sched-h">
            <div class="panel-head">
              <h2 id="sched-h">Today's shape</h2>
              <a class="btn btn-ghost btn-sm" href="#/calendar">${icon("calendar")} Calendar</a>
            </div>
            <div class="panel-body-tight">
              ${timeline.length ? `
                <div class="timeline">
                  ${timeline.map((row) => row.kind === "event" ? `
                    <div class="tl-row">
                      <span class="tl-time mono">${U.fmtMin(row.item.start)}</span>
                      <span class="tl-mark tl-mark-event" aria-hidden="true"></span>
                      <div class="grow">
                        <div class="tl-title">${esc(row.item.title)}</div>
                        <div class="tl-meta">${row.item.fixed ? "Calendar · fixed" : "Calendar · flexible"}${row.item.location ? " · " + esc(row.item.location) : ""}</div>
                      </div>
                      <span class="tag tag-outline tag-mono">EVENT</span>
                    </div>` : `
                    <div class="tl-row">
                      <span class="tl-time mono">${row.item.start != null ? U.fmtMin(row.item.start) : "—"}</span>
                      <span class="tl-mark" style="--tone:var(--tone, var(--accent))" aria-hidden="true"></span>
                      <div class="grow">
                        <div class="tl-title">${esc(row.item.title)}</div>
                        <div class="tl-meta">${row.item.projectId ? ui.projectTag(row.item.projectId) : "Personal"} · ${U.fmtDur(row.item.duration)}</div>
                      </div>
                      <label class="check">
                        <input type="checkbox" data-act="toggle-task" data-id="${row.item.id}" aria-label="Complete ${esc(row.item.title)}" />
                        <span class="sr-only">Complete</span>
                      </label>
                    </div>`).join("")}
                </div>` : ui.emptyState("A clear day", "Nothing is on the clock yet. Your task list is still open if you want to place something.")}
            </div>
          </section>

          <section class="panel" aria-labelledby="later-h">
            <div class="panel-head">
              <h2 id="later-h">Later this week</h2>
              <a class="btn btn-ghost btn-sm" href="#/tasks">${icon("tasks")} All tasks</a>
            </div>
            <div class="rows">
              ${upcoming.length
                ? upcoming.map((t) => ui.taskRow(t, { showDate: true, showTime: false })).join("")
                : ui.emptyState("The week is open", "Nothing scheduled after today. That is either good planning or a gap worth filling.")}
            </div>
          </section>
        </div>

        <aside class="col-4 rail-stack" aria-label="Today's summary">
          <section class="panel">
            <div class="panel-body">
              <div class="row" style="align-items:flex-end;justify-content:space-between">
                <div>
                  <div class="mono" style="font-size:10px;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-3)">Today done</div>
                  <div class="mono" style="font-size:40px;line-height:1;letter-spacing:-.05em;margin-top:6px">${stats.pct}<span style="font-size:17px;color:var(--ink-3)">%</span></div>
                </div>
                <div style="text-align:right;font-size:11.5px;color:var(--ink-3);line-height:1.7">
                  ${stats.done} of ${stats.total} tasks<br/>
                  ${U.fmtDur(focusMin)} focused
                </div>
              </div>
              <div style="margin-top:14px">${ui.meter(stats.pct)}</div>
              <div class="row gap-3" style="margin-top:14px;font-size:11px;color:var(--ink-3)">
                <span>${icon("check", "ico-sm")} ${stats.done} done</span>
                <span>${icon("clock", "ico-sm")} ${stats.total - stats.done} open</span>
              </div>
            </div>
          </section>

          <section class="panel" aria-labelledby="dl-h">
            <div class="panel-head">
              <h2 id="dl-h">Deadlines</h2>
              <a class="btn btn-ghost btn-sm" href="#/projects">Projects</a>
            </div>
            <div class="rows">
              ${deadlines.map((p) => {
                const prog = store.projectProgress(p.id);
                const days = U.diffDays(p.deadline, today);
                return `<a class="row-item" href="#/project/${p.id}">
                  <span class="pdot" style="--tone:var(--p-${p.color})"></span>
                  <div class="grow">
                    <div class="row-title" style="font-size:12.5px">${esc(p.name)}</div>
                    <div class="row-meta">
                      <span class="mono">${prog.done}/${prog.total}</span>
                      <span class="sep">·</span>
                      <span class="${days <= 3 ? "warning" : ""}">${days === 0 ? "due today" : days < 0 ? "overdue" : days + "d left"}</span>
                    </div>
                  </div>
                  <div style="width:54px">${ui.meter(prog.pct, p.color)}</div>
                </a>`;
              }).join("") || ui.emptyState("No project deadlines", "Add a project when you have a larger piece of work to plan.", '<a class="btn btn-sm" href="#/projects">Add a project</a>')}
            </div>
          </section>

          <section class="panel" aria-labelledby="hab-h">
            <div class="panel-head">
              <h2 id="hab-h">Habits</h2>
              <a class="btn btn-ghost btn-sm" href="#/habits">All</a>
            </div>
            <div class="rows">
              ${habits.map((h) => {
                const done = store.habitDone(h);
                const week = store.habitWeek(h);
                const streak = store.habitStreak(h);
                return `<div class="row-item habit-row">
                  <label class="check ${done ? "is-done" : ""}">
                    <input type="checkbox" ${done ? "checked" : ""} data-act="toggle-habit" data-id="${h.id}" aria-label="${esc(h.name)}" />
                    <span class="check-label grow"><span class="row-title" style="font-size:12.5px">${esc(h.name)}</span></span>
                  </label>
                  <div class="habit-dots" aria-hidden="true">
                    ${week.map((d) => `<i class="${d.done ? "on" : ""}"></i>`).join("")}
                  </div>
                  <span class="mono" style="font-size:10px;color:var(--ink-3);min-width:22px;text-align:right">${streak}d</span>
                </div>`;
              }).join("") || ui.emptyState("No habits yet", "Choose a routine you want to keep.", '<a class="btn btn-sm" href="#/habits">Add a habit</a>')}
            </div>
          </section>

          <section class="note note-quiet" style="align-items:flex-start">
            ${icon("sparkles")}
            <div>
              <strong>Where the leverage is</strong>
              <p style="margin-top:3px">${priorities.length ? esc(priorities[0].title) + " is the only thing that has to happen today." : "Nothing has to happen today. Protect the empty space."}</p>
              <button class="btn btn-sm" style="margin-top:10px" data-act="assistant">${icon("sparkles")} Ask why</button>
            </div>
          </section>
        </aside>
      </div>
    </div>`;

    ui.bind(main, {
      "add-task": () => ui.quickAddTask(today),
      "toggle-habit": (el) => store.actions.toggleHabitToday(el.dataset.id),
      "focus-task": (el) => { location.hash = "#/focus?task=" + el.dataset.id; },
    });
    POS.onboarding.bind(main);
  }

  POS.views = POS.views || {};
  POS.views.today = { render, destroy: () => POS.onboarding.destroy() };
})();
