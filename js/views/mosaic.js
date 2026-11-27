/* My Mosaic — the weekly canvas and the archive of finished weeks. */
(function () {
  "use strict";
  const POS = window.POS;
  const U = POS.util;
  const P = POS.planning;
  const M = POS.mosaic;
  const { icon, esc } = { icon: U.icon, esc: U.escapeHTML };
  let archiveMonth = U.todayISO().slice(0, 7);

  function weekLabel(iso) {
    return U.fmtDate(iso, "long");
  }

  function render(main) {
    const current = M.current();
    const records = M.records();
    const keys = [...new Set([...Object.keys(records), current.key])];
    const monthWeeks = keys
      .filter((key) => key.slice(0, 7) === archiveMonth || P.add(key, 6).slice(0, 7) === archiveMonth)
      .sort();
    const earlier = Object.keys(records).filter((key) => key !== current.key).sort().reverse();
    const count = current.ids.length;

    main.innerHTML = `
      <div class="page studio-page">
        <header class="page-head">
          <div>
            <h1 class="page-title">My <em>Mosaic</em></h1>
            <div class="page-sub"><span>A small collection made by showing up. No perfect weeks required.</span></div>
          </div>
          <div class="page-actions">
            <a class="btn" href="#/today">${icon("today")} Back to today</a>
          </div>
        </header>

        <section class="mosaic-main" aria-labelledby="mosaic-current">
          <div class="mosaic-canvas">${M.html(count, current.key)}</div>
          <div class="mosaic-story">
            <p class="subtle">Week of ${weekLabel(current.key)}</p>
            <h2 id="mosaic-current">One task.<br>A little more colour.</h2>
            <p>Each completed task reveals eight fragments. Your composition grows with the work you finish, even if you only finish a little.</p>
            <strong class="mosaic-count">${U.plural(count, "task")} completed</strong>
            <p>A new canvas begins every Monday. Previous weeks stay in your archive, just as you left them.</p>
            ${count ? `<a class="btn" href="#/tasks">See completed tasks</a>` : `<a class="btn btn-primary" href="#/today">Plan today’s first task</a>`}
          </div>
        </section>

        <section class="mosaic-archive" aria-labelledby="mosaic-archive-title">
          <div class="studio-section-head">
            <h2 id="mosaic-archive-title">Your collection</h2>
            <label class="archive-month">Month
              <input class="input" type="month" id="mosaic-month" value="${esc(archiveMonth)}" aria-label="Archive month" />
            </label>
          </div>
          ${monthWeeks.length ? `<div class="mosaic-month-grid">${monthWeeks.map((key) => {
            const done = records[key]?.taskIds.length || 0;
            return `<article class="archive-piece">
              ${M.html(done, key)}
              <h3>Week of ${weekLabel(key)}</h3>
              <p>${U.plural(done, "task")} completed${key === current.key ? " / In progress" : ""}</p>
            </article>`;
          }).join("")}</div>` : `<p class="quiet-empty">No saved canvases in this month yet.</p>`}
          ${!earlier.length ? `<p class="quiet-empty">Your collection starts here. This week’s artwork will remain when next week begins.</p>` : ""}
          ${earlier.length ? `<div class="archive-history">${earlier.map((key) => `
            <details>
              <summary>Week of ${weekLabel(key)} / ${U.plural(records[key].taskIds.length, "completed task")}</summary>
              ${M.html(records[key].taskIds.length, key)}
            </details>`).join("")}</div>` : ""}
        </section>
      </div>`;

    const month = main.querySelector("#mosaic-month");
    month.addEventListener("change", () => {
      if (!/^\d{4}-\d{2}$/.test(month.value)) return;
      archiveMonth = month.value;
      render(main);
    });
  }

  POS.views = POS.views || {};
  POS.views.mosaic = { render };
})();
