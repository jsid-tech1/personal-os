/* Calendar — existing events and proposed work, never confused. */
(function () {
  "use strict";
  const POS = window.POS;
  const U = POS.util;
  const { icon, esc } = { icon: U.icon, esc: U.escapeHTML };
  const store = POS.store;
  const ui = POS.ui;

  const DAY_START = 420;  // 7:00
  const DAY_END = 1320;   // 22:00
  const SPAN = DAY_END - DAY_START;

  const state = {
    view: "week",
    anchor: U.todayISO(),
    proposal: null,
    planning: false,
    proposalDate: null,
  };

  const weekStart = () => U.startOfWeek(state.anchor, store.get().settings.weekStartsMonday);
  const visibleDays = () => {
    if (state.view === "day") return [state.anchor];
    const start = weekStart();
    return Array.from({ length: 7 }, (_, i) => U.addDays(start, i));
  };
  const proposalDate = () => {
    const days = visibleDays();
    return days.includes(U.todayISO()) ? U.todayISO() : days[0];
  };

  const tasksOn = (iso) => store.get().tasks.filter((t) => t.date === iso && t.start != null);
  const eventsOn = (iso) => store.get().events.filter((e) => e.date === iso);

  function projectTone(t) {
    const p = t.projectId ? store.project(t.projectId) : null;
    return p ? `tone-${p.color}` : "tone-accent";
  }

  function blockHTML(item, kind, layout) {
    const split = layout && layout.lanes > 1;
    const laneStyle = split ? `--lane:${layout.lane};--lanes:${layout.lanes};` : "";
    const splitClass = split ? " is-split" : "";
    if (kind === "event") {
      const e = item;
      const span = e.end - e.start;
      const sizeClass = span <= 30 ? " is-compact" : span < 45 ? " is-short" : "";
      return `<button class="cal-block cal-event${splitClass}${sizeClass}" style="--top:${((e.start - DAY_START) / SPAN) * 100}%;--h:${(span / SPAN) * 100}%;${laneStyle}"
        data-event="${e.id}" title="${esc(e.title)}">
        <span class="cal-block-time mono">${U.fmtMin(e.start)}</span>
        <span class="cal-block-title">${esc(e.title)}</span>
        <span class="cal-block-note">${e.fixed ? "Fixed" : "Flexible"}${e.location ? " · " + esc(e.location) : ""}</span>
      </button>`;
    }
    const t = item;
    const p = t.projectId ? store.project(t.projectId) : null;
    const sizeClass = t.duration <= 30 ? " is-compact" : t.duration < 45 ? " is-short" : "";
    return `<button class="cal-block cal-task ${projectTone(t)} ${t.done ? "is-done" : ""}${splitClass}${sizeClass}"
      draggable="true" data-drag-task="${t.id}" data-open-task="${t.id}"
      style="--top:${((t.start - DAY_START) / SPAN) * 100}%;--h:${Math.max(t.duration, 15) / SPAN * 100}%;${laneStyle}"
      title="${esc(t.title)} · ${U.fmtDur(t.duration)}">
      <span class="cal-block-time mono">${U.fmtMin(t.start)}</span>
      <span class="cal-block-title">${esc(t.title)}</span>
      <span class="cal-block-note"><i class="pdot" style="--tone:var(--tone)"></i>${p ? esc(p.name) : "Personal"} · ${U.fmtDur(t.duration)}</span>
    </button>`;
  }

  function layoutDay(day) {
    const entries = eventsOn(day)
      .map((e) => ({ kind: "event", item: e, start: e.start, end: e.end }))
      .concat(tasksOn(day).map((t) => ({
        kind: "task", item: t, start: t.start, end: t.start + Math.max(t.duration, 15),
      })))
      .sort((a, b) => a.start - b.start || b.end - a.end);

    const out = [];
    let cluster = [];
    let clusterEnd = -1;
    const flush = () => {
      if (!cluster.length) return;
      const laneEnds = [];
      cluster.forEach((entry) => {
        let lane = laneEnds.findIndex((end) => end <= entry.start);
        if (lane === -1) { lane = laneEnds.length; laneEnds.push(entry.end); }
        else laneEnds[lane] = entry.end;
        entry.lane = lane;
      });
      cluster.forEach((entry) => { entry.lanes = laneEnds.length; out.push(entry); });
      cluster = [];
    };
    entries.forEach((entry) => {
      if (cluster.length && entry.start >= clusterEnd) { flush(); clusterEnd = -1; }
      cluster.push(entry);
      clusterEnd = Math.max(clusterEnd, entry.end);
    });
    flush();
    return out;
  }

  function hourLines() {
    let out = "";
    for (let m = DAY_START; m <= DAY_END; m += 60) {
      out += `<div class="cal-hour" style="top:${((m - DAY_START) / SPAN) * 100}%"><span class="mono">${U.fmtMin(m)}</span></div>`;
    }
    return out;
  }

  function nowLine(day) {
    const today = U.todayISO();
    if (day !== today) return "";
    const m = U.nowMinutes();
    if (m < DAY_START || m > DAY_END) return "";
    return `<div class="cal-now" style="top:${((m - DAY_START) / SPAN) * 100}%"><i></i><span class="mono">${U.fmtMin(m)}</span></div>`;
  }

  function railHTML(days) {
    const st = store.get();
    const inDays = new Set(days);
    const pool = st.tasks.filter((t) => !t.done && (t.start == null || !inDays.has(t.date)))
      .sort((a, b) => {
        const aLate = a.date < U.todayISO() ? 0 : 1;
        const bLate = b.date < U.todayISO() ? 0 : 1;
        if (aLate !== bLate) return aLate - bLate;
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.date.localeCompare(b.date);
      });
    const shown = pool.slice(0, 14);
    return `
      <aside class="cal-rail" aria-label="Unscheduled tasks">
        <div class="cal-rail-head">
          <h2>Needs a home</h2>
          <span class="mono">${pool.length}</span>
        </div>
        <p class="cal-rail-help">Drag onto a day to place it. Nothing moves until you drop it.</p>
        <div class="cal-rail-list">
          ${shown.length ? shown.map((t) => {
            const p = t.projectId ? store.project(t.projectId) : null;
            const late = t.date < U.todayISO();
            return `<div class="rail-task ${projectTone(t)}" draggable="true" data-drag-task="${t.id}" data-open-task="${t.id}">
              <span class="drag-grip" aria-hidden="true">${icon("gripv")}</span>
              <div class="grow">
                <div class="rail-task-title">${esc(t.title)}</div>
                <div class="rail-task-meta">
                  <span>${p ? esc(p.name) : "Personal"}</span>
                  <span class="sep">·</span>
                  <span class="${late ? "danger" : ""}">${U.relDate(t.date)}</span>
                  <span class="sep">·</span>
                  <span class="mono">${U.fmtDur(t.duration)}</span>
                </div>
              </div>
            </div>`;
          }).join("") : `<div class="empty" style="padding:28px 12px"><p>Everything has a place in this range.</p></div>`}
        </div>
        ${pool.length > shown.length ? `<div class="cal-rail-foot mono">+${pool.length - shown.length} more in Tasks</div>` : ""}
        <div class="cal-rail-ai">
          <p><strong>Propose a schedule.</strong> The assistant fits open work between your fixed events. You approve every placement.</p>
          <button class="btn btn-sm btn-accent" id="cal-propose">${icon("sparkles")} Propose for ${U.fmtDate(proposalDate(), "short")}</button>
        </div>
      </aside>`;
  }

  function gridHTML(days) {
    const isDay = state.view === "day";
    return `
      <div class="cal-board ${isDay ? "is-day" : ""}">
        <div class="cal-head-row">
          <span class="cal-head-gutter mono" aria-hidden="true"></span>
          <div class="cal-head-days" style="--cols:${days.length}">
            ${days.map((d) => {
              const isToday = d === U.todayISO();
              return `<button class="cal-head-day ${isToday ? "is-today" : ""}" data-goto-day="${d}">
                <span class="mono">${U.DOW_S[U.fromISO(d).getDay()]}</span>
                <strong>${U.fromISO(d).getDate()}</strong>
                <span class="cal-head-count mono">${tasksOn(d).filter((t) => !t.done).length + eventsOn(d).length}</span>
              </button>`;
            }).join("")}
          </div>
        </div>
        <div class="cal-body">
          <div class="cal-gutter" style="--cols:${days.length}">
            ${Array.from({ length: 15 }, (_, i) => DAY_START + i * 60).map((m) =>
              `<span class="mono" style="top:${((m - DAY_START) / SPAN) * 100}%">${U.fmtMin(m)}</span>`).join("")}
          </div>
          <div class="cal-days" style="--cols:${days.length}">
            ${days.map((d) => {
              const entries = layoutDay(d);
              return `
              <div class="cal-day" data-drop-date="${d}">
                <div class="cal-hour-lines" aria-hidden="true">${hourLines()}</div>
                <div class="cal-drop-hint">Drop to schedule</div>
                ${entries.filter((e) => e.kind === "event").map((e) => blockHTML(e.item, "event", e)).join("")}
                ${entries.filter((e) => e.kind === "task").map((e) => blockHTML(e.item, "task", e)).join("")}
                ${nowLine(d)}
              </div>`;
            }).join("")}
          </div>
        </div>
      </div>`;
  }

  function monthHTML() {
    const st = store.get();
    const start = U.startOfWeek(`${state.anchor.slice(0, 7)}-01`, st.settings.weekStartsMonday);
    const month = U.fromISO(state.anchor).getMonth();
    const cells = Array.from({ length: 42 }, (_, i) => U.addDays(start, i));
    const dow = U.DOW_S.slice();
    const order = st.settings.weekStartsMonday ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];
    return `
      <div class="cal-month">
        <div class="cal-month-dow">${order.map((i) => `<span class="mono">${dow[i]}</span>`).join("")}</div>
        <div class="cal-month-grid">
          ${cells.map((iso) => {
            const d = U.fromISO(iso);
            const inMonth = d.getMonth() === month;
            const isToday = iso === U.todayISO();
            const evs = eventsOn(iso);
            const tks = tasksOn(iso).filter((t) => !t.done).slice(0, 3);
            return `<div class="cal-month-cell ${inMonth ? "" : "is-outside"} ${isToday ? "is-today" : ""}" data-drop-date="${iso}" data-goto-day="${iso}">
              <div class="cal-month-num"><span class="mono">${d.getDate()}</span>${isToday ? '<i class="pdot pdot-round" style="--tone:var(--accent)"></i>' : ""}</div>
              <div class="cal-month-items">
                ${evs.slice(0, 2).map((e) => `<button class="cal-month-event" data-event="${e.id}">
                  <span class="mono">${U.fmtMin(e.start)}</span>${esc(e.title)}
                </button>`).join("")}
                ${tks.map((t) => {
                  const p = t.projectId ? store.project(t.projectId) : null;
                  return `<button class="cal-month-task ${projectTone(t)}" draggable="true" data-drag-task="${t.id}" data-open-task="${t.id}">
                    <i class="pdot" style="--tone:var(--tone)"></i>${esc(t.title)}
                  </button>`;
                }).join("")}
                ${evs.length + tks.length > 4 ? `<span class="cal-month-more mono">+${evs.length + tks.length - 4} more</span>` : ""}
              </div>
            </div>`;
          }).join("")}
        </div>
      </div>`;
  }

  function render(main) {
    const days = visibleDays();
    const st = store.get();
    const title = state.view === "month"
      ? U.fmtDate(state.anchor, "monthYear")
      : state.view === "day"
      ? U.fmtDate(state.anchor, "long")
      : `${U.fmtDate(days[0], "short")} – ${U.fmtDate(days[6], "short")}`;
    const openCount = st.tasks.filter((t) => !t.done).length;

    main.innerHTML = `
      <div class="page cal-page ${state.view === "month" ? "is-month" : ""}">
        <header class="page-head">
          <div>
            <h1 class="page-title">Calendar</h1>
            <div class="page-sub">
              <span>${esc(title)}</span>
              <span class="dot-sep">·</span>
              <span>${openCount} open tasks</span>
              <span class="dot-sep">·</span>
              <span class="row gap-2" style="display:inline-flex">
                <i class="legend-swatch legend-event"></i> event
                <i class="legend-swatch legend-task"></i> task
              </span>
            </div>
          </div>
          <div class="page-actions">
            <button class="btn" id="cal-new-event">${icon("plus")} Event</button>
            <button class="btn btn-accent" id="cal-propose-top">${icon("sparkles")} Propose schedule</button>
          </div>
        </header>

        <div class="cal-toolbar">
          <div class="row gap-2">
            <button class="icon-btn" id="cal-prev" aria-label="Previous">${icon("chevron-left")}</button>
            <button class="btn btn-sm" id="cal-today">Today</button>
            <button class="icon-btn" id="cal-next" aria-label="Next">${icon("chevron-right")}</button>
          </div>
          <h2 class="cal-title serif">${esc(title)}</h2>
          <div class="segmented" role="group" aria-label="Calendar view">
            ${[["day", "Day"], ["week", "Week"], ["month", "Month"]].map(([id, label]) =>
              `<button data-view="${id}" aria-pressed="${state.view === id}">${label}</button>`).join("")}
          </div>
        </div>

        <div class="cal-layout">
          <div class="cal-main">
            ${state.view === "month" ? monthHTML() : gridHTML(days)}
          </div>
          ${railHTML(days)}
        </div>
      </div>`;

    /* navigation */
    const step = () => (state.view === "day" ? 1 : state.view === "week" ? 7 : 30);
    main.querySelector("#cal-prev").addEventListener("click", () => {
      state.anchor = U.addDays(weekStart(), -step());
      render(main);
    });
    main.querySelector("#cal-next").addEventListener("click", () => {
      state.anchor = U.addDays(state.view === "month" ? state.anchor : weekStart(), step());
      render(main);
    });
    main.querySelector("#cal-today").addEventListener("click", () => {
      state.anchor = U.todayISO();
      render(main);
    });
    main.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => {
      state.view = b.dataset.view;
      render(main);
    }));
    main.querySelectorAll("[data-goto-day]").forEach((el) => el.addEventListener("click", (e) => {
      if (e.target.closest("[data-open-task],[data-event]")) return;
      state.anchor = el.dataset.gotoDay;
      if (state.view !== "day" && (el.classList.contains("cal-head-day") || el.classList.contains("cal-month-cell"))) {
        state.view = "day";
      }
      render(main);
    }));

    /* open things */
    main.querySelectorAll("[data-open-task]").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (el.dataset.dragged === "1") { el.dataset.dragged = "0"; return; }
        e.stopPropagation();
        ui.openTask(el.dataset.openTask);
      });
    });
    main.querySelectorAll("[data-event]").forEach((el) => el.addEventListener("click", (e) => {
      e.stopPropagation();
      openEvent(el.dataset.event, main);
    }));

    /* propose */
    const propose = () => openProposal(main);
    main.querySelector("#cal-propose")?.addEventListener("click", propose);
    main.querySelector("#cal-propose-top").addEventListener("click", propose);

    /* new event */
    main.querySelector("#cal-new-event").addEventListener("click", () => openEvent(null, main, state.anchor));

    /* drag and drop */
    wireDrag(main);
  }

  function wireDrag(main) {
    let dragging = null;
    main.querySelectorAll("[data-drag-task]").forEach((el) => {
      el.addEventListener("dragstart", (e) => {
        dragging = el.dataset.dragTask;
        el.dataset.dragged = "1";
        el.classList.add("is-dragging");
        try { e.dataTransfer.setData("text/plain", dragging); } catch (err) { /* Safari */ }
        e.dataTransfer.effectAllowed = "move";
      });
      el.addEventListener("dragend", () => {
        el.classList.remove("is-dragging");
        setTimeout(() => { el.dataset.dragged = "0"; }, 40);
        main.querySelectorAll(".cal-day, .cal-month-cell").forEach((d) => d.classList.remove("is-drop"));
        dragging = null;
      });
    });
    main.querySelectorAll("[data-drop-date]").forEach((zone) => {
      zone.addEventListener("dragover", (e) => {
        if (!dragging) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        zone.classList.add("is-drop");
      });
      zone.addEventListener("dragleave", (e) => {
        if (!zone.contains(e.relatedTarget)) zone.classList.remove("is-drop");
      });
      zone.addEventListener("drop", (e) => {
        e.preventDefault();
        zone.classList.remove("is-drop");
        const id = dragging || e.dataTransfer.getData("text/plain");
        const t = store.task(id);
        if (!t) return;
        const iso = zone.dataset.dropDate;
        let start = t.start;
        if (zone.classList.contains("cal-day")) {
          const rect = zone.getBoundingClientRect();
          const pct = U.clamp((e.clientY - rect.top) / rect.height, 0, 1);
          const raw = DAY_START + pct * SPAN;
          start = Math.round(raw / 15) * 15;
          start = U.clamp(start, DAY_START, DAY_END - 15);
        }
        store.actions.moveTask(t.id, iso, start);
        ui.toast(`${t.title.length > 34 ? t.title.slice(0, 34) + "…" : t.title} moved to ${U.fmtDate(iso, "short")}${start != null ? ", " + U.fmtMin(start) : ""}.`);
      });
    });
  }

  function openEvent(id, main, presetDate) {
    const existing = id ? store.get().events.find((e) => e.id === id) : null;
    const e = existing || {
      title: "",
      date: presetDate || state.anchor,
      start: 600,
      end: 660,
      fixed: true,
      location: "",
    };
    ui.modal({
      title: existing ? "Edit event" : "New calendar event",
      sub: "Local calendar · nothing syncs to an outside account",
      body: `
        <div class="stack gap-4">
          <div class="field">
            <label class="label" for="ev-title">Title</label>
            <input class="input" id="ev-title" value="${esc(e.title)}" placeholder="e.g. Studio standup" autofocus />
          </div>
          <div class="field-row">
            <div class="field">
              <label class="label" for="ev-date">Day</label>
              <input class="input" type="date" id="ev-date" value="${e.date}" />
            </div>
            <div class="field">
              <label class="label" for="ev-start">Start</label>
              <input class="input" type="time" id="ev-start" value="${U.hhmmOf(e.start)}" />
            </div>
            <div class="field">
              <label class="label" for="ev-end">End</label>
              <input class="input" type="time" id="ev-end" value="${U.hhmmOf(e.end)}" />
            </div>
          </div>
          <div class="field">
            <label class="label" for="ev-loc">Location <span class="opt">optional</span></label>
            <input class="input" id="ev-loc" value="${esc(e.location || "")}" placeholder="Room, address or call link" />
          </div>
          <label class="switch">
            <input type="checkbox" id="ev-fixed" ${e.fixed ? "checked" : ""} />
            <span class="track"></span>
            <span>Fixed — the assistant must plan around it</span>
          </label>
          <p class="field-help">Events live only in this browser. Import or sync from an external calendar is not connected.</p>
        </div>`,
      foot: `
        ${existing ? `<button class="btn btn-danger grow" id="ev-delete" style="margin-right:auto">${icon("trash")} Delete</button>` : ""}
        <button class="btn" data-close>Cancel</button>
        <button class="btn btn-primary" id="ev-save">${existing ? "Save event" : "Add event"}</button>`,
      onMount: (el, close) => {
        el.querySelector("#ev-save").addEventListener("click", () => {
          const title = el.querySelector("#ev-title").value.trim();
          if (!title) { ui.toast("An event needs a title.", { kind: "danger" }); return; }
          const start = U.minutesOf(el.querySelector("#ev-start").value || "10:00");
          let end = U.minutesOf(el.querySelector("#ev-end").value || "11:00");
          if (end <= start) end = start + 30;
          const data = {
            title,
            date: el.querySelector("#ev-date").value || e.date,
            start,
            end,
            location: el.querySelector("#ev-loc").value.trim(),
            fixed: el.querySelector("#ev-fixed").checked,
          };
          if (existing) store.actions.updateEvent(existing.id, data);
          else store.actions.addEvent(data);
          close();
          ui.toast(existing ? "Event updated." : "Event added to the local calendar.");
        });
        el.querySelector("#ev-delete")?.addEventListener("click", async () => {
          close();
          const ok = await ui.confirm({
            title: "Delete this event?",
            body: `“${existing.title}” will be removed from the local calendar. Nothing external is touched.`,
            confirmLabel: "Delete event",
            danger: true,
          });
          if (ok) { store.actions.deleteEvent(existing.id); ui.toast("Event deleted."); }
        });
      },
    });
  }

  async function openProposal(main) {
    const date = proposalDate();
    const s = ui.modal({
      title: "A draft schedule",
      sub: `For ${U.fmtDate(date, "long")} · you approve every placement`,
      wide: true,
      body: `<div class="stack gap-3">${ui.skeletonRows(4)}</div>`,
      foot: `<button class="btn grow" data-close style="margin-right:auto">Cancel</button>`,
    });
    try {
      const plan = await POS.ai.planDay(date);
      const st = store.get();
      const placed = plan.placed.filter((p) => {
        const t = st.tasks.find((x) => x.id === p.taskId);
        return t && !t.done;
      });
      const proposed = placed.filter((p) => !p.kept);
      s.el.querySelector(".modal-body").innerHTML = `
        <div class="stack gap-4">
          <div class="note">${icon("sparkles")}<div>${esc(plan.explanation)}</div></div>
          <div class="proposal-list">
            ${placed.length ? placed.map((p) => {
              const t = store.task(p.taskId);
              const pj = t.projectId ? store.project(t.projectId) : null;
              return `<div class="proposal-row${p.kept ? "" : " is-proposed"}">
                <span class="mono proposal-time">${U.fmtMin(p.start)}</span>
                <div class="grow">
                  <div class="proposal-title">${esc(t.title)}</div>
                  <div class="proposal-meta">${pj ? esc(pj.name) : "Personal"} · ${U.fmtDur(p.duration)}${t.date < date ? " · was " + U.relDate(t.date) : ""}</div>
                </div>
                ${p.kept ? '<span class="planner-confirmed-label">Scheduled</span>' : '<span class="schedule-proposed-label">Proposed</span>'}
              </div>`;
            }).join("") : ui.emptyState("No open work", "Nothing is waiting for a slot on this day.")}
          </div>
          ${plan.unplaced.length ? `<div class="note note-warning">${icon("warning")}<div>${plan.unplaced.length} task${plan.unplaced.length > 1 ? "s" : ""} did not fit and will stay unscheduled.</div></div>` : ""}
          <p class="field-help">This creates no events and touches no external calendar. Approving only sets start times on your own tasks.</p>
        </div>`;
      s.el.querySelector(".modal-foot").innerHTML = `
        <button class="btn" data-close>Keep as is</button>
        <button class="btn btn-accent" id="apply-plan" ${proposed.length ? "" : "disabled"}>${icon("check")} Approve ${proposed.length ? U.plural(proposed.length, "placement") : "placements"}</button>`;
      s.el.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => s.close()));
      s.el.querySelector("#apply-plan")?.addEventListener("click", () => {
        s.close();
        const apply = async () => {
          const ok = await ui.confirm({
            title: "Apply this schedule?",
            body: `${U.plural(proposed.length, "task")} will be placed on ${U.fmtDate(date, "long")}. Already scheduled tasks and events won’t change.`,
            confirmLabel: "Apply placements",
          });
          if (!ok) return;
          proposed.forEach((p) => {
            store.actions.updateTask(p.taskId, { date, start: p.start });
          });
          ui.toast(`${U.plural(proposed.length, "task")} scheduled on ${U.fmtDate(date, "short")}.`);
        };
        apply();
      });
    } catch (err) {
      s.el.querySelector(".modal-body").innerHTML =
        `<div class="note note-warning">${icon("warning")}<div>The planner could not read the day. Nothing changed. Try again.</div></div>`;
    }
  }

  POS.views = POS.views || {};
  POS.views.calendar = { render };
})();
