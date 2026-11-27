/* Brain Dump — the central capture surface. */
(function () {
  "use strict";
  const POS = window.POS;
  const U = POS.util;
  const { icon, esc, fmtDate } = { icon: U.icon, esc: U.escapeHTML, fmtDate: U.fmtDate };
  const store = POS.store;
  const ui = POS.ui;

  let draft = "";
  let attachments = [];
  let result = null;
  let busy = false;
  let openDump = null;

  const TYPE_ORDER = ["goal", "task", "deadline", "reminder", "note"];

  function reviewHTML() {
    const items = result.items;
    const selected = items.filter((i) => i.selected);
    const grouped = TYPE_ORDER.map((type) => ({ type, list: items.filter((i) => i.type === type) }))
      .filter((g) => g.list.length);
    return `
      <section class="panel" id="review" style="margin-top:24px">
        <div class="panel-head">
          <div class="row gap-3">
            <h2>Review the reading</h2>
            <span class="tag tag-accent tag-mono">LOCAL AI</span>
          </div>
          <span class="meta">${result.items.length} found · edit anything</span>
        </div>
        <div class="panel-body" style="padding:18px 20px 6px">
          <p style="font-size:12.5px;color:var(--ink-3);max-width:62ch">${esc(result.summary)}</p>
          ${result.question ? `<div class="note" style="margin-top:12px">${icon("sparkles")}<div>${esc(result.question)}</div></div>` : ""}
        </div>
        <div class="rows" style="border-top:1px solid var(--line-soft);margin-top:12px">
          ${grouped.map((g) => `
            <div class="review-group">
              <div class="review-group-label">
                <span class="tag tag-mono ${g.type === "goal" ? "tag-accent" : g.type === "note" ? "tag-outline" : ""}" style="text-transform:uppercase">${g.type}</span>
                <span class="mono" style="font-size:9.5px;color:var(--ink-4)">${g.list.length}</span>
              </div>
              ${g.list.map((it) => {
                const idx = items.indexOf(it);
                return `<div class="review-row ${it.selected ? "" : "is-off"}" data-row="${idx}">
                  <input type="checkbox" ${it.selected ? "checked" : ""} data-sel="${idx}" aria-label="Include ${esc(it.title)}" />
                  <div class="grow stack gap-1">
                    <input class="input-inline review-title" data-title="${idx}" value="${esc(it.title)}" aria-label="Title" />
                    <div class="row gap-2 wrap">
                      ${it.type !== "note" ? `<input class="input" type="date" value="${it.date || ""}" data-date="${idx}" aria-label="Date" style="height:24px;font-size:11px;width:126px;padding:0 6px" />` : ""}
                      ${it.duration ? `<span class="mono" style="font-size:10px;color:var(--ink-3)">${U.fmtDur(it.duration)}</span>` : ""}
                      <select class="select" data-project="${idx}" aria-label="Project" style="height:24px;font-size:11px;width:auto;padding:0 24px 0 6px">
                        <option value="">Personal</option>
                        ${store.get().projects.filter((p) => p.status !== "archived").map((p) => `<option value="${p.id}" ${it.projectId === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}
                      </select>
                      ${it.note ? `<span style="font-size:10.5px;color:var(--ink-4)">${esc(it.note)}</span>` : ""}
                    </div>
                  </div>
                  <span class="mono review-conf">${Math.round(it.confidence * 100)}%</span>
                </div>`;
              }).join("")}
            </div>`).join("")}
        </div>
        <div class="panel-foot spread">
          <span style="font-size:11px;color:var(--ink-3)">${selected.length} selected. Goals become project shells; nothing is scheduled.</span>
          <div class="row gap-2">
            <button class="btn btn-sm" id="rv-discard">Discard</button>
            <button class="btn btn-accent btn-sm" id="rv-commit" ${selected.length ? "" : "disabled"}>
              ${icon("check")} Add ${selected.length}
            </button>
          </div>
        </div>
      </section>`;
  }

  function recentHTML() {
    const dumps = store.get().brainDumps;
    if (!dumps.length) {
      return `<div class="empty"><h3>Nothing captured yet</h3><p>Your first thought will appear here, editable and unprocessed until you say otherwise.</p></div>`;
    }
    return dumps.map((d) => {
      const isOpen = openDump === d.id;
      const when = d.createdAt.replace("T", " · ");
      return `<div class="dump-row ${isOpen ? "is-open" : ""}">
        <button class="dump-head" data-dump="${d.id}" aria-expanded="${isOpen}">
          <span class="mono dump-when">${esc(when)}</span>
          <span class="dump-text">${esc(d.text)}</span>
          <span class="tag tag-outline tag-mono">${d.extracted} ITEM${d.extracted === 1 ? "" : "S"}</span>
          <span class="dump-chev">${icon(isOpen ? "chevron-down" : "chevron-right")}</span>
        </button>
        ${isOpen ? `
          <div class="dump-body">
            <p class="dump-full">${esc(d.text)}</p>
            <div class="row gap-2">
              <button class="btn btn-sm" data-reuse="${d.id}">${icon("rotate")} Read it again</button>
              <button class="btn btn-sm btn-danger" data-drop="${d.id}">${icon("trash")} Remove</button>
            </div>
          </div>` : ""}
      </div>`;
    }).join("");
  }

  function render(main) {
    const st = store.get();
    const dumps = st.brainDumps;

    main.innerHTML = `
      <div class="page is-condensed">
        <header class="page-head">
          <div>
            <h1 class="page-title">Brain <em>Dump</em></h1>
            <div class="page-sub">
              <span>Say it badly. The assistant can sort it.</span>
              <span class="dot-sep">·</span>
              <span>${dumps.length} recent</span>
            </div>
          </div>
          <div class="page-actions">
            <button class="btn btn-ghost" data-act="assistant">${icon("sparkles")} Ask the assistant</button>
          </div>
        </header>

        <section class="composer" aria-label="Capture">
          <label class="sr-only" for="dump-input">What's on your mind?</label>
          <textarea id="dump-input" class="composer-input" placeholder="What's on your mind?" ${busy ? "disabled" : ""}>${esc(draft)}</textarea>
          <div class="composer-bar">
            <div class="row gap-1">
              <button class="icon-btn" id="d-mic" aria-label="Voice input" title="Voice input">${icon("mic")}</button>
              <button class="icon-btn" id="d-file" aria-label="Attach files" title="Attach files">${icon("paperclip")}</button>
              <input type="file" id="d-file-input" multiple hidden />
              <span class="mono composer-count" id="d-count">0 words</span>
            </div>
            <div class="row gap-2">
              <span class="mono composer-hint">Ctrl ↵</span>
              <button class="btn btn-accent" id="d-talk" ${busy ? "disabled" : ""}>
                ${icon("sparkles")} Start conversation
              </button>
            </div>
          </div>
          <div id="d-files" class="composer-files">
            ${attachments.map((a, i) => `
              <span class="attach-chip">${icon("paperclip", "ico-sm")}${esc(a)}
                <button data-remove-file="${i}" aria-label="Remove ${esc(a)}">${icon("close", "ico-sm")}</button>
              </span>`).join("")}
          </div>
        </section>

        <div class="dump-meta">
          <span>Talk through a thought, or review suggestions as a list.</span>
          <button class="btn btn-quiet" id="d-process" ${busy ? "disabled" : ""}>
            ${busy ? '<span class="spinner"></span> Reading' : "Review as list"}
          </button>
        </div>

        <div id="analysis">
          ${busy ? `<section class="panel" style="margin-top:24px">${ui.skeletonRows(4)}</section>` : result ? reviewHTML() : ""}
        </div>

        <section style="margin-top:40px">
          <div class="section-head">
            <h2>Recent dumps</h2>
            <span class="meta">${dumps.length ? "Kept until you remove them" : ""}</span>
          </div>
          <div class="dumps">${recentHTML()}</div>
        </section>
      </div>`;

    const text = main.querySelector("#dump-input");
    const count = main.querySelector("#d-count");
    const sync = () => {
      draft = text.value;
      count.textContent = `${U.wordCount(draft)} words`;
    };
    const talk = () => {
      const value = text.value.trim();
      if (!value) { ui.toast("Write a thought or question first.", { kind: "danger" }); return; }
      ui.openCapture(value, { start: true });
    };
    sync();
    text.addEventListener("input", sync);
    text.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); talk(); }
    });
    if (!busy) setTimeout(() => text.focus(), 20);

    main.querySelector("#d-file").addEventListener("click", () => main.querySelector("#d-file-input").click());
    main.querySelector("#d-file-input").addEventListener("change", (e) => {
      Array.from(e.target.files || []).forEach((f) => attachments.push(f.name));
      render(main);
    });
    main.querySelectorAll("[data-remove-file]").forEach((b) => b.addEventListener("click", () => {
      attachments.splice(Number(b.dataset.removeFile), 1);
      render(main);
    }));

    const mic = main.querySelector("#d-mic");
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      mic.setAttribute("aria-disabled", "true");
      mic.style.opacity = "0.4";
      mic.title = "Voice input is not available in this browser";
    } else {
      mic.addEventListener("click", () => {
        const rec = new SR();
        rec.lang = navigator.language || "en-US";
        rec.interimResults = true;
        rec.onresult = (ev) => {
          text.value = Array.from(ev.results).map((r) => r[0].transcript).join(" ");
          sync();
        };
        rec.onend = () => { sync(); };
        rec.onerror = () => ui.toast("Voice input stopped. You can type instead.", { kind: "danger" });
        rec.start();
        mic.style.color = "var(--accent)";
        rec.onend = () => { mic.style.color = ""; sync(); };
        ui.toast("Listening. Press the mic again to stop.");
      });
    }

    main.querySelector("#d-talk").addEventListener("click", talk);
    main.querySelector("#d-process").addEventListener("click", process);

    main.querySelectorAll("[data-dump]").forEach((b) => b.addEventListener("click", () => {
      openDump = openDump === b.dataset.dump ? null : b.dataset.dump;
      render(main);
    }));
    main.querySelectorAll("[data-reuse]").forEach((b) => b.addEventListener("click", () => {
      const d = store.get().brainDumps.find((x) => x.id === b.dataset.reuse);
      if (d) { draft = d.text; result = null; render(main); ui.toast("Loaded into the composer."); }
    }));
    main.querySelectorAll("[data-drop]").forEach((b) => b.addEventListener("click", async () => {
      const ok = await ui.confirm({
        title: "Remove this dump?",
        body: "The text is deleted. Anything already turned into tasks or notes stays.",
        confirmLabel: "Remove dump",
        danger: true,
      });
      if (!ok) return;
      store.set((s) => { s.brainDumps = s.brainDumps.filter((x) => x.id !== b.dataset.drop); }, "dump:delete");
      render(main);
    }));

    if (result) wireReview(main);
  }

  function wireReview(main) {
    const items = result.items;
    main.querySelectorAll("[data-sel]").forEach((cb) => cb.addEventListener("change", () => {
      items[Number(cb.dataset.sel)].selected = cb.checked;
      render(main);
    }));
    main.querySelectorAll("[data-title]").forEach((inp) => inp.addEventListener("input", () => {
      items[Number(inp.dataset.title)].title = inp.value;
    }));
    main.querySelectorAll("[data-date]").forEach((inp) => inp.addEventListener("change", () => {
      items[Number(inp.dataset.date)].date = inp.value;
    }));
    main.querySelectorAll("[data-project]").forEach((sel) => sel.addEventListener("change", () => {
      items[Number(sel.dataset.project)].projectId = sel.value || null;
    }));
    const discard = main.querySelector("#rv-discard");
    if (discard) discard.addEventListener("click", () => { result = null; render(main); });
    const commit = main.querySelector("#rv-commit");
    if (commit) commit.addEventListener("click", () => {
      const picked = items.filter((i) => i.selected);
      if (!picked.length) return;
      ui.commitItems(picked);
      store.set((s) => {
        if (s.brainDumps[0] && s.brainDumps[0].text === draftTrim()) s.brainDumps.shift();
      }, "dump:commit");
      result = null;
      draft = "";
      attachments = [];
      render(main);
    });
  }

  function draftTrim() { return draft.trim(); }

  async function process() {
    const main = document.getElementById("main");
    const text = draft.trim();
    if (!text) { ui.toast("Write something first — even three words.", { kind: "danger" }); return; }
    busy = true;
    result = null;
    render(main);
    try {
      const parsed = await POS.ai.parseCapture(text);
      result = parsed;
      store.set((s) => {
        s.brainDumps.unshift({
          id: "bd" + Date.now().toString(36),
          text,
          createdAt: new Date().toISOString().slice(0, 16).replace("T", "T"),
          status: "processed",
          extracted: parsed.items.length,
        });
      }, "dump:add");
      busy = false;
      render(main);
      const review = main.querySelector("#review");
      if (review) review.scrollIntoView({ block: "start", behavior: "smooth" });
      ui.toast(`${parsed.items.length} things found. Nothing saved yet.`);
    } catch (err) {
      busy = false;
      render(main);
      ui.toast("The reading failed. Try again.", { kind: "danger" });
    }
  }

  POS.views = POS.views || {};
  POS.views.dump = { render };
})();
