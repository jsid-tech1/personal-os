/* Planner — a day proposed around fixed events, then accepted by the user. */
(function () {
  "use strict";
  const POS = window.POS;
  const U = POS.util;
  const { icon, esc } = { icon: U.icon, esc: U.escapeHTML };
  const store = POS.store;
  const ui = POS.ui;

  const state = { date: U.todayISO(), plan: null, loading: false, error: false, routeFrom: undefined, notBefore: null, request: 0 };

  function load(main) {
    const request = ++state.request;
    state.loading = true;
    state.error = false;
    state.plan = null;
    render(main);
    const options = state.notBefore != null && state.date === U.todayISO() ? { notBefore: state.notBefore } : {};
    POS.ai.planDay(state.date, options)
      .then((plan) => {
        if (request !== state.request || state.date !== plan.date) return;
        state.plan = plan;
        state.loading = false;
        const live = document.getElementById("main");
        if (live && location.hash.startsWith("#/planner")) render(live);
      })
      .catch(() => {
        if (request !== state.request) return;
        state.loading = false;
        state.error = true;
        const live = document.getElementById("main");
        if (live && location.hash.startsWith("#/planner")) render(live);
      });
  }

  function taskByBlock(id) { return store.task(id); }

  function blockHTML(id) {
    const t = taskByBlock(id);
    if (!t || t.done) return "";
    const project = t.projectId ? store.project(t.projectId) : null;
    const sel = state.plan && state.plan.placed.find((p) => p.taskId === id);
    return `
      <div class="planner-task ${project ? "tone-" + project.color : "tone-accent"}${sel && !sel.kept ? " is-proposed" : ""}">
        <span class="mono planner-time">${sel ? U.fmtMin(sel.start) : "—"}</span>
        <label class="check">
          <input type="checkbox" data-act="toggle-task" data-id="${t.id}" aria-label="Complete ${esc(t.title)}" />
          <span class="check-label grow">
            <span class="planner-title">${esc(t.title)}</span>
            <span class="planner-meta">
              <span class="pdot" style="--tone:var(--tone)"></span>
              <span>${project ? esc(project.name) : "Personal"}</span>
              <span class="sep">·</span>
              <span class="mono">${U.fmtDur(t.duration)}</span>
              ${t.priority === 1 ? '<span class="tag tag-warning" style="height:17px">Priority</span>' : ""}
              ${t.deps && t.deps.length ? `<span class="tag tag-outline" style="height:17px">${icon("link", "ico-sm")} waits on earlier work</span>` : ""}
            </span>
          </span>
        </label>
        <span class="${sel && !sel.kept ? "schedule-proposed-label" : "planner-confirmed-label"}">${sel && !sel.kept ? "Proposed" : "Scheduled"}</span>
        <button class="icon-btn icon-btn-sm" data-act="focus-task" data-id="${t.id}" aria-label="Start a focus session for ${esc(t.title)}" title="Focus">
          ${icon("play")}
        </button>
      </div>`;
  }

  function sectionHTML(key, title, range, ids) {
    const rows = (ids || []).filter((id) => taskByBlock(id) && !taskByBlock(id).done);
    const mins = rows.reduce((n, id) => n + taskByBlock(id).duration, 0);
    return `
      <section class="panel planner-block" data-block="${key}">
        <div class="panel-head">
          <div class="row gap-3">
            <h2>${title}</h2>
            <span class="meta">${range}</span>
          </div>
          <span class="mono" style="font-size:10.5px;color:var(--ink-3)">${rows.length ? U.fmtDur(mins) : "open"}</span>
        </div>
        <div class="planner-rows">
          ${rows.length
            ? rows.map((id) => blockHTML(id)).join("")
            : `<div class="planner-empty">This part of the day is open.</div>`}
        </div>
      </section>`;
  }

  function planBodyHTML() {
    const plan = state.plan;
    const totalPlaced = plan.placed.filter((p) => {
      const t = store.task(p.taskId);
      return t && !t.done;
    });
    const mins = totalPlaced.reduce((n, p) => n + p.duration, 0);
    const pct = Math.round((mins / plan.capacity) * 100);
    return `
      <div class="planner-summary">
        <div class="planner-stat">
          <span class="stat-label">Placed</span>
          <span class="stat-num mono">${totalPlaced.length}</span>
          <span class="stat-note">of ${plan.placed.length + plan.unplaced.length} open</span>
        </div>
        <div class="planner-stat">
          <span class="stat-label">Workload</span>
          <span class="stat-num mono">${U.fmtDur(mins)}</span>
          <span class="stat-note">of ${U.fmtDur(plan.capacity)} capacity</span>
        </div>
        <div class="planner-stat">
          <span class="stat-label">Unscheduled</span>
          <span class="stat-num mono">${plan.unplaced.length}</span>
          <span class="stat-note">${plan.unplaced.length ? "stays in Tasks" : "everything fits"}</span>
        </div>
        <div class="planner-stat planner-stat-meter">
          <span class="stat-label">Day</span>
          <div class="row gap-2" style="width:100%">
            ${ui.meter(pct)}
            <span class="mono" style="font-size:10px">${pct}%</span>
          </div>
          <span class="stat-note">${plan.unplaced.length ? "the rest stays in Tasks" : pct > 100 ? "over capacity" : pct >= 90 ? "a full day, not an empty one" : "realistic for one day"}</span>
        </div>
      </div>

      <div class="note planner-explain">${icon("sparkles")}
        <div>
          <strong>Why this shape</strong>
          <p>${esc(plan.explanation)}</p>
          <p style="margin-top:6px;color:var(--ink-3)">Proposed blocks are not saved. Approving them won’t move already scheduled tasks or events.</p>
        </div>
      </div>

      <div class="planner-blocks">
        ${sectionHTML("morning", "Morning", "before 12:00", plan.blocks.morning)}
        ${sectionHTML("afternoon", "Afternoon", "12:00 – 17:00", plan.blocks.afternoon)}
        ${sectionHTML("evening", "Evening", "after 17:00", plan.blocks.evening)}
      </div>`;
  }

  function eventsHTML() {
    const events = store.get().events.filter((e) => e.date === state.date).sort((a, b) => a.start - b.start);
    if (!events.length) return "";
    return `
      <section class="panel">
        <div class="panel-head"><h2>Fixed events</h2><span class="meta">${U.fmtDate(state.date, "medium")}</span></div>
        <div class="rows">
          ${events.map((e) => `
            <div class="row-item">
              <span class="mono" style="min-width:58px;font-size:10.5px;color:var(--ink-3)">${U.fmtMin(e.start)} – ${U.fmtMin(e.end)}</span>
              <div class="grow">
                <div class="row-title" style="font-size:12.5px">${esc(e.title)}</div>
                <div class="row-meta">${e.fixed ? "Fixed" : "Flexible"}${e.location ? " · " + esc(e.location) : ""}</div>
              </div>
            </div>`).join("")}
        </div>
      </section>`;
  }

  function render(main) {
    const today = U.todayISO();
    const displayDate = state.date;
    const isToday = displayDate === today;
    const st = store.get();
    const open = st.tasks.filter((t) => !t.done && t.date <= displayDate);
    const plan = state.plan;
    const placed = plan ? plan.placed.filter((p) => {
      const t = store.task(p.taskId);
      return t && !t.done;
    }) : [];
    const proposedCount = placed.filter((p) => !p.kept).length;

    main.innerHTML = `
      <div class="page">
        <header class="page-head">
          <div>
            <h1 class="page-title">Daily <em>Planner</em></h1>
            <div class="page-sub">
              <span>${U.fmtDate(displayDate, "long")}</span>
              <span class="dot-sep">·</span>
              <span>${open.length} open task${open.length === 1 ? "" : "s"} in range</span>
              <span class="dot-sep">·</span>
              <span class="mono">LOCAL AI</span>
            </div>
          </div>
          <div class="page-actions">
            <a class="btn btn-ghost" href="#/tasks">${icon("tasks")} All tasks</a>
            <button class="btn" id="p-regenerate" ${state.loading ? "disabled" : ""}>${icon("rotate")} Regenerate</button>
            <button class="btn btn-accent" id="p-accept" ${proposedCount && !state.loading ? "" : "disabled"}>
              ${icon("check")} Approve ${proposedCount ? U.plural(proposedCount, "placement") : "placements"}
            </button>
          </div>
        </header>

        <div class="planner-toolbar">
          <div class="row gap-2">
            <button class="icon-btn" id="p-prev" aria-label="Previous day">${icon("chevron-left")}</button>
            <button class="btn btn-sm" id="p-today">Today</button>
            <button class="icon-btn" id="p-next" aria-label="Next day">${icon("chevron-right")}</button>
          </div>
          <span class="mono" style="font-size:10.5px;color:var(--ink-3)">
            ${isToday ? "TODAY" : U.fmtDate(displayDate, "medium").toUpperCase()}
          </span>
          <span class="planner-hint">Scheduled work stays in place.</span>
        </div>

        <div class="split planner-layout">
          <div class="stack gap-5" aria-live="polite">
            ${state.loading ? `
              <div class="panel"><div class="panel-body">
                <div class="skeleton sk-line w-40" style="height:13px"></div>
                <div class="skeleton sk-block" style="margin-top:18px"></div>
                <div class="skeleton sk-block" style="margin-top:12px"></div>
                <div class="skeleton sk-block" style="margin-top:12px"></div>
              </div></div>` : state.error ? `
              <div class="panel"><div class="panel-body">
                <div class="note note-warning">${icon("warning")}
                  <div><strong>The day could not be planned.</strong> Nothing changed. Try once more, or work from the task list.</div>
                </div>
                <button class="btn btn-sm" style="margin-top:12px" id="p-retry">${icon("rotate")} Try again</button>
               </div></div>` : plan && placed.length ? planBodyHTML() : `
              <div class="panel">${ui.emptyState(
                open.length ? "Nothing placed yet" : "The day is clear",
                open.length
                  ? "There is open work, but no slot fits the way you asked. Regenerate, or place tasks by hand in the calendar."
                  : "Nothing is waiting on this day. Protect the space or bring something forward in Tasks.",
                `<div class="row gap-2">${open.length ? `<button class="btn btn-sm" id="p-retry">${icon("rotate")} Try planning</button>` : ""}
                 <a class="btn btn-sm" href="#/calendar">${icon("calendar")} Open calendar</a></div>`
              )}</div>`}
          </div>

          <aside class="rail-stack">
            ${eventsHTML()}
            <section class="panel">
              <div class="panel-head"><h2>Remaining work</h2><span class="mono">${plan ? plan.unplaced.length : 0}</span></div>
              <div class="rows">
                ${plan && plan.unplaced.length ? plan.unplaced.map((id) => {
                  const t = store.task(id);
                  if (!t) return "";
                  return `<div class="row-item">
                    <div class="grow">
                      <div class="row-title" style="font-size:12.5px">${esc(t.title)}</div>
                      <div class="row-meta"><span>${U.fmtDur(t.duration)}</span><span class="sep">·</span><span>${t.projectId ? esc(store.project(t.projectId).name) : "Personal"}</span></div>
                    </div>
                    <button class="icon-btn icon-btn-sm" data-act="open-task" data-id="${t.id}" aria-label="Open task">${icon("more")}</button>
                  </div>`;
                }).join("") : `<div class="planner-empty" style="padding:20px">Nothing is waiting for a slot. ${
                  plan ? "The day's work fits." : ""
                }</div>`}
              </div>
            </section>
            <section class="note note-quiet">
              ${icon("lock")}
              <div><strong>Local and honest.</strong> This planner is a deterministic demo. It reads your data on this device; no model is called and nothing syncs.</div>
            </section>
          </aside>
        </div>
      </div>`;

    main.querySelector("#p-prev").addEventListener("click", () => {
      state.date = U.addDays(state.date, -1);
      state.plan = null;
      load(main);
    });
    main.querySelector("#p-next").addEventListener("click", () => {
      state.date = U.addDays(state.date, 1);
      state.plan = null;
      load(main);
    });
    main.querySelector("#p-today").addEventListener("click", () => {
      state.date = today;
      state.plan = null;
      load(main);
    });
    main.querySelector("#p-regenerate").addEventListener("click", () => load(main));
    main.querySelector("#p-retry")?.addEventListener("click", () => load(main));
    main.querySelector("#p-accept")?.addEventListener("click", accept);
    ui.bind(main, {
      "focus-task": (el) => { location.hash = "#/focus?task=" + el.dataset.id; },
    });

    if (!state.plan && !state.loading && !state.error) load(main);
  }

  function renderRoute(main, params = {}) {
    const from = /^\d{1,4}$/.test(params.from) && Number(params.from) < 1440 ? Number(params.from) : null;
    if (from !== state.routeFrom) {
      state.routeFrom = from;
      if (from != null || state.notBefore != null) {
        state.notBefore = from;
        state.date = U.todayISO();
        load(main);
        return;
      }
    }
    render(main);
  }

  async function accept() {
    const plan = state.plan;
    if (!plan) return;
    const placed = plan.placed.filter((p) => {
      const t = store.task(p.taskId);
      return !p.kept && t && !t.done;
    });
    if (!placed.length) return;
    const ok = await ui.confirm({
      title: "Approve these placements?",
      body: `${U.plural(placed.length, "task")} will be placed on ${U.fmtDate(state.date, "long")} at the proposed times. Already scheduled tasks and events won’t change.`,
      confirmLabel: "Approve placements",
    });
    if (!ok) return;
    placed.forEach((p) => store.actions.updateTask(p.taskId, { date: state.date, start: p.start }));
    state.plan = null;
    ui.toast(`${U.plural(placed.length, "task")} scheduled.`, {
      action: { label: "Open calendar", onClick: () => { location.hash = "#/calendar"; } },
    });
    const main = document.getElementById("main");
    if (main) load(main);
  }

  POS.views = POS.views || {};
  POS.views.planner = { render: renderRoute, destroy: () => { state.routeFrom = undefined; } };
})();
