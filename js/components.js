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
    wrap._close = close;
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
    const onKey = (e) => { if (e.key === "Escape") close(); };
    function close() {
      if (closed) return;
      closed = true;
      wrap.remove();
      lockScroll(false);
      document.removeEventListener("keydown", onKey);
      if (previously && previously.focus) previously.focus();
      if (opts.onClose) opts.onClose();
    }
    wrap._close = close;
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

  function captureBody() {
    return `
      <div class="stack gap-4">
        <div class="field">
          <label class="sr-only" for="c-text">What's on your mind?</label>
          <textarea id="c-text" class="textarea" style="min-height:132px;border:0;background:transparent;padding:0;font-size:15px;line-height:1.6"
            placeholder="What's on your mind?" autofocus></textarea>
        </div>
        <div class="spread" style="border-top:1px solid var(--line-soft);padding-top:12px">
          <div class="row gap-1">
            <button class="icon-btn" id="c-mic" aria-label="Voice input" title="Voice input">${icon("mic")}</button>
            <button class="icon-btn" id="c-file" aria-label="Attach a file" title="Attach a file">${icon("paperclip")}</button>
            <input type="file" id="c-file-input" multiple hidden />
            <span class="mono" id="c-count" style="font-size:10.5px;color:var(--ink-4);margin-left:6px">0 words</span>
          </div>
          <span class="mono" style="font-size:10px;color:var(--ink-4)">Ctrl ↵ to process</span>
        </div>
        <div id="c-files" class="stack gap-1"></div>
        <div id="c-review"></div>
      </div>`;
  }

  function renderReview(root, result, onCommit) {
    const target = root.querySelector("#c-review");
    const items = result.items;
    target.innerHTML = `
      <div class="stack gap-3" style="border-top:1px solid var(--line);padding-top:16px">
        <div class="spread">
          <div>
            <h3 style="font-size:12px;font-weight:600">Review before saving</h3>
            <p style="font-size:11.5px;color:var(--ink-3);margin-top:2px">${esc(result.summary)}</p>
          </div>
          <span class="tag tag-accent tag-mono">LOCAL AI</span>
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
                  <span class="mono" style="font-size:10px;color:var(--ink-4)">${Math.round(it.confidence * 100)}% sure</span>
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
          <button class="btn btn-accent grow" id="c-commit" ${items.some((i) => i.selected) ? "" : "disabled"}>
            ${icon("check")} Add <span id="c-count-sel">${items.filter((i) => i.selected).length}</span> selected
          </button>
          <button class="btn" id="c-discard">Discard</button>
        </div>
        <p style="font-size:10.5px;color:var(--ink-4);line-height:1.5">
          Goals are saved as project shells. Open Goal Breakdown to draft their milestones —
          nothing is scheduled automatically.
        </p>
      </div>`;

    const update = () => {
      const n = target.querySelectorAll("[data-sel]:checked").length;
      const btn = target.querySelector("#c-commit");
      btn.disabled = n === 0;
      target.querySelector("#c-count-sel").textContent = n;
    };
    target.querySelectorAll("[data-sel]").forEach((cb) => {
      cb.addEventListener("change", () => {
        items[Number(cb.dataset.sel)].selected = cb.checked;
        target.querySelector(`[data-item="${cb.dataset.sel}"]`).style.opacity = cb.checked ? "1" : "0.55";
        update();
      });
    });
    target.querySelectorAll("[data-title]").forEach((inp) => {
      inp.addEventListener("input", () => { items[Number(inp.dataset.title)].title = inp.value; });
    });
    target.querySelectorAll("[data-date]").forEach((inp) => {
      inp.addEventListener("change", () => { items[Number(inp.dataset.date)].date = inp.value; });
    });
    target.querySelector("#c-discard").addEventListener("click", () => renderEmpty(target));
    target.querySelector("#c-commit").addEventListener("click", () => onCommit(items.filter((i) => i.selected)));
  }

  function renderEmpty(target) {
    target.innerHTML = "";
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

  function openCapture(prefill = "") {
    const s = sheet({
      title: "Capture",
      sub: "One box. No forms. The assistant sorts it after you finish.",
      width: 520,
      body: captureBody(),
      onMount: (el, close) => {
        const text = el.querySelector("#c-text");
        const review = el.querySelector("#c-review");
        const count = el.querySelector("#c-count");
        const files = [];
        text.value = prefill;
        const sync = () => { count.textContent = `${U.wordCount(text.value)} words`; };
        sync();
        text.addEventListener("input", sync);

        const fileInput = el.querySelector("#c-file-input");
        el.querySelector("#c-file").addEventListener("click", () => fileInput.click());
        fileInput.addEventListener("change", () => {
          Array.from(fileInput.files || []).forEach((f) => files.push(f.name));
          el.querySelector("#c-files").innerHTML = files.map((f) => `
            <div class="row gap-2" style="font-size:11.5px;color:var(--ink-2)">
              ${icon("paperclip", "ico-sm")}<span class="grow truncate">${esc(f)}</span>
              <span class="mono" style="font-size:10px;color:var(--ink-4)">attached</span>
            </div>`).join("");
        });

        const mic = el.querySelector("#c-mic");
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) {
          mic.setAttribute("aria-disabled", "true");
          mic.title = "Voice input is not available in this browser";
          mic.style.opacity = "0.4";
        } else {
          mic.addEventListener("click", () => {
            const rec = new SR();
            rec.lang = navigator.language || "en-US";
            rec.interimResults = true;
            rec.onresult = (ev) => {
              const said = Array.from(ev.results).map((r) => r[0].transcript).join(" ");
              text.value = said;
              sync();
            };
            rec.onerror = () => toast("Voice input stopped. You can type instead.", { kind: "danger" });
            rec.start();
            toast("Listening. Speak, then press the mic again to stop.");
            mic.dataset.listening = "1";
            rec.onend = () => { delete mic.dataset.listening; };
          });
        }

        const process = async () => {
          const value = text.value.trim();
          if (!value) { toast("Write something first.", { kind: "danger" }); return; }
          review.innerHTML = skeletonRows(3);
          try {
            const result = await POS.ai.parseCapture(value);
            renderReview(el, result, (picked) => {
              commitItems(picked, files);
              close();
            });
            review.scrollIntoView({ block: "nearest", behavior: "smooth" });
          } catch (err) {
            review.innerHTML = `<div class="note note-warning">${icon("warning")}<div>Could not read that. Try again, or add the task manually.</div></div>`;
          }
        };

        const footer = document.createElement("div");
        footer.className = "row gap-2";
        footer.style.marginTop = "14px";
        footer.innerHTML = `
          <button class="btn btn-accent grow" id="c-process">${icon("sparkles")} Process with the assistant</button>
          <button class="btn" id="c-close">Cancel</button>`;
        el.querySelector(".sheet-body").appendChild(footer);
        footer.querySelector("#c-close").addEventListener("click", close);
        footer.querySelector("#c-process").addEventListener("click", process);
        text.addEventListener("keydown", (e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); process(); }
        });
      },
    });
    return s;
  }

  /* =========================================================
     Assistant drawer
     ========================================================= */

  function openAssistant(seedQuestion) {
    const s = sheet({
      title: "Assistant",
      sub: "Local demo · rule-based · no model connected",
      width: 440,
      body: `
        <div class="stack gap-4" id="a-log">
          <div class="note note-quiet">${icon("sparkles")}
            <div>I work from your own data, on this device. I propose; you decide.
            Try “plan my day” or “what is behind?”</div>
          </div>
        </div>
        <div class="row gap-2 wrap" id="a-suggest" style="margin-top:14px">
          ${["Plan my day", "What's behind?", "What should I focus on?", "Summarise my week"].map((q) =>
            `<button class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join("")}
        </div>
        <div style="position:sticky;bottom:-20px;background:var(--surface);padding-top:12px;margin-top:14px">
          <div class="search-field" style="border:1px solid var(--line);border-radius:var(--r-sm);padding:0 10px;height:40px">
            <input id="a-input" placeholder="Ask about your day, week or plan" aria-label="Ask the assistant" />
            <button class="icon-btn" id="a-send" aria-label="Send">${icon("arrow-right")}</button>
          </div>
        </div>`,
      onMount: (el, close) => {
        const log = el.querySelector("#a-log");
        const input = el.querySelector("#a-input");
        const add = (html) => {
          const node = document.createElement("div");
          node.innerHTML = html;
          const child = node.firstElementChild;
          log.appendChild(child);
          log.parentElement.scrollTop = log.parentElement.scrollHeight;
        };
        const ask = async (q) => {
          if (!q.trim()) return;
          add(`<div class="row" style="justify-content:flex-end">
                 <div style="background:var(--ink);color:var(--on-accent);padding:9px 12px;border-radius:12px 12px 3px 12px;font-size:12.5px;max-width:85%">${esc(q)}</div>
               </div>`);
          const pending = document.createElement("div");
          pending.innerHTML = `<div class="row gap-2" style="color:var(--ink-3);font-size:12px">${icon("sparkles")}<span class="spinner"></span> Thinking from your data…</div>`;
          log.appendChild(pending);
          try {
            const r = await POS.ai.assistantReply(q);
            pending.remove();
            add(`
              <div class="panel" style="box-shadow:none">
                <div class="panel-body" style="padding:14px">
                  <div class="row gap-2" style="margin-bottom:6px">${icon("sparkles")}<strong style="font-size:12px">${esc(r.title)}</strong></div>
                  <p style="font-size:12.5px;color:var(--ink-2);line-height:1.6">${esc(r.text)}</p>
                  ${r.bullets && r.bullets.length ? `<ul class="stack gap-1" style="margin-top:8px">${r.bullets.map((b) => `<li style="font-size:12px;color:var(--ink-3)">· ${esc(b)}</li>`).join("")}</ul>` : ""}
                  ${r.actions && r.actions.length ? `<div class="row gap-2 wrap" style="margin-top:10px">${r.actions.map((a) => `<a class="btn btn-sm" href="${a.href}" data-close>${esc(a.label)} ${icon("arrow-right")}</a>`).join("")}</div>` : ""}
                </div>
              </div>`);
            log.querySelectorAll("a[data-close]").forEach((a) => a.addEventListener("click", close));
          } catch (err) {
            pending.remove();
            add(`<div class="note note-warning">${icon("warning")}<div>That did not work. Try a simpler question.</div></div>`);
          }
        };
        input.addEventListener("keydown", (e) => { if (e.key === "Enter") { ask(input.value); input.value = ""; } });
        el.querySelector("#a-send").addEventListener("click", () => { ask(input.value); input.value = ""; });
        el.querySelectorAll("[data-q]").forEach((b) => b.addEventListener("click", () => ask(b.dataset.q)));
        if (seedQuestion) ask(seedQuestion);
      },
    });
    return s;
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
    wrap._close = close;
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
