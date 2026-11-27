/* Personal OS — shared UI: rows, overlays, capture, assistant, search. */
(function () {
  "use strict";
  const POS = window.POS;
  const U = POS.util;
  const { icon, escapeHTML: esc, fmtDate, relDate, fmtDur, fmtMin, todayISO, addDays } = U;
  const store = POS.store;

  /* =========================================================
     Small renderers
     ========================================================= */

  const projectTag = (projectId, opts = {}) => {
    const p = projectId ? store.project(projectId) : null;
    if (!p) return opts.empty ? '<span class="tag tag-outline">Personal</span>' : "";
    return `<span class="tag tone-${p.color}"><i class="pdot" aria-hidden="true"></i>${esc(p.name)}</span>`;
  };

  const meter = (pct, tone) => `
    <div class="meter ${tone ? "tone-" + tone : ""}" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
      <i style="--value:${Math.max(0, Math.min(100, pct))}%"></i>
    </div>`;

  const priorityLabel = (n) => (n === 1 ? "High" : n === 3 ? "Low" : "Normal");

  const dueLabel = (iso) => {
    if (!iso) return "";
    const diff = U.diffDays(iso, todayISO());
    if (diff < 0) return `<span class="danger">${Math.abs(diff)}d late</span>`;
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    return fmtDate(iso, "short");
  };

  function taskRow(t, opts = {}) {
    const done = !!t.done;
    const late = !done && t.date < todayISO();
    const project = t.projectId ? store.project(t.projectId) : null;
    const time = opts.showTime !== false
      ? t.start != null
        ? fmtMin(t.start)
        : opts.showDate
        ? dueLabel(t.date)
        : "—"
      : "";
    return `
      <div class="row-item task-row ${done ? "is-done" : ""} ${opts.className || ""}"
           ${opts.draggable ? 'draggable="true" data-drag-task="' + t.id + '"' : ""}
           data-task="${t.id}">
        ${opts.draggable ? `<span class="drag-grip" aria-hidden="true">${icon("gripv")}</span>` : ""}
        <label class="check ${done ? "is-done" : ""}">
          <input type="checkbox" ${done ? "checked" : ""} data-act="toggle-task" data-id="${t.id}"
                 aria-label="${done ? "Mark incomplete" : "Mark complete"}: ${esc(t.title)}" />
          <span class="check-label grow">
            <span class="row-title">${esc(t.title)}</span>
            <span class="row-meta">
              ${project ? projectTag(project.id) : '<span class="tag tag-outline">Personal</span>'}
              ${t.duration ? `<span class="mono">${fmtDur(t.duration)}</span>` : ""}
              ${opts.showDate && t.date ? `<span class="sep">·</span><span>${relDate(t.date)}</span>` : ""}
              ${late ? `<span class="sep">·</span><span class="danger">Missed</span>` : ""}
              ${t.priority === 1 && !done ? `<span class="sep">·</span><span class="tag tag-warning" style="height:17px">Priority</span>` : ""}
            </span>
          </span>
        </label>
        <div class="row-end">
          ${time ? `<span class="task-times mono">${time}</span>` : ""}
          <button class="icon-btn icon-btn-sm" data-act="open-task" data-id="${t.id}" aria-label="Open task: ${esc(t.title)}">
            ${icon("more")}
          </button>
        </div>
      </div>`;
  }

  const emptyState = (title, body, action) => `
    <div class="empty">
      ${icon("dot", "ico-lg")}
      <h3>${esc(title)}</h3>
      <p>${esc(body)}</p>
      ${action || ""}
    </div>`;

  const skeletonRows = (n = 3) =>
    `<div style="padding:16px 18px" class="stack gap-3">
      ${Array.from({ length: n }).map(() => `
        <div class="row gap-3">
          <div class="skeleton" style="width:17px;height:17px;border-radius:4px"></div>
          <div class="grow"><div class="skeleton sk-line w-60"></div><div class="skeleton sk-line w-40" style="height:7px"></div></div>
        </div>`).join("")}
    </div>`;

  /* =========================================================
     Overlay primitives
     ========================================================= */

  function lockScroll(lock) {
    document.body.style.overflow = lock ? "hidden" : "";
  }

  function toast(message, opts = {}) {
    const root = document.getElementById("toast-root");
    const node = document.createElement("div");
    node.className = "toast " + (opts.kind === "danger" ? "toast-danger" : "");
    node.innerHTML = `
      ${icon(opts.kind === "danger" ? "warning" : "check")}
      <span class="grow">${esc(message)}</span>
      ${opts.action ? `<button class="toast-action">${esc(opts.action.label)}</button>` : ""}
      <button class="toast-close" aria-label="Dismiss">${icon("close", "ico-sm")}</button>`;
    root.appendChild(node);
    const remove = () => node.remove();
    node.querySelector(".toast-close").addEventListener("click", remove);
    if (opts.action) {
      node.querySelector(".toast-action").addEventListener("click", () => {
        opts.action.onClick && opts.action.onClick();
        remove();
      });
    }
    setTimeout(remove, opts.duration || 4200);
    return remove;
  }

  function confirmDialog(opts) {
    return new Promise((resolve) => {
      const m = modal({
        title: opts.title || "Are you sure?",
        sub: opts.sub || "",
        body: `<p style="font-size:13px;color:var(--ink-2);max-width:44ch">${esc(opts.body || "")}</p>`,
        foot: `
          <button class="btn" data-close>Cancel</button>
          <button class="btn ${opts.danger ? "btn-danger" : "btn-primary"}" data-yes>${esc(opts.confirmLabel || "Confirm")}</button>`,
        onClose: () => resolve(false),
      });
      m.el.querySelector("[data-yes]").addEventListener("click", () => { resolve(true); m.close(true); });
    });
  }

  function modal(opts) {
    const root = document.getElementById("overlay-root");
    const wrap = document.createElement("div");
    wrap.className = "modal-wrap";
    wrap.innerHTML = `
      <div class="backdrop" data-close></div>
      <div class="modal ${opts.wide ? "modal-lg" : ""}" role="dialog" aria-modal="true" aria-labelledby="m-title">
        <div class="modal-head">
          <div>
            <h2 id="m-title">${esc(opts.title || "")}</h2>
            ${opts.sub ? `<p>${esc(opts.sub)}</p>` : ""}
          </div>
          <button class="icon-btn" data-close aria-label="Close">${icon("close")}</button>
        </div>
        <div class="modal-body">${opts.body || ""}</div>
        ${opts.foot ? `<div class="modal-foot">${opts.foot}</div>` : ""}
      </div>`;
    root.appendChild(wrap);
    lockScroll(true);
    const el = wrap.querySelector(".modal");
    const previously = document.activeElement;
    let closed = false;
    const onKey = (e) => {
      if (e.key === "Escape") close(false);
      if (e.key === "Tab") {
        const f = el.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    function close(fromAction) {
      if (closed) return;
      closed = true;
      wrap.remove();
      lockScroll(false);
      document.removeEventListener("keydown", onKey);
      if (previously && previously.focus) previously.focus();
      if (!fromAction && opts.onClose) opts.onClose();
    }
    wrap.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => close(false)));
    document.addEventListener("keydown", onKey);
    setTimeout(() => {
      const target = el.querySelector("[autofocus], input, textarea, select, button.btn-primary, button.btn-accent");
      if (target) target.focus();
    }, 30);
    if (opts.onMount) opts.onMount(el, close);
    return { el, close };
  }

  function sheet(opts) {
    const root = document.getElementById("overlay-root");
    const wrap = document.createElement("div");
    wrap.className = "sheet-wrap";
    wrap.innerHTML = `
      <div class="backdrop" data-close></div>
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="s-title" style="${opts.width ? "width:min(" + opts.width + "px,100%)" : ""}">
        <div class="sheet-head">
          <div>
            <h2 id="s-title">${esc(opts.title || "")}</h2>
            ${opts.sub ? `<div class="meta-line" style="margin-top:3px">${esc(opts.sub)}</div>` : ""}
          </div>
          <button class="icon-btn" data-close aria-label="Close">${icon("close")}</button>
        </div>
        <div class="sheet-body">${opts.body || ""}</div>
        ${opts.foot ? `<div class="sheet-foot">${opts.foot}</div>` : ""}
      </div>`;
    root.appendChild(wrap);
    lockScroll(true);
    const el = wrap.querySelector(".sheet");
    const previously = document.activeElement;
    let closed = false;
    const onKey = (e) => {
      if (e.key === "Escape" && root.lastElementChild === wrap) close();
      if (e.key !== "Tab" || root.lastElementChild !== wrap) return;
      const controls = Array.from(el.querySelectorAll("button, a[href], input, select, textarea, [tabindex='0']"))
        .filter((control) => !control.disabled && control.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    function close() {
      if (closed) return;
      closed = true;
      wrap.remove();
      lockScroll(false);
      document.removeEventListener("keydown", onKey);
      if (previously && previously.focus) previously.focus();
      if (opts.onClose) opts.onClose();
    }
    wrap.__posClose = close;
    wrap.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
    document.addEventListener("keydown", onKey);
    setTimeout(() => {
      const target = el.querySelector("[autofocus], input, textarea, select");
      if (target) target.focus();
    }, 40);
    if (opts.onMount) opts.onMount(el, close);
    return { el, close };
  }

  function menu(anchor, items) {
    closeMenus();
    const rect = anchor.getBoundingClientRect();
    const el = document.createElement("div");
    el.className = "menu";
    el.setAttribute("role", "menu");
    el.innerHTML = items.map((it, i) =>
      it === "-"
        ? "<hr />"
        : `<button role="menuitem" data-i="${i}" class="${it.danger ? "is-danger" : ""}">
             ${it.icon ? icon(it.icon) : ""}<span>${esc(it.label)}</span>
           </button>`
    ).join("");
    el.style.position = "fixed";
    el.style.top = rect.bottom + 6 + "px";
    el.style.left = Math.min(rect.left, window.innerWidth - 200) + "px";
    document.body.appendChild(el);
    el.querySelectorAll("button").forEach((b) => {
      b.addEventListener("click", () => {
        const item = items[Number(b.dataset.i)];
        closeMenus();
        item && item.onClick && item.onClick();
      });
    });
    const away = (e) => {
      if (!el.contains(e.target) && e.target !== anchor) closeMenus();
    };
    setTimeout(() => document.addEventListener("mousedown", away), 0);
    el._away = away;
    el._anchor = anchor;
    return el;
  }

  function closeMenus() {
    document.querySelectorAll(".menu").forEach((m) => {
      if (m._away) document.removeEventListener("mousedown", m._away);
      m.remove();
    });
  }

  /* delegated binding */
  const common = {
    "toggle-task": (el) => store.actions.toggleTask(el.dataset.id),
    "open-task": (el) => openTask(el.dataset.id),
    "goto": (el) => { location.hash = el.dataset.href; },
    "capture": () => openCapture(),
    "assistant": () => openAssistant(),
  };

  function bind(root, handlers = {}) {
    const bound = root.__posBind;
    if (bound) {
      bound.handlers = Object.assign({}, common, handlers);
      return () => {};
    }
    const state = { handlers: Object.assign({}, common, handlers) };
    const click = (e) => {
      const el = e.target.closest("[data-act]");
      if (!el || !root.contains(el)) return;
      const fn = state.handlers[el.dataset.act];
      if (fn) { e.preventDefault(); fn(el, e); }
    };
    const change = (e) => {
      const el = e.target.closest("[data-change]");
      if (!el || !root.contains(el)) return;
      const fn = state.handlers[el.dataset.change];
      if (fn) fn(el, e);
    };
    root.addEventListener("click", click);
    root.addEventListener("change", change);
    root.__posBind = state;
    return () => {
      root.removeEventListener("click", click);
      root.removeEventListener("change", change);
      delete root.__posBind;
    };
  }

  /* =========================================================
     Task sheet + quick add
     ========================================================= */

  function openTask(id) {
    const t = store.task(id);
    if (!t) return;
    const projects = store.get().projects.filter((p) => p.status !== "archived");
    const dep = (t.deps || []).map((d) => store.get().tasks.find((x) => x.title === d)).filter(Boolean);
    const s = sheet({
      title: "Task",
      sub: t.id.toUpperCase(),
      width: 480,
      body: `
        <div class="stack gap-5">
          <div class="field">
            <label class="label" for="t-title">Title</label>
            <textarea class="textarea" id="t-title" style="min-height:64px">${esc(t.title)}</textarea>
          </div>
          <div class="field-row">
            <div class="field">
              <label class="label" for="t-date">Day</label>
              <input class="input" type="date" id="t-date" value="${t.date}" />
            </div>
            <div class="field">
              <label class="label" for="t-start">Start</label>
              <input class="input" type="time" id="t-start" value="${t.start != null ? U.hhmmOf(t.start) : ""}" />
            </div>
            <div class="field" style="max-width:96px">
              <label class="label" for="t-dur">Minutes</label>
              <input class="input" type="number" id="t-dur" min="5" step="5" value="${t.duration}" />
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label class="label" for="t-project">Project</label>
              <select class="select" id="t-project">
                <option value="">Personal</option>
                ${projects.map((p) => `<option value="${p.id}" ${p.id === t.projectId ? "selected" : ""}>${esc(p.name)}</option>`).join("")}
              </select>
            </div>
            <div class="field" style="max-width:130px">
              <label class="label" for="t-pri">Priority</label>
              <select class="select" id="t-pri">
                ${[1, 2, 3].map((n) => `<option value="${n}" ${n === t.priority ? "selected" : ""}>${priorityLabel(n)}</option>`).join("")}
              </select>
            </div>
          </div>
          <div class="field">
            <label class="label" for="t-notes">Notes <span class="opt">optional</span></label>
            <textarea class="textarea" id="t-notes" placeholder="Anything worth remembering about this task">${esc(t.notes || "")}</textarea>
          </div>
          ${dep.length ? `<div class="note note-quiet">${icon("link")}<div><strong>Waits on</strong><br/>${dep.map((d) => esc(d.title)).join("<br/>")}</div></div>` : ""}
          ${projects.length ? "" : ""}
          <div class="spread">
            <label class="switch">
              <input type="checkbox" id="t-done" ${t.done ? "checked" : ""} />
              <span class="track"></span>
              <span>Completed</span>
            </label>
            <button class="btn btn-danger btn-sm" id="t-delete">${icon("trash")} Delete</button>
          </div>
        </div>`,
      foot: `
        <button class="btn" data-close>Cancel</button>
        <button class="btn btn-primary" id="t-save">Save task</button>`,
      onMount: (el, close) => {
        el.querySelector("#t-save").addEventListener("click", () => {
          const title = el.querySelector("#t-title").value.trim();
          if (!title) { toast("A task needs a title.", { kind: "danger" }); return; }
          const startVal = el.querySelector("#t-start").value;
          store.actions.updateTask(t.id, {
            title,
            date: el.querySelector("#t-date").value || t.date,
            start: startVal ? U.minutesOf(startVal) : null,
            duration: Math.max(5, Number(el.querySelector("#t-dur").value) || 30),
            projectId: el.querySelector("#t-project").value || null,
            priority: Number(el.querySelector("#t-pri").value),
            notes: el.querySelector("#t-notes").value.trim(),
            done: el.querySelector("#t-done").checked,
          });
          close();
          toast("Task updated.");
        });
        el.querySelector("#t-delete").addEventListener("click", async () => {
          close();
          const ok = await confirmDialog({
            title: "Delete this task?",
            body: `“${t.title}” will be removed. Completed work and focus history stay unaffected.`,
            confirmLabel: "Delete task",
            danger: true,
          });
          if (ok) { store.actions.deleteTask(t.id); toast("Task deleted."); }
        });
      },
    });
    return s;
  }

  function quickAddTask(date, opts = {}, onDone) {
    const projects = store.get().projects.filter((p) => p.status !== "archived");
    const baseDate = date || todayISO();
    const presetProject = opts.projectId ? store.project(opts.projectId) : null;
    const m = modal({
      title: "New task",
      sub: (presetProject ? presetProject.name + " · " : "") + "Added to " + relDate(baseDate),
      body: `
        <div class="stack gap-4">
          <div class="field">
            <label class="label" for="q-title">What needs doing?</label>
            <input class="input" id="q-title" placeholder="e.g. Outline case study two" autofocus />
          </div>
          <div class="field-row">
            <div class="field">
              <label class="label" for="q-project">Project</label>
              <select class="select" id="q-project">
                <option value="">Personal</option>
                ${projects.map((p) => `<option value="${p.id}" ${p.id === opts.projectId ? "selected" : ""}>${esc(p.name)}</option>`).join("")}
              </select>
            </div>
            <div class="field">
              <label class="label" for="q-pri">Priority</label>
              <select class="select" id="q-pri">
                ${[1, 2, 3].map((n) => `<option value="${n}" ${n === 2 ? "selected" : ""}>${priorityLabel(n)}</option>`).join("")}
              </select>
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label class="label" for="q-dur">Minutes</label>
              <input class="input" id="q-dur" type="number" value="30" min="5" step="5" />
            </div>
            <div class="field">
              <label class="label" for="q-date">Day</label>
              <input class="input" id="q-date" type="date" value="${baseDate}" />
            </div>
          </div>
        </div>`,
      foot: `<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="q-save">Add task</button>`,
      onMount: (el, close) => {
        const save = () => {
          const title = el.querySelector("#q-title").value.trim();
          if (!title) { toast("A task needs a title.", { kind: "danger" }); return; }
          const projectId = el.querySelector("#q-project").value || null;
          store.actions.addTask({
            title,
            projectId,
            milestoneId: projectId === opts.projectId ? opts.milestoneId || null : null,
            duration: Number(el.querySelector("#q-dur").value) || 30,
            date: el.querySelector("#q-date").value || baseDate,
            start: opts.start != null ? opts.start : null,
            priority: Number(el.querySelector("#q-pri").value) || 2,
          });
          close();
          toast("Task added.");
          if (onDone) onDone();
        };
        el.querySelector("#q-save").addEventListener("click", save);
        el.querySelector("#q-title").addEventListener("keydown", (e) => { if (e.key === "Enter") save(); });
      },
    });
    return m;
  }

  /* =========================================================
     Capture
     ========================================================= */

  function renderReview(target, result, onCommit) {
    const items = result.items;
    target.innerHTML = `
      <div class="stack gap-3" style="border-top:1px solid var(--line);padding-top:16px">
        <div class="spread">
          <div>
            <h3 style="font-size:12px;font-weight:600">Review before saving</h3>
            <p style="font-size:11.5px;color:var(--ink-3);margin-top:2px">${esc(result.summary)}</p>
          </div>
          <span class="tag tag-outline">${esc(result.provider || "On device")}</span>
        </div>
        ${result.question ? `<div class="note">${icon("sparkles")}<div>${esc(result.question)}</div></div>` : ""}
        <div class="panel" style="box-shadow:none">
          ${items.map((it, i) => `
            <div class="row-item" data-item="${i}" style="align-items:flex-start;padding:10px 12px">
              <input type="checkbox" ${it.selected ? "checked" : ""} data-sel="${i}" aria-label="Include ${esc(it.title)}"
                     style="margin-top:3px;accent-color:var(--ink)" />
              <div class="grow stack gap-1">
                <div class="row gap-2 wrap">
                  <span class="tag tag-mono ${it.type === "goal" ? "tag-accent" : it.type === "note" ? "tag-outline" : ""}" style="text-transform:uppercase">${it.type}</span>
                </div>
                <input class="input-inline" data-title="${i}" value="${esc(it.title)}" aria-label="Edit title" style="font-size:13.5px;width:100%" />
                <div class="row gap-2 wrap" style="font-size:11px;color:var(--ink-3)">
                  ${it.type !== "note" ? `<input class="input" type="date" value="${it.date || ""}" data-date="${i}" style="height:26px;font-size:11px;width:132px;padding:0 6px" aria-label="Date" />` : ""}
                  ${it.duration ? `<span class="mono">${fmtDur(it.duration)}</span>` : ""}
                  ${it.projectId ? projectTag(it.projectId) : ""}
                  ${it.note ? `<span style="color:var(--ink-4)">${esc(it.note)}</span>` : ""}
                </div>
              </div>
            </div>`).join("")}
        </div>
        <div class="row gap-2">
          <button class="btn btn-accent grow" data-draft-commit ${items.some((i) => i.selected) ? "" : "disabled"}>
            ${icon("check")} Add <span data-draft-count>${items.filter((i) => i.selected).length}</span> selected
          </button>
          <button class="btn" data-draft-discard>Discard draft</button>
        </div>
        <p style="font-size:10.5px;color:var(--ink-4);line-height:1.5">
          Goals are saved as project shells. Open Goal Breakdown to draft their milestones —
          nothing is scheduled automatically.
        </p>
      </div>`;

    const update = () => {
      const n = items.filter((item) => item.selected && item.title.trim()).length;
      const btn = target.querySelector("[data-draft-commit]");
      btn.disabled = n === 0;
      target.querySelector("[data-draft-count]").textContent = n;
    };
    target.querySelectorAll("[data-sel]").forEach((cb) => {
      cb.addEventListener("change", () => {
        items[Number(cb.dataset.sel)].selected = cb.checked;
        target.querySelector(`[data-item="${cb.dataset.sel}"]`).style.opacity = cb.checked ? "1" : "0.55";
        update();
      });
    });
    target.querySelectorAll("[data-title]").forEach((inp) => {
      inp.addEventListener("input", () => { items[Number(inp.dataset.title)].title = inp.value; update(); });
    });
    target.querySelectorAll("[data-date]").forEach((inp) => {
      inp.addEventListener("change", () => { items[Number(inp.dataset.date)].date = inp.value; });
    });
    target.querySelector("[data-draft-discard]").addEventListener("click", () => {
      target.innerHTML = '<p class="conversation-status" tabindex="-1">Draft discarded. Nothing was saved.</p>';
      target.firstElementChild.focus();
    });
    target.querySelector("[data-draft-commit]").addEventListener("click", () => {
      onCommit(items.filter((item) => item.selected && item.title.trim()));
    });
  }

  function commitItems(items) {
    let tasks = 0, notes = 0, goals = 0;
    items.forEach((it) => {
      if (it.type === "task" || it.type === "deadline" || it.type === "reminder") {
        store.actions.addTask({
          title: it.title,
          projectId: it.projectId,
          date: it.date || todayISO(),
          duration: it.duration || 30,
          priority: it.type === "deadline" ? 1 : 2,
        });
        tasks++;
      } else if (it.type === "note") {
        store.actions.addNote({ title: it.title, body: it.raw || "", tags: ["capture"] });
        notes++;
      } else if (it.type === "goal") {
        const exists = store.get().projects.find(
          (p) => p.name.toLowerCase() === it.title.toLowerCase()
        );
        if (!exists) {
          const colours = ["cobalt", "teal", "plum", "ochre", "moss"];
          store.actions.addProject({
            name: it.title.replace(/^(complete|finish|learn|apply for|launch)\s+/i, "").replace(/^./, (c) => c.toUpperCase()),
            description: it.raw || "",
            deadline: it.date || addDays(todayISO(), 30),
            color: colours[store.get().projects.length % colours.length],
          });
        }
        goals++;
      }
    });
    const bits = [];
    if (tasks) bits.push(`${tasks} task${tasks > 1 ? "s" : ""}`);
    if (notes) bits.push(`${notes} note${notes > 1 ? "s" : ""}`);
    if (goals) bits.push(`${goals} project${goals > 1 ? "s" : ""}`);
    toast(bits.length ? `Saved: ${bits.join(", ")}.` : "Nothing selected.");
    if (goals) {
      toast("Goal saved. Draft its plan in Goal Breakdown.", {
        action: { label: "Open", onClick: () => { location.hash = "#/goal"; } },
      });
    }
  }

  function openCapture(prefill = "", { start = false } = {}) {
    return openConversation({ capture: true, prefill, start: start ? prefill : "" });
  }

  function openAssistant(seedQuestion) {
    return openConversation({ start: seedQuestion });
  }

  function openConversation({ capture = false, prefill = "", start = "" } = {}) {
    let stopVoice = () => {};
    let stopSpeech = () => {};
    let closeCloud = () => {};
    return sheet({
      title: capture ? "Capture" : "Conversation",
      sub: "On-device assistant",
      width: 536,
      body: `
        <div class="conversation-access">
          <div class="conversation-mode">
            <button type="button" class="btn btn-quiet" data-cloud-mode aria-expanded="false" aria-controls="conversation-consent">Use DeepSeek</button>
            <button type="button" class="btn btn-ghost" data-cloud-stop hidden>Stop reply</button>
          </div>
          <div class="conversation-consent" id="conversation-consent" hidden>
            <p>DeepSeek receives messages you send and voice clips you finish recording. Earlier local messages and your workspace aren’t shared automatically. Personal OS doesn’t save audio.</p>
            <button type="button" class="btn btn-accent" data-cloud-enable>Turn on DeepSeek</button>
          </div>
          <label class="check conversation-share" hidden>
            <input type="checkbox" data-cloud-share />
            <span>Share matching workspace items <small>Titles and schedule details only. No note contents.</small></span>
          </label>
        </div>
        <div class="conversation-thread">
          <div class="conversation-intro">
            <h3>${capture ? "What’s on your mind?" : "What would you like to work through?"}</h3>
            <p>${capture ? "Write a thought or ask a question. Send it to start a conversation." : "Ask about your tasks, notes, projects or plans. No changes are saved without your say."}</p>
            <div class="row gap-2 wrap">
              ${["Plan my day", "What’s behind?", "What should I focus on?"].map((q) =>
                `<button class="btn btn-quiet" data-question="${esc(q)}">${esc(q)}</button>`).join("")}
            </div>
          </div>
          <div class="conversation-log" role="log" aria-label="Conversation messages"></div>
        </div>
        <form class="conversation-compose">
          <label class="sr-only" for="conversation-input">Message</label>
          <textarea class="textarea" id="conversation-input" placeholder="Write or speak a thought" rows="2" maxlength="10000" enterkeyhint="send" autofocus></textarea>
          <input type="file" accept=".txt,.md,.csv,.json,text/plain,text/markdown,text/csv,application/json" data-text-file hidden />
          <div class="conversation-controls">
            <button type="button" class="icon-btn" data-voice aria-label="Dictate on this device" aria-pressed="false" title="Dictate on this device">${icon("mic")}</button>
            <button type="button" class="icon-btn" data-attach aria-label="Insert text from a file" title="Insert text from a file">${icon("paperclip")}</button>
            <button type="button" class="btn btn-ghost conversation-read" aria-pressed="false">Read replies</button>
            <button class="btn btn-accent conversation-send" type="submit">${icon("arrow-right")} Send</button>
          </div>
          <p class="conversation-status" role="status"></p>
        </form>`,
      onClose: () => { stopVoice(); stopSpeech(); closeCloud(); },
      onMount: (el, close) => {
        el.classList.add("conversation-sheet");
        const thread = el.querySelector(".conversation-thread");
        const log = el.querySelector(".conversation-log");
        const intro = el.querySelector(".conversation-intro");
        const form = el.querySelector("form");
        const input = form.querySelector("textarea");
        const send = form.querySelector(".conversation-send");
        const status = form.querySelector(".conversation-status");
        const read = form.querySelector(".conversation-read");
        const mic = form.querySelector("[data-voice]");
        const file = form.querySelector("[data-text-file]");
        const cloud = POS.deepseek;
        const mode = el.querySelector("[data-cloud-mode]");
        const consent = el.querySelector("#conversation-consent");
        const enable = consent.querySelector("button");
        const share = el.querySelector("[data-cloud-share]");
        const cloudStop = el.querySelector("[data-cloud-stop]");
        let processing = false;
        let first = true;
        let recognition = null;
        let checkingVoice = false;
        let readReplies = false;
        let activeUtterance = null;
        let topic = null;
        let cloudMode = false;
        let cloudTurns = [];
        const cloudDrafts = new Set();
        let cloudRequest = null;
        let voiceRequest = null;
        let recording = null;
        let recordTimer;
        let output = null;
        input.value = prefill;

        const scroll = () => { thread.scrollTop = thread.scrollHeight; };
        const sync = () => {
          send.disabled = processing || Boolean(voiceRequest) || !input.value.trim();
          cloudStop.hidden = !cloudMode || !cloudRequest;
        };
        const append = (html) => {
          const row = document.createElement("div");
          row.innerHTML = html;
          const item = row.firstElementChild;
          log.appendChild(item);
          scroll();
          return item;
        };
        const listening = (on) => {
          mic.setAttribute("aria-pressed", String(on));
          mic.setAttribute("aria-label", cloudMode ? on ? "Send voice turn" : "Start voice turn" : on ? "Stop dictation" : "Dictate on this device");
          mic.title = mic.getAttribute("aria-label");
        };
        stopVoice = () => {
          if (!recognition) return;
          const rec = recognition;
          recognition = null;
          rec.onresult = rec.onend = rec.onerror = null;
          rec.abort();
          listening(false);
          status.textContent = "";
        };
        const synth = window.speechSynthesis;
        const findVoice = () => {
          const voices = synth?.getVoices().filter((voice) => voice.localService) || [];
          const language = (navigator.language || "en").split("-")[0];
          return voices.find((voice) => voice.lang.startsWith(language)) || voices[0];
        };
        stopSpeech = () => {
          if (activeUtterance) synth.cancel();
          activeUtterance = null;
        };
        const stopRecording = () => {
          clearTimeout(recordTimer);
          voiceRequest?.abort();
          voiceRequest = null;
          recording?.close();
          recording = null;
          listening(false);
        };
        closeCloud = () => {
          cloudRequest?.abort();
          cloudDrafts.forEach((request) => request.abort());
          stopRecording();
          output?.close();
          output = null;
        };
        const changeMode = (online) => {
          stopVoice();
          stopSpeech();
          closeCloud();
          cloudMode = online;
          cloudTurns = [];
          share.checked = false;
          share.parentElement.hidden = !online;
          consent.hidden = true;
          if (online) mode.removeAttribute("aria-expanded");
          else mode.setAttribute("aria-expanded", "false");
          mode.textContent = online ? "Switch to on-device" : "Use DeepSeek";
          el.querySelector(".sheet-head .meta-line").textContent = online ? "DeepSeek conversation" : "On-device assistant";
          readReplies = false;
          read.setAttribute("aria-pressed", "false");
          listening(false);
          sync();
        };
        mode.addEventListener("click", () => {
          if (cloudMode) return changeMode(false);
          consent.hidden = !consent.hidden;
          mode.setAttribute("aria-expanded", String(!consent.hidden));
        });
        enable.addEventListener("click", async () => {
          if (enable.disabled) return;
          enable.disabled = true;
          status.textContent = "Checking the server…";
          const available = await cloud.status();
          enable.disabled = false;
          if (!el.isConnected || consent.hidden) { status.textContent = ""; return; }
          if (!available) {
            status.textContent = "DeepSeek isn’t configured here. Start the Personal OS server with a DeepSeek key or keep using on-device mode.";
            return;
          }
          changeMode(true);
          status.textContent = "DeepSeek is on for this conversation.";
          input.focus();
        });
        share.addEventListener("change", () => {
          if (!share.checked) {
            cloudTurns = [];
            cloudRequest?.abort();
            output?.stop();
            status.textContent = "Workspace sharing is off. DeepSeek will start with fresh context.";
          } else {
            status.textContent = "Matching workspace titles and schedule details may be sent with your next message.";
          }
        });
        cloudStop.addEventListener("click", () => {
          cloudRequest?.abort();
          output?.stop();
        });
        const warmOutput = () => {
          try {
            output ||= cloud.player(() => {
              if (el.isConnected) status.textContent = "Couldn’t play the DeepSeek voice. The text reply is still available.";
            });
            output.resume().catch(() => {
              if (el.isConnected) status.textContent = "Audio playback was blocked. You can still read the reply.";
            });
            return true;
          } catch (err) {
            status.textContent = err.message;
            return false;
          }
        };
        const speak = (reply) => {
          const voice = readReplies && findVoice();
          if (cloudMode || !voice || recognition || !el.isConnected) return;
          stopSpeech();
          const spoken = new SpeechSynthesisUtterance(reply);
          activeUtterance = spoken;
          spoken.voice = voice;
          spoken.onend = spoken.onerror = () => {
            if (activeUtterance === spoken) activeUtterance = null;
          };
          synth.speak(spoken);
        };
        read.addEventListener("click", () => {
          if (cloudMode) {
            if (!readReplies && !warmOutput()) return;
            readReplies = !readReplies;
            read.setAttribute("aria-pressed", String(readReplies));
            if (!readReplies) output?.stop();
            status.textContent = readReplies ? "DeepSeek replies will play aloud." : "Spoken replies are off.";
            return;
          }
          if (!readReplies && (!window.SpeechSynthesisUtterance || !findVoice())) {
            status.textContent = "No on-device voice is available. Replies will stay in text.";
            return;
          }
          readReplies = !readReplies;
          read.setAttribute("aria-pressed", String(readReplies));
          if (!readReplies) stopSpeech();
          status.textContent = readReplies ? "Replies will be read aloud on this device." : "Read aloud is off.";
        });
        const finishRecording = async () => {
          if (!recording || !voiceRequest) return;
          clearTimeout(recordTimer);
          const req = voiceRequest;
          const wav = recording.finish();
          recording = null;
          listening(false);
          if (wav.size < 5000) {
            voiceRequest = null;
            status.textContent = "That clip was too short. Try another voice turn.";
            sync();
            return;
          }
          status.textContent = "Transcribing your voice…";
          try {
            const transcript = await cloud.transcribe(wav, req.signal);
            if (req.signal.aborted || !el.isConnected) return;
            voiceRequest = null;
            if (!transcript) {
              status.textContent = "No speech was detected. Try again or type a message.";
              return;
            }
            if (input.value.trim() || processing) {
              const message = [input.value, transcript].filter(Boolean).join("\n");
              input.value = message.slice(0, input.maxLength);
              status.textContent = "Transcript added to your message. Review it before sending.";
              input.focus();
            } else {
              await ask(transcript, true);
            }
          } catch (err) {
            if (!req.signal.aborted) status.textContent = err.message || "Couldn’t transcribe that clip. You can still type.";
          } finally {
            if (voiceRequest === req) voiceRequest = null;
            sync();
          }
        };
        const cloudMic = async () => {
          if (recording) return finishRecording();
          if (voiceRequest) {
            stopRecording();
            status.textContent = "Voice turn cancelled.";
            sync();
            return;
          }
          cloudRequest?.abort();
          output?.stop();
          if (!output && warmOutput()) {
            readReplies = true;
            read.setAttribute("aria-pressed", "true");
          } else if (readReplies) warmOutput();
          const req = new AbortController();
          voiceRequest = req;
          status.textContent = "Opening the microphone…";
          sync();
          try {
            const active = await cloud.record(req.signal);
            if (req.signal.aborted || !el.isConnected) { active.close(); return; }
            recording = active;
            listening(true);
            status.textContent = "Recording. Tap the microphone again to send this turn to DeepSeek.";
            recordTimer = setTimeout(() => {
              stopRecording();
              status.textContent = "The 45-second limit was reached. Nothing was sent. Try a shorter turn.";
              sync();
            }, 45000);
          } catch (err) {
            if (voiceRequest === req) voiceRequest = null;
            if (!req.signal.aborted) status.textContent = err.message || "Couldn’t start the microphone.";
            sync();
          }
        };
        mic.addEventListener("click", async () => {
          if (cloudMode) return cloudMic();
          if (recognition) { recognition.stop(); return; }
          if (checkingVoice) return;
          const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
          if (!Speech?.available || !("processLocally" in Speech.prototype)) {
            status.textContent = "This browser doesn’t support on-device dictation. You can still type.";
            return;
          }
          const lang = navigator.language || "en-US";
          checkingVoice = true;
          let reportedError = false;
          try {
            if (await Speech.available({ langs: [lang], processLocally: true }) !== "available") {
              status.textContent = "On-device dictation needs an installed speech language pack. You can still type.";
              return;
            }
            if (!el.isConnected) return;
            stopSpeech();
            const rec = new Speech();
            rec.processLocally = true;
            rec.lang = lang;
            rec.interimResults = true;
            const prefix = input.value.trimEnd();
            rec.onresult = (event) => {
              const transcript = Array.from(event.results, (result) => result[0].transcript).join(" ");
              input.value = [prefix, transcript].filter(Boolean).join(" ").slice(0, input.maxLength);
              sync();
            };
            rec.onerror = () => {
              reportedError = true;
              status.textContent = "Dictation stopped. Check microphone permission or type your message.";
            };
            rec.onend = () => {
              recognition = null;
              listening(false);
              if (!reportedError) status.textContent = "Review what you said, then send it.";
            };
            recognition = rec;
            rec.start();
            listening(true);
            status.textContent = "Listening on this device. Press the microphone again to stop.";
          } catch {
            recognition = null;
            listening(false);
            status.textContent = "Couldn’t start on-device dictation. You can still type.";
          } finally {
            checkingVoice = false;
          }
        });
        form.querySelector("[data-attach]").addEventListener("click", () => file.click());
        file.addEventListener("change", async () => {
          const chosen = file.files[0];
          file.value = "";
          if (!chosen) return;
          const original = input.value;
          try {
            if (!/\.(txt|md|csv|json)$/i.test(chosen.name) || chosen.size > 40000) {
              status.textContent = "Choose a text file that fits in a single message.";
              return;
            }
            const text = (await chosen.text()).trim();
            if (!el.isConnected) return;
            const message = [input.value, text].filter(Boolean).join("\n\n");
            if (!text || message.length > input.maxLength || input.value !== original) {
              status.textContent = "Text wasn’t inserted. Check that it fits and try again.";
              return;
            }
            input.value = message;
            status.textContent = "Text added to your message. It hasn’t been sent.";
            sync();
            input.focus();
          } catch {
            status.textContent = "Couldn’t read that file.";
          }
        });

        const makeDraft = async (message, slot, remote = false) => {
          if (slot.dataset.busy) return;
          slot.dataset.busy = "1";
          slot.innerHTML = '<p class="conversation-status">Drafting tasks and notes…</p>';
          const request = remote ? new AbortController() : null;
          if (request) cloudDrafts.add(request);
          try {
            const result = remote ? await cloud.draft(message, request.signal) : await POS.ai.parseCapture(message);
            if (!el.isConnected) return;
            if (!result.items.length) {
              slot.querySelector("p").textContent = result.summary;
              return;
            }
            renderReview(slot, result, (picked) => {
              commitItems(picked);
              slot.innerHTML = '<p class="conversation-status" tabindex="-1">Items saved. You can keep talking.</p>';
              slot.firstElementChild.focus();
            });
            if (!remote) speak(result.question || result.summary);
          } catch {
            if (!el.isConnected) return;
            slot.querySelector("p").textContent = request?.signal.aborted
              ? "Draft cancelled. Nothing was saved."
              : "Couldn’t make a draft. Nothing was saved.";
            const retry = document.createElement("button");
            retry.type = "button";
            retry.className = "btn btn-quiet";
            retry.textContent = "Draft on this device";
            retry.addEventListener("click", () => makeDraft(message, slot), { once: true });
            slot.appendChild(retry);
          } finally {
            delete slot.dataset.busy;
            if (request) cloudDrafts.delete(request);
          }
        };
        const offerDraft = (message, turn, answer, online) => {
          const draft = document.createElement("button");
          draft.type = "button";
          draft.className = "btn btn-ghost conversation-draft-action";
          draft.textContent = "Draft tasks or notes";
          draft.addEventListener("click", () => {
            const slot = document.createElement("div");
            slot.className = "conversation-draft";
            answer.after(slot);
            slot.tabIndex = -1;
            makeDraft(message, slot, online && cloudMode);
            draft.remove();
            slot.focus();
          });
          turn.appendChild(draft);
        };
        const sayWhileStreaming = () => {
          let leftover = "";
          return (delta = "", done = false) => {
            if (!readReplies || !output) { leftover = ""; return; }
            leftover += delta;
            while (leftover) {
              const pause = leftover.search(/[.!?。！？，；]\s+|[。！？\n]/);
              const breakAt = pause >= 24 ? pause + 1 : -1;
              const word = leftover.lastIndexOf(" ", 170);
              const length = breakAt > 0 && breakAt <= 200 ? breakAt
                : leftover.length >= 200 ? word > 40 ? word : 170
                : done ? leftover.length : 0;
              if (!length) break;
              output.speak(leftover.slice(0, length).trim());
              leftover = leftover.slice(length).trimStart();
            }
          };
        };
        const cloudAsk = async (message, answer) => {
          const request = new AbortController();
          cloudRequest = request;
          sync();
          const reply = answer.querySelector(".conversation-stream");
          const queueAudio = sayWhileStreaming();
          try {
            const context = share.checked ? cloud.workspace(message) : undefined;
            const turns = cloud.history(cloudTurns, message);
            const response = await cloud.chat(turns, {
              signal: request.signal, context, voice: readReplies,
              onText: (delta, full) => {
                const nearBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 70;
                reply.textContent = full;
                queueAudio(delta);
                if (nearBottom) scroll();
              },
            });
            request.signal.throwIfAborted();
            queueAudio("", true);
            cloudTurns = [...turns, { role: "assistant", content: response.slice(0, 10000) }].slice(-14);
          } catch (err) {
            if (!el.isConnected) return;
            if (reply.textContent === "Waiting for DeepSeek…") reply.textContent = "";
            answer.querySelector(".conversation-stream-status").textContent = request.signal.aborted
              ? "Reply stopped."
              : err.message || "Couldn’t get a DeepSeek reply.";
            if (!request.signal.aborted && !input.value.trim()) input.value = message;
          } finally {
            if (cloudRequest === request) cloudRequest = null;
          }
        };
        const ask = async (message, forceQuestion = false) => {
          if (!message.trim() || processing || voiceRequest) return;
          const online = cloudMode;
          const draftFirst = first && capture && !online && !forceQuestion &&
            !/\?\s*$|^(what|who|why|when|where|how|can you|should i|tell me|plan my|summari[sz]e)\b/i.test(message);
          first = false;
          processing = true;
          intro.hidden = true;
          el.querySelector("#s-title").textContent = "Conversation";
          input.placeholder = "Ask a follow-up or add a thought";
          stopVoice();
          stopSpeech();
          output?.stop();
          status.textContent = "";
          input.value = "";
          sync();
          input.focus();
          const turn = append(`<div class="conversation-user"><p class="sr-only">You</p><p>${esc(message)}</p></div>`);
          if (online) {
            const answer = append(`<div class="conversation-answer">
              <h3>DeepSeek</h3>
              <p class="conversation-stream">Waiting for DeepSeek…</p>
              <p class="conversation-stream-status conversation-status"></p>
            </div>`);
            await cloudAsk(message, answer);
            if (!el.isConnected) return;
            offerDraft(message, turn, answer, true);
          } else if (draftFirst) {
            topic = "draft";
            await makeDraft(message, append('<div class="conversation-draft"></div>'));
          } else {
            const answer = append('<div class="conversation-answer"><p class="conversation-status">Reading your question…</p></div>');
            try {
              const reply = await POS.ai.assistantReply(message, { topic });
              if (!el.isConnected) return;
              topic = reply.topic || topic;
              answer.innerHTML = `<h3>${esc(reply.title)}</h3><p>${esc(reply.text)}</p>
                ${reply.bullets?.length ? `<ul>${reply.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : ""}
                ${reply.actions?.length ? `<div class="row wrap gap-2">${reply.actions.map((a) =>
                  `<a class="btn btn-quiet" href="${esc(a.href)}">${esc(a.label)} ${icon("arrow-right")}</a>`).join("")}</div>` : ""}`;
              answer.querySelectorAll("a").forEach((a) => a.addEventListener("click", close));
              offerDraft(message, turn, answer, false);
              speak(`${reply.title}. ${reply.text} ${(reply.bullets || []).join(". ")}`);
            } catch {
              answer.textContent = "Couldn’t answer that. Try again. Nothing was saved.";
            }
          }
          processing = false;
          sync();
          if (thread.scrollHeight - thread.scrollTop - thread.clientHeight > 50) {
            const latest = log.lastElementChild;
            latest?.scrollIntoView({ block: "start", behavior: "instant" });
          }
        };
        form.addEventListener("submit", (e) => { e.preventDefault(); ask(input.value.trim()); });
        input.addEventListener("input", sync);
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
            e.preventDefault();
            form.requestSubmit();
          }
        });
        intro.querySelectorAll("[data-question]").forEach((b) => b.addEventListener("click", () => ask(b.dataset.question, true)));
        if (start) ask(start.trim(), !capture);
        else sync();
      },
    });
  }

  /* =========================================================
     Search palette
     ========================================================= */

  function openSearch(initial = "") {
    closeMenus();
    const root = document.getElementById("overlay-root");
    const wrap = document.createElement("div");
    wrap.className = "palette-wrap";
    wrap.innerHTML = `
      <div class="palette" role="dialog" aria-modal="true" aria-label="Search">
        <div class="palette-input">
          ${icon("search")}
          <input id="p-input" placeholder="Search tasks, projects, notes…" aria-label="Search everything" value="${esc(initial)}" />
          <kbd class="kbd">Esc</kbd>
        </div>
        <div class="palette-results" id="p-results"></div>
        <div class="palette-foot">
          <span>${icon("arrow-right", "ico-sm")} open</span>
          <span><kbd class="kbd">↑↓</kbd> move</span>
          <span><kbd class="kbd">↵</kbd> select</span>
          <span style="margin-left:auto">Local data only</span>
        </div>
      </div>`;
    root.appendChild(wrap);
    lockScroll(true);
    const input = wrap.querySelector("#p-input");
    const results = wrap.querySelector("#p-results");
    const previously = document.activeElement;
    let active = 0;
    let flat = [];

    const close = () => {
      wrap.remove();
      lockScroll(false);
      document.removeEventListener("keydown", onKey);
      if (previously && previously.focus) previously.focus();
    };
    const render = () => {
      const q = input.value.trim();
      const found = store.searchAll(q);
      const items = [];
      if (q) {
        found.tasks.forEach((t) => items.push({
          group: "Tasks", icon: "tasks", label: t.title, sub: t.date ? relDate(t.date) : "",
          go: () => openTask(t.id),
        }));
        found.projects.forEach((p) => items.push({
          group: "Projects", icon: "folder", label: p.name, sub: store.projectProgress(p.id).pct + "%",
          go: () => { location.hash = "#/project/" + p.id; },
        }));
        found.notes.forEach((n) => items.push({
          group: "Notes", icon: "notes", label: n.title, sub: (n.tags || [])[0] || "",
          go: () => { location.hash = "#/notes?note=" + n.id; },
        }));
      }
      items.push({ group: "Actions", icon: "plus", label: "Capture something", sub: "Ctrl K", go: () => openCapture() });
      items.push({ group: "Actions", icon: "sparkles", label: "Ask the assistant", go: () => openAssistant() });
      if (!q) {
        items.unshift({ group: "Jump to", icon: "today", label: "Today", go: () => { location.hash = "#/today"; } });
        items.unshift({ group: "Jump to", icon: "calendar", label: "Calendar", go: () => { location.hash = "#/calendar"; } });
        items.unshift({ group: "Jump to", icon: "folder", label: "Projects", go: () => { location.hash = "#/projects"; } });
      }
      flat = items;
      active = Math.min(active, flat.length - 1);
      let html = "";
      let group = null;
      items.forEach((it, i) => {
        if (it.group !== group) { group = it.group; html += `<div class="palette-group-label">${esc(group)}</div>`; }
        html += `<button class="palette-item ${i === active ? "is-active" : ""}" data-i="${i}">
          ${icon(it.icon)}<span class="truncate">${esc(it.label)}</span>${it.sub ? `<span class="sub">${esc(it.sub)}</span>` : ""}
        </button>`;
      });
      results.innerHTML = html || `<div class="empty" style="padding:26px"><p>No matches for “${esc(q)}”.</p></div>`;
      results.querySelectorAll("[data-i]").forEach((b) => {
        b.addEventListener("mouseenter", () => { active = Number(b.dataset.i); render(); });
        b.addEventListener("click", () => { close(); flat[Number(b.dataset.i)].go(); });
      });
    };
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); close(); }
      if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(active + 1, flat.length - 1); render(); }
      if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(active - 1, 0); render(); }
      if (e.key === "Enter") {
        e.preventDefault();
        const item = flat[active];
        if (item) { close(); item.go(); }
      }
    };
    input.addEventListener("input", () => { active = 0; render(); });
    document.addEventListener("keydown", onKey);
    wrap.addEventListener("mousedown", (e) => { if (e.target === wrap) close(); });
    render();
    setTimeout(() => input.focus(), 20);
    return { close };
  }

  /* =========================================================
     Notifications popover
     ========================================================= */

  const NOTIF_ICON = {
    reminder: "clock", overdue: "warning", deadline: "flag", habit: "habits", reschedule: "rotate",
  };

  function notificationTime(ts) {
    const diff = Math.round((Date.now() - ts) / 60000);
    if (diff < 1) return "now";
    if (diff < 60) return diff + "m";
    if (diff < 1440) return Math.round(diff / 60) + "h";
    return Math.round(diff / 1440) + "d";
  }

  function openNotificationsPopover(anchor) {
    closeMenus();
    document.querySelectorAll(".popover").forEach((p) => p.remove());
    const wrap = document.createElement("div");
    wrap.className = "popover";
    const all = store.get().notifications.slice(0, 5);
    wrap.innerHTML = `
      <div class="popover-head">
        <span>Notifications</span>
        <button class="btn btn-ghost btn-sm" id="n-read">Mark all read</button>
      </div>
      <div class="popover-list">
        ${all.length ? all.map((n) => `
          <div class="row-item" style="align-items:flex-start;padding:11px 14px">
            <span style="color:var(--${n.read ? "ink-4" : "accent"});margin-top:1px">${icon(NOTIF_ICON[n.type] || "bell")}</span>
            <div class="grow">
              <div class="row-title" style="white-space:normal;font-size:12.5px">${esc(n.title)}</div>
              <div class="row-meta"><span>${esc(n.body)}</span><span class="sep">·</span><span class="mono">${notificationTime(n.createdAt)}</span></div>
            </div>
            ${!n.read ? '<span class="pdot pdot-round" style="--tone:var(--accent);margin-top:6px"></span>' : ""}
          </div>`).join("") : `<div class="empty" style="padding:28px"><p>Nothing needs you right now.</p></div>`}
      </div>
      <div class="popover-foot">
        <a class="row-item" href="#/notifications" style="justify-content:center;font-size:12px;font-weight:500;padding:11px">View all notifications ${icon("arrow-right", "ico-sm")}</a>
      </div>`;
    anchor.parentElement.style.position = "relative";
    anchor.parentElement.appendChild(wrap);
    const close = (e) => {
      if (!wrap.contains(e.target) && !anchor.contains(e.target)) {
        wrap.remove();
        document.removeEventListener("mousedown", close);
      }
    };
    setTimeout(() => document.addEventListener("mousedown", close), 0);
    wrap.querySelector("#n-read").addEventListener("click", () => {
      store.actions.markNotifications(true);
      toast("All notifications marked read.");
      wrap.remove();
    });
    wrap.querySelectorAll("a[href]").forEach((a) => a.addEventListener("click", () => wrap.remove()));
  }

  /* =========================================================
     Export
     ========================================================= */

  POS.ui = {
    projectTag, meter, taskRow, emptyState, skeletonRows, priorityLabel, dueLabel,
    toast, confirm: confirmDialog, modal, sheet, menu, closeMenus,
    bind, common,
    openTask, quickAddTask, openCapture, commitItems, openAssistant, openSearch,
    openNotificationsPopover, notificationTime, NOTIF_ICON,
    lockScroll,
  };
})();
