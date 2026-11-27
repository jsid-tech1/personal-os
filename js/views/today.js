/* Today — a day sheet for decisions, work, and the time between. */
(function () {
  "use strict";
  const POS = window.POS;
  const U = POS.util;
  const { icon, escapeHTML: esc } = U;
  const store = POS.store;
  const ui = POS.ui;
  let clock = null;

  const time = (min) => `<time class="mono" datetime="${U.hhmmOf(min % 1440)}">${U.fmtMin(min)}</time>`;
  const taskCheck = (t) => `<label class="check day-check">
    <input type="checkbox" data-act="toggle-task" data-id="${esc(t.id)}" ${t.done ? "checked" : ""}
      aria-label="${t.done ? "Mark incomplete" : "Mark complete"}: ${esc(t.title)}" />
  </label>`;
  const projectName = (id) => {
    const p = id ? store.project(id) : null;
    return p ? `<span class="day-project tone-${esc(p.color)}"><i class="pdot" aria-hidden="true"></i>${esc(p.name)}</span>` : "<span>Personal</span>";
  };

  function priorityHTML(t, lead = false) {
    return `<li class="day-priority${lead ? " day-priority-lead" : ""}">
      ${taskCheck(t)}
      <div class="day-task-body">
        <button class="day-task-title" data-act="open-task" data-id="${esc(t.id)}">${esc(t.title)}</button>
        <div class="day-task-meta">${projectName(t.projectId)}
          <span class="mono">${U.fmtDur(t.duration)}</span>
          ${t.start == null ? "<span>Unscheduled</span>" : time(t.start)}
        </div>
      </div>
      ${lead
        ? `<a class="btn btn-accent day-focus" href="#/focus?task=${encodeURIComponent(t.id)}">${icon("play")} Start focus</a>`
        : `<a class="icon-btn day-focus-more" href="#/focus?task=${encodeURIComponent(t.id)}" aria-label="Start focus: ${esc(t.title)}" title="Start focus">${icon("play")}</a>`}
    </li>`;
  }

  function scheduleHTML(rows, now) {
    const clockRow = `<li class="day-now">${time(now)}<span>Now</span></li>`;
    if (!rows.length) return `<ol class="day-agenda">${clockRow}</ol><p class="day-empty">No tasks or events on the schedule yet.</p>`;
    let end = null;
    let clockShown = false;
    const items = rows.map(({ kind, item, start, stop }) => {
      let before = "";
      if (!clockShown && end != null && now <= end) {
        before += clockRow;
        clockShown = true;
      }
      if (end != null && start - end >= 15) {
        before += `<li class="day-gap">${time(end)}<span>${U.fmtDur(start - end)} open</span></li>`;
      }
      if (!clockShown && now <= start) {
        before += clockRow;
        clockShown = true;
      }
      const task = kind === "task";
      const proposal = kind === "proposal";
      end = Math.max(end ?? stop, stop);
      return `${before}<li class="day-agenda-row${task && item.done ? " is-done" : ""}">
        <div class="day-agenda-time">${time(start)}${time(stop)}</div>
        <div class="day-slot${proposal ? " is-proposed" : task ? "" : " is-event"}">
          <div class="day-task-body">
            ${task
              ? `<button class="day-task-title" data-act="open-task" data-id="${esc(item.id)}">${esc(item.title)}</button>`
              : `<span class="day-slot-title">${esc(item.title)}</span>`}
            <div class="day-task-meta">${task || proposal
              ? `${projectName(item.projectId)}<span class="mono">${U.fmtDur(stop - start)}</span>`
              : `<span>${item.fixed ? "Fixed event" : "Calendar event"}</span>${item.location ? `<span>${esc(item.location)}</span>` : ""}`}</div>
          </div>
          ${proposal ? '<span class="schedule-proposed-label">Proposed</span>' : task ? taskCheck(item) : ""}
        </div>
      </li>`;
    });
    return `<ol class="day-agenda">${items.join("")}${clockShown ? "" : clockRow}</ol>`;
  }

  function updateSchedule(page, today, todayTasks, events) {
    const now = U.nowMinutes();
    const plan = POS.ai.draftDay(today, { notBefore: now });
    const placed = plan.placed.filter((p) => !p.kept).sort((a, b) => a.start - b.start);
    const first = placed[0];
    const suggestion = first ? store.task(first.taskId) : null;
    const schedule = todayTasks.filter((t) => t.start != null)
      .map((t) => ({ kind: "task", item: t, start: t.start, stop: t.start + t.duration }))
      .concat(events.map((e) => ({ kind: "event", item: e, start: e.start, stop: e.end })));
    if (suggestion) schedule.push({ kind: "proposal", item: suggestion, start: first.start, stop: first.start + first.duration });
    schedule.sort((a, b) => a.start - b.start || a.stop - b.stop);
    page.querySelector(".day-agenda-content").innerHTML = scheduleHTML(schedule, now);
    page.querySelector(".day-plan-note").innerHTML = suggestion
      ? `<p><strong>Suggested slot</strong><span>${esc(suggestion.title)} fits at ${U.fmtMin(first.start)}. Nothing has been moved.</span></p>
         <a class="btn btn-quiet" href="#/planner?from=${now}">Review ${placed.length === 1 ? "suggestion" : `${placed.length} suggestions`}</a>`
      : `<p><strong>Plan changes</strong><span>${plan.unplaced.length
        ? "No more open tasks fit the remaining time and workload limit today."
        : "There are no unscheduled tasks to place today."}</span></p>
         <a class="day-link" href="#/planner?from=${now}">Open planner ${icon("chevron-right")}</a>`;
  }

  function toggleAndRefocus(main, el, update) {
    const region = el.closest("section");
    const labelledBy = region?.getAttribute("aria-labelledby");
    const hadFocus = document.activeElement === el;
    update(el.dataset.id);
    if (!hadFocus || !labelledBy) return;
    const heading = document.getElementById(labelledBy);
    const checkboxes = Array.from(heading?.closest("section").querySelectorAll(`input[data-act="${el.dataset.act}"]`) || []);
    const next = checkboxes.find((box) => box.dataset.id === el.dataset.id) || checkboxes[0] || heading;
    if (main.contains(next)) next.focus({ preventScroll: true });
  }

  function render(main) {
    destroy();
    const st = store.get();
    const today = U.todayISO();
    const stats = store.todayStats(today);
    const priorities = store.priorities(today);
    const todayTasks = store.tasksFor(today);
    const events = st.events.filter((e) => e.date === today);
    const upcoming = st.tasks
      .filter((t) => !t.done && t.date > today && t.date <= U.addDays(today, 6))
      .sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? Infinity) - (b.start ?? Infinity))
      .slice(0, 6);
    const deadlines = st.projects
      .filter((p) => p.status !== "archived" && p.deadline)
      .sort((a, b) => a.deadline.localeCompare(b.deadline))
      .slice(0, 4);
    const habits = st.habits.slice(0, 5);
    const capacity = Number(st.settings.capacity) || 300;
    const focusMin = store.focusMinutes(today);
    const load = stats.plannedMin - capacity;

    main.innerHTML = `
      <div class="page day-sheet">
        <header class="page-head day-head">
          <div>
            <h1 class="page-title">Today</h1>
            <time class="day-date" datetime="${today}">${U.fmtDate(today, "long")}</time>
          </div>
          <div class="page-actions">
            <button class="btn btn-ghost" data-act="assistant">${icon("sparkles")} Ask assistant</button>
            <button class="btn btn-quiet" data-act="add-task">${icon("plus")} Add task</button>
          </div>
        </header>

        <div class="day-layout">
          <section class="day-priorities" aria-labelledby="day-priorities">
            <div class="day-section-head">
              <h2 id="day-priorities" tabindex="-1">${priorities.length ? "Start here" : "Priorities"}</h2>
              <span class="day-measure mono">${U.plural(priorities.length, "priority", "priorities")}</span>
            </div>
            ${priorities.length ? `<ol class="day-priority-list">${priorities.map((t, i) => priorityHTML(t, i === 0)).join("")}</ol>`
              : `<p class="day-empty">${stats.total ? "All of today’s tasks are complete." : "No tasks are planned for today."}</p>`}
          </section>

          <section class="day-schedule" aria-labelledby="day-schedule">
            <div class="day-section-head">
              <h2 id="day-schedule" tabindex="-1">Schedule</h2>
              <a class="day-link" href="#/calendar">Open calendar ${icon("chevron-right")}</a>
            </div>
            <div class="day-agenda-content"></div>
            <div class="day-plan-note"></div>
          </section>

          <aside class="day-margin" aria-label="Day summary">
            <section aria-labelledby="day-load">
              <h2 id="day-load">Workload</h2>
              <p class="day-load-readout"><span class="mono">${U.fmtDur(stats.plannedMin)}</span> planned / ${U.fmtDur(capacity)} limit</p>
              <div class="day-load-track${load > 0 ? " is-over" : ""}" aria-hidden="true">
                <i style="--value:${Math.min(100, Math.round(stats.plannedMin / capacity * 100))}%"></i>
              </div>
              <p class="day-measure ${load > 0 ? "warning" : ""}">${load > 0
                ? `${U.fmtDur(load)} over your limit`
                : load < 0 ? `${U.fmtDur(-load)} under your limit` : "At your daily limit"}</p>
              <div class="day-progress">
                <p><strong>${stats.done} of ${U.plural(stats.total, "task")} done</strong></p>
                ${focusMin ? `<p>${U.fmtDur(focusMin)} in focus</p>` : ""}
              </div>
            </section>
            <section aria-labelledby="day-deadlines">
              <div class="day-section-head">
                <h2 id="day-deadlines">Deadlines</h2>
                <a class="day-link" href="#/projects">Projects ${icon("chevron-right")}</a>
              </div>
              ${deadlines.length ? `<ul class="day-deadlines">${deadlines.map((p) => {
                const days = U.diffDays(p.deadline, today);
                return `<li><a href="#/project/${encodeURIComponent(p.id)}">
                  ${projectName(p.id)}
                  <time class="mono ${days < 0 ? "danger" : days <= 3 ? "warning" : ""}" datetime="${esc(p.deadline)}">${days < 0 ? "Overdue" : days === 0 ? "Today" : U.fmtDate(p.deadline, "short")}</time>
                </a></li>`;
              }).join("")}</ul>` : '<p class="day-measure">No project deadlines.</p>'}
            </section>
            <section aria-labelledby="day-habits">
              <div class="day-section-head">
                <h2 id="day-habits">Habits</h2>
                <a class="day-link" href="#/habits">All habits ${icon("chevron-right")}</a>
              </div>
              ${habits.length ? `<ul class="day-habits">${habits.map((h) => {
                const done = store.habitDone(h);
                const streak = store.habitStreak(h);
                return `<li><label class="check">
                  <input type="checkbox" ${done ? "checked" : ""} data-act="toggle-habit" data-id="${esc(h.id)}" />
                  <span>${esc(h.name)}</span>
                </label>${streak ? `<span class="mono day-measure" aria-label="${U.plural(streak, "day")} in a row">${streak}d</span>` : ""}</li>`;
              }).join("")}</ul>` : '<p class="day-measure">No habits to check off.</p>'}
            </section>
          </aside>

          <section class="day-later" aria-labelledby="day-later">
            <div class="day-section-head">
              <h2 id="day-later" tabindex="-1">Later this week</h2>
              <a class="day-link" href="#/tasks">All tasks ${icon("chevron-right")}</a>
            </div>
            ${upcoming.length ? `<div class="rows">${upcoming.map((t) => ui.taskRow(t, { showDate: true, showTime: false })).join("")}</div>`
              : '<p class="day-empty">No upcoming tasks this week.</p>'}
          </section>
        </div>
      </div>`;

    const page = main.querySelector(".day-sheet");
    updateSchedule(page, today, todayTasks, events);
    clock = setInterval(() => {
      // Don't replace controls while the person is interacting with them.
      const focused = document.activeElement;
      if (today !== U.todayISO()) {
        if (!page.contains(focused)) render(main);
      } else if (!focused?.closest(".day-agenda-content, .day-plan-note")) {
        updateSchedule(page, today, todayTasks, events);
      }
    }, 60000);
    ui.bind(main, {
      "add-task": () => ui.quickAddTask(today),
      "toggle-task": (el) => toggleAndRefocus(main, el, store.actions.toggleTask),
      "toggle-habit": (el) => toggleAndRefocus(main, el, store.actions.toggleHabitToday),
    });
  }

  function destroy() {
    clearInterval(clock);
    clock = null;
  }

  POS.views = POS.views || {};
  POS.views.today = { render, destroy };
})();
