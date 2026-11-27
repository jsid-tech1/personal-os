/* Goal Breakdown — a goal becomes milestones, tasks, dates, a draft. */
(function () {
  "use strict";
  const POS = window.POS;
  const U = POS.util;
  const { icon, esc } = { icon: U.icon, esc: U.escapeHTML };
  const store = POS.store;
  const ui = POS.ui;

  let busy = false;
  let plan = null;
  let editing = false;
  let attachProjectId = null;
  let lastValues = null;
  let draftError = "";
  let request = null;
  let owner = null;

  function formValues(main) {
    if (!main) return null;
    return {
      title: main.querySelector("#g-title")?.value || "",
      description: main.querySelector("#g-desc")?.value || "",
      targetDate: main.querySelector("#g-date")?.value || U.addDays(U.todayISO(), 30),
      capacity: Number(main.querySelector("#g-cap")?.value) || 240,
      weekendsOff: !!main.querySelector("#g-weekends")?.checked,
      provider: main.querySelector("#g-provider")?.value || "deepseek",
    };
  }

  function render(main, params = {}) {
    if (params.project) attachProjectId = params.project;
    const project = attachProjectId ? store.project(attachProjectId) : null;
    const st = store.get();
    const saved = lastValues || {};
    const target = project ? project.deadline : saved.targetDate || U.addDays(U.todayISO(), 30);

    main.innerHTML = `
      <div class="page">
        <header class="page-head">
          <div>
            <h1 class="page-title">Goal <em>Breakdown</em></h1>
            <div class="page-sub">
              <span>A goal becomes milestones. Milestones become work you can put on a day.</span>
              <span class="dot-sep">·</span>
              <span class="mono">${plan ? plan.local ? "On-device draft" : "DeepSeek draft" : "Review before saving"}</span>
            </div>
          </div>
          <div class="page-actions">
            ${plan ? `
              <button class="btn" id="g-regen">${icon("rotate")} Regenerate</button>
              <button class="btn" id="g-edit">${icon("edit")} ${editing ? "Done editing" : "Edit"}</button>
              <button class="btn btn-accent" id="g-approve">${icon("check")} Approve &amp; schedule</button>
            ` : `<a class="btn btn-ghost" href="#/projects">${icon("folder")} Projects</a>`}
          </div>
        </header>

        <div class="goal-layout">
          <aside class="goal-form" aria-label="Goal details">
            ${project ? `
              <div class="note note-quiet" style="margin-bottom:16px">${icon("folder")}
                <div>Adding to <strong>${esc(project.name)}</strong>. Existing milestones stay.</div>
              </div>` : ""}
            <div class="stack gap-5">
              <div class="field">
                <label class="label" for="g-title">What do you want to finish?</label>
                <input class="input" id="g-title" value="${esc(project ? project.name : params.title || saved.title || "")}"
                  placeholder="e.g. Finish my design portfolio" ${project ? "readonly" : ""} />
              </div>
              <div class="field">
                <label class="label" for="g-desc">Context <span class="opt">optional</span></label>
                <textarea class="textarea" id="g-desc" placeholder="What does done look like? Any constraints?">${esc(project ? project.description : params.description || saved.description || "")}</textarea>
              </div>
              <div class="field-row">
                <div class="field">
                  <label class="label" for="g-date">Target date</label>
                  <input class="input" type="date" id="g-date" value="${target}" />
                </div>
                <div class="field">
                  <label class="label" for="g-cap">Daily minutes</label>
                  <input class="input" type="number" id="g-cap" value="${saved.capacity || st.settings.capacity}" min="15" max="720" step="15" />
                </div>
              </div>
              <label class="switch">
                <input type="checkbox" id="g-weekends" ${saved.weekendsOff === false ? "" : "checked"} />
                <span class="track"></span>
                <span>Keep weekends out of the draft</span>
              </label>
              <div class="field">
                <label class="label" for="g-provider">Planner</label>
                <select class="input" id="g-provider" ${busy ? "disabled" : ""}>
                  <option value="deepseek" ${saved.provider !== "local" ? "selected" : ""}>DeepSeek agent</option>
                  <option value="local" ${saved.provider === "local" ? "selected" : ""}>On-device templates</option>
                </select>
              </div>
              <button class="btn btn-accent btn-lg btn-block" id="g-draft" ${busy ? "disabled" : ""}>
                ${icon("sparkles")} ${busy ? "Building your plan…" : plan ? "Draft it again" : "Draft the plan"}
              </button>
              <p style="font-size:11px;color:var(--ink-4);line-height:1.6">
                DeepSeek receives your goal, context and daily minutes. Calendar dates are checked
                locally. On-device templates work without AI. Nothing is saved until you approve.
              </p>
              <p role="alert" ${draftError ? "" : "hidden"}>${esc(draftError)}</p>
            </div>

            ${!plan ? `
            <div class="goal-how">
              <div class="goal-how-title">What happens next</div>
              <ol>
                <li><span class="mono">01</span> The goal is split into milestones.</li>
                <li><span class="mono">02</span> Each milestone gets tasks with estimates.</li>
                <li><span class="mono">03</span> Tasks are distributed across your working days.</li>
                <li><span class="mono">04</span> You edit, regenerate, or approve the draft.</li>
              </ol>
            </div>` : ""}
          </aside>

          <section class="goal-plan" id="goal-plan" aria-live="polite">
            ${busy ? `
              <div class="panel"><div class="panel-body">
                <div class="skeleton sk-line w-40" style="height:14px"></div>
                <div class="skeleton sk-line w-80"></div>
                <div class="skeleton sk-block" style="margin-top:18px"></div>
                <div class="skeleton sk-block" style="margin-top:12px"></div>
                <div class="skeleton sk-block" style="margin-top:12px"></div>
              </div></div>` : plan ? planHTML() : emptyPlanHTML()}
          </section>
        </div>
      </div>`;

    // form wiring
    const draftBtn = main.querySelector("#g-draft");
    draftBtn.addEventListener("click", () => draft(main));
    if (plan) {
      main.querySelector("#g-regen").addEventListener("click", async () => {
        const ok = await ui.confirm({
          title: "Draft the plan again?",
          body: "The current draft is replaced. Nothing has been scheduled yet, so no saved work is lost.",
          confirmLabel: "Regenerate",
        });
        if (ok) draft(main, true);
      });
      main.querySelector("#g-edit").addEventListener("click", () => {
        if (editing) captureEdits(main);
        editing = !editing;
        render(main);
      });
      main.querySelector("#g-approve").addEventListener("click", () => approve(main));
      if (editing) wireEditors(main);
      main.querySelectorAll("[data-toggle-ms]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const body = btn.closest(".ms").querySelector(".ms-body");
          const open = body.hasAttribute("hidden");
          if (open) body.removeAttribute("hidden"); else body.setAttribute("hidden", "");
          btn.setAttribute("aria-expanded", String(open));
          btn.querySelector(".ms-chev").innerHTML = icon(open ? "chevron-down" : "chevron-right");
        });
      });
    }
  }

  function emptyPlanHTML() {
    return `
      <div class="goal-empty">
        <div class="goal-empty-mark">${icon("layers", "ico-lg")}</div>
        <h2 class="serif" style="font-size:30px;font-weight:400;letter-spacing:-.015em">No draft yet</h2>
        <p style="max-width:44ch;color:var(--ink-3);font-size:13px;margin-top:8px">
          Name the goal and give it a date. The draft will show every milestone, task, estimate and
          day before anything touches your calendar.
        </p>
        <div class="goal-examples">
          ${["Finish my design portfolio in 30 days", "Learn motion design", "Apply for eight internships"].map((t) =>
            `<button class="chip" data-example="${esc(t)}">${esc(t)}</button>`).join("")}
        </div>
      </div>`;
  }

  function planHTML() {
    const totalTasks = plan.milestones.reduce((n, m) => n + m.tasks.length, 0);
    const days = new Set();
    plan.milestones.forEach((m) => m.tasks.forEach((t) => days.add(t.date)));
    return `
      <div class="plan-head panel">
        <div class="panel-body">
          <div class="spread" style="align-items:flex-start">
            <div>
              <div class="row gap-2">
                <span class="tag tag-accent tag-mono">DRAFT</span>
                <span class="mono" style="font-size:10.5px;color:var(--ink-3)">${plan.milestones.length} MILESTONES · ${totalTasks} TASKS</span>
              </div>
              <h2 class="serif" style="font-size:28px;font-weight:400;margin-top:8px;letter-spacing:-.015em">${esc(plan.title)}</h2>
              <div class="meta-line" style="margin-top:6px">
                <span>${U.fmtDate(plan.startDate, "short")} → ${U.fmtDate(plan.targetDate, "short")}</span>
                <span class="sep">/</span>
                <span>${U.fmtDur(plan.totalMinutes)} of work</span>
                <span class="sep">/</span>
                <span>${days.size} working ${days.size === 1 ? "day" : "days"}</span>
              </div>
            </div>
            <div style="text-align:right">
              <div class="mono" style="font-size:10px;letter-spacing:.08em;color:var(--ink-3);text-transform:uppercase">Draft ends</div>
              <div class="mono" style="font-size:19px;margin-top:4px">${U.fmtDate(plan.endDate, "short")}</div>
            </div>
          </div>
          <div class="note" style="margin-top:16px">${icon("sparkles")}
            <div>${esc(plan.explanation)}</div>
          </div>
          ${plan.note ? `<p style="font-size:12px;color:var(--ink-3);margin-top:12px;max-width:66ch">${esc(plan.note)}</p>` : ""}
          ${plan.warnings.map((w) => `<div class="note note-warning" style="margin-top:10px">${icon("warning")}<div>${esc(w)}</div></div>`).join("")}
        </div>
      </div>

      <div class="milestones">
        ${plan.milestones.map((m, mi) => {
          const mins = m.tasks.reduce((n, t) => n + t.duration, 0);
          const open = mi === 0;
          return `
          <section class="ms">
            <div class="ms-head">
              <button class="ms-toggle" data-toggle-ms aria-expanded="${open}" aria-controls="ms-${mi}">
                <span class="ms-num serif">${String(mi + 1).padStart(2, "0")}</span>
                <span class="grow">
                  <span class="ms-title">${esc(m.title)}</span>
                  <span class="ms-meta mono">${m.tasks.length} ${m.tasks.length === 1 ? "task" : "tasks"} · ${U.fmtDur(mins)} · due ${U.fmtDate(m.due, "short")}</span>
                </span>
                <span class="ms-chev">${icon(open ? "chevron-down" : "chevron-right")}</span>
              </button>
            </div>
            <div class="ms-body" id="ms-${mi}" ${open ? "" : "hidden"}>
              ${m.tasks.map((t, ti) => `
                <div class="plan-task" data-task-row="${mi}-${ti}">
                  <span class="plan-task-mark" aria-hidden="true"></span>
                  <div class="grow">
                    ${editing ? `
                      <input class="input" data-edit-title="${mi}-${ti}" value="${esc(t.title)}" aria-label="Task title" style="height:28px;font-size:12.5px" />
                    ` : `<div class="plan-task-title">${esc(t.title)}</div>`}
                    <div class="row gap-2 wrap" style="margin-top:4px">
                      ${editing ? `
                        <input class="input" type="date" data-edit-date="${mi}-${ti}" value="${t.date}" aria-label="Date" style="height:24px;font-size:10.5px;width:124px;padding:0 5px" />
                        <input class="input" type="number" data-edit-dur="${mi}-${ti}" value="${t.duration}" min="5" step="5" aria-label="Minutes" style="height:24px;font-size:10.5px;width:64px;padding:0 5px" />
                      ` : `
                        <span class="tag tag-outline tag-mono">${U.fmtDate(t.date, "short")}</span>
                        <span class="mono" style="font-size:10px;color:var(--ink-3)">${U.fmtDur(t.duration)}</span>
                        ${t.depTitle ? `<span class="tag tag-outline" style="font-size:10px">${icon("link", "ico-sm")} after ${esc(t.depTitle.length > 26 ? t.depTitle.slice(0, 26) + "…" : t.depTitle)}</span>` : ""}
                      `}
                    </div>
                  </div>
                  ${!editing ? `<span class="mono" style="font-size:9.5px;color:var(--ink-4);align-self:start">${t.priority === 1 ? "P1" : t.priority === 3 ? "P3" : "P2"}</span>` : ""}
                </div>`).join("")}
            </div>
          </section>`;
        }).join("")}
      </div>`;
  }

  function wireEditors(main) {
    main.querySelectorAll("[data-edit-title]").forEach((inp) => {
      inp.addEventListener("input", () => {
        const [mi, ti] = inp.dataset.editTitle.split("-").map(Number);
        plan.milestones[mi].tasks[ti].title = inp.value;
      });
    });
    main.querySelectorAll("[data-edit-date]").forEach((inp) => {
      inp.addEventListener("change", () => {
        const [mi, ti] = inp.dataset.editDate.split("-").map(Number);
        plan.milestones[mi].tasks[ti].date = inp.value;
      });
    });
    main.querySelectorAll("[data-edit-dur]").forEach((inp) => {
      inp.addEventListener("change", () => {
        const [mi, ti] = inp.dataset.editDur.split("-").map(Number);
        plan.milestones[mi].tasks[ti].duration = Math.max(5, Number(inp.value) || 30);
      });
    });
  }

  function captureEdits(main) {
    // edits are written into `plan` on input, so there is nothing else to copy
  }

  async function draft(main, regenerate = false) {
    if (busy) return;
    const values = formValues(main);
    if (!values.title.trim()) {
      ui.toast("Give the goal a name first.", { kind: "danger" });
      const field = main.querySelector("#g-title");
      if (field) field.focus();
      return;
    }
    busy = true;
    draftError = "";
    const controller = new AbortController();
    request = controller;
    const account = POS.cloud.getStatus().user?.uid;
    owner = account;
    editing = false;
    plan = null;
    lastValues = values;
    render(main);
    try {
      const result = values.provider === "local" ? await POS.ai.breakdown(values) : await POS.goalAgent.breakdown(values, { signal: controller.signal });
      if (controller.signal.aborted || POS.cloud.getStatus().user?.uid !== account) return;
      plan = result;
      busy = false;
      render(main);
      if (regenerate) ui.toast("New draft ready. Review before approving.");
      else ui.toast("Draft ready. Nothing scheduled yet.");
    } catch (err) {
      if (controller.signal.aborted) return;
      busy = false;
      draftError = err.name === "TimeoutError" ? "The planner took too long. Retry or choose On-device templates." : err.message || "Could not draft the plan. Try again.";
      render(main);
      ui.toast(draftError, { kind: "danger" });
    } finally {
      if (request === controller) request = null;
    }
  }

  async function approve(main) {
    if (!plan) return;
    const reviewed = plan;
    const account = POS.cloud.getStatus().user?.uid;
    function validate() {
      if (!account || account !== owner || POS.cloud.getStatus().user?.uid !== account || plan !== reviewed) throw new Error("Your account or draft changed. Generate a new plan.");
      if (!plan.local) POS.planning.validate(plan.milestones.flatMap(m => m.tasks), { start: U.todayISO(), deadline: plan.targetDate, capacity: plan.capacity, days: plan.workingDays }, store.get().tasks);
    }
    try { validate(); }
    catch (err) { ui.toast(err.message, { kind: "danger" }); return; }
    if (editing) { captureEdits(main); }
    const totalTasks = plan.milestones.reduce((n, m) => n + m.tasks.length, 0);
    const ok = await ui.confirm({
      title: "Approve this plan?",
      body: `${totalTasks} tasks across ${plan.milestones.length} milestones will be created and placed on the days shown. You can move, edit or delete any of them afterwards.`,
      confirmLabel: "Create project & tasks",
    });
    if (!ok) return;
    try { validate(); }
    catch (err) { ui.toast(err.message, { kind: "danger" }); return; }

    const colours = ["cobalt", "teal", "plum", "ochre", "moss", "slate"];
    let targetProject = attachProjectId ? store.project(attachProjectId) : null;

    store.set((s) => {
      if (!targetProject) {
        targetProject = {
          id: U.uid("p"),
          name: plan.title,
          color: colours[s.projects.length % colours.length],
          status: "active",
          deadline: plan.targetDate,
          description: plan.description,
          createdAt: U.todayISO(),
          milestones: [],
        };
        s.projects.push(targetProject);
      }
      let order = 0;
      plan.milestones.forEach((m) => {
        const existing = targetProject.milestones.find((x) => x.title === m.title);
        const ms = existing || { id: U.uid("m"), title: m.title, due: m.due };
        if (!existing) targetProject.milestones.push(ms);
        m.tasks.forEach((t) => {
          s.tasks.push({
            id: U.uid("t"),
            title: t.title,
            projectId: targetProject.id,
            milestoneId: ms.id,
            date: t.date,
            start: null,
            duration: t.duration,
            priority: t.priority,
            order: order++,
            done: false,
            deps: t.depTitle ? [t.depTitle] : [],
            notes: "",
            rescheduled: 0,
            createdAt: U.todayISO(),
            completedAt: null,
          });
        });
      });
    }, "goal:approve");

    const id = targetProject.id;
    plan = null;
    attachProjectId = null;
    location.hash = "#/project/" + id;
    ui.toast(`${totalTasks} tasks added to ${targetProject.name}.`, {
      action: { label: "Open calendar", onClick: () => { location.hash = "#/calendar"; } },
    });
  }

  function handleExample(main) {
    main.querySelectorAll("[data-example]").forEach((b) => b.addEventListener("click", () => {
      main.querySelector("#g-title").value = b.dataset.example;
      main.querySelector("#g-title").focus();
    }));
  }

  const origRender = render;
  function renderWithExamples(main, params) {
    origRender(main, params);
    handleExample(main);
  }

  POS.views = POS.views || {};
  POS.cloud.subscribe(status => {
    if (status.user?.uid === owner) return;
    request?.abort(); request = null; busy = false; plan = null; editing = false;
    lastValues = null; attachProjectId = null; draftError = ""; owner = status.user?.uid || null;
  });
  POS.views.goal = { render: renderWithExamples };
})();
