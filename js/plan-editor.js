/* Natural language -> authenticated AI proposal -> editable review -> explicit atomic approval. */
(function () {
  "use strict";
  const POS = window.POS, U = POS.util, P = POS.planning, esc = U.escapeHTML;
  let active = null;
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function open() {
    if (active) { active.querySelector("#plan-description")?.focus(); return; }
    const user = POS.cloud.getStatus().user;
    if (!user) return;
    const owner = user.uid, controller = new AbortController();
    const settings = POS.store.get().settings;
    const wrap = document.createElement("div");
    wrap.className = "modal-wrap plan-overlay";
    wrap.setAttribute("role", "presentation");
    wrap.innerHTML = `<section class="plan-dialog" role="dialog" aria-modal="true" aria-labelledby="plan-heading">
      <div class="studio-section-head"><div><p class="subtle">A little structure for a big idea</p><h2 id="plan-heading">What are you working on?</h2></div><button class="icon-btn" data-close aria-label="Close task planner">${U.icon("close")}</button></div>
      <div id="project-conversation-host"></div>
      <form id="plan-form">
        <label class="label" for="plan-description">Describe your task or project</label>
        <textarea class="input" id="plan-description" rows="4" maxlength="5000" required placeholder="I need to finish my typography project: research references, refine my typeface, make mockups and prepare a presentation."></textarea>
        <div class="plan-preferences"><div class="field"><label class="label" for="plan-deadline">Deadline</label><input class="input" type="date" id="plan-deadline" min="${U.todayISO()}" max="${P.add(U.todayISO(), 366)}" value="${P.add(U.todayISO(), 7)}" required></div><div class="field"><label class="label" for="plan-capacity">Minutes per working day</label><input class="input" type="number" id="plan-capacity" min="15" max="720" step="5" value="${settings.capacity || 120}" required></div></div>
        <fieldset class="day-picker"><legend>Available working days</legend>${days.map((d, i) => `<label><input type="checkbox" name="workday" value="${i}" ${(settings.workDays || [1, 2, 3, 4, 5]).includes(i) ? "checked" : ""}><span>${d}</span></label>`).join("")}</fieldset>
        <div class="plan-actions"><button class="btn btn-primary" type="submit" id="plan-generate">Generate AI plan</button><button class="btn" type="button" id="plan-manual">Create manually</button></div>
        <p class="field-help">Only your description and minutes per working day are sent to DeepSeek. Nothing is saved until you approve.</p>
      </form>
      <p class="plan-message" id="plan-message" role="status" aria-live="polite"></p>
      <div id="plan-review" hidden></div>
    </section>`;
    const previous = document.activeElement;
    let conversation;
    function close() { conversation?.destroy(); controller.abort(); wrap.remove(); active = null; POS.ui.lockScroll(false); if (previous?.isConnected) previous.focus(); }
    wrap._close = close;
    active = wrap;
    document.getElementById("overlay-root").append(wrap);
    POS.ui.lockScroll(true);
    wrap.querySelector("[data-close]").onclick = close;
    wrap.addEventListener("click", e => { if (e.target === wrap) close(); });
    wrap.addEventListener("keydown", e => {
      if (e.key === "Escape") close();
      if (e.key !== "Tab") return;
      const nodes = [...wrap.querySelectorAll("button:not(:disabled), input, textarea, select, a[href], summary")].filter(el => !el.closest("[hidden]") && el.getClientRects().length);
      if (e.shiftKey && document.activeElement === nodes[0]) { e.preventDefault(); nodes.at(-1).focus(); }
      else if (!e.shiftKey && document.activeElement === nodes.at(-1)) { e.preventDefault(); nodes[0].focus(); }
    });
    const $ = s => wrap.querySelector(s);
    $("#plan-description").focus();
    const message = text => { $("#plan-message").textContent = text; };
    conversation = POS.projectConversation.mount($("#project-conversation-host"), text => {
      $("#plan-description").value = text;
      $("#plan-description").dispatchEvent(new Event("blur"));
      $("#plan-description").focus();
      message("Conversation brief added. Review the details before generating your plan.");
    });
    let proposal = null, generating = false;
    let deadlineEdited = false;
    $("#plan-deadline").addEventListener("input", () => { deadlineEdited = true; });
    $("#plan-description").addEventListener("blur", () => {
      if (deadlineEdited) return;
      const found = P.extractDeadline($("#plan-description").value, U.todayISO());
      if (found) { $("#plan-deadline").value = found; message("Deadline read from your description. Check it before generating."); }
    });
    function options() {
      const options = { start: U.todayISO(), deadline: $("#plan-deadline").value, capacity: Number($("#plan-capacity").value), days: [...wrap.querySelectorAll('[name="workday"]:checked')].map(el => Number(el.value)) };
      P.preferences(options);
      if (!P.validDate(options.deadline) || options.deadline < options.start || options.deadline > P.add(options.start, 366)) throw new Error("Choose a deadline within the next year.");
      return options;
    }
    function readRows() {
      return [...wrap.querySelectorAll(".plan-step")].map(row => ({ title: row.querySelector('[name="title"]').value.trim(), date: row.querySelector('[name="date"]').value, duration: Number(row.querySelector('[name="duration"]').value) }));
    }
    function reviewMessage(ready) {
      const missing = proposal.steps.filter(step => !step.date).length;
      message(missing ? `${missing} of ${proposal.steps.length} steps won't fit before the deadline. Extend it or edit the steps, then choose Rebalance dates.` : ready);
    }
    function renderReview() {
      const host = $("#plan-review");
      host.hidden = false;
      host.innerHTML = `<div class="review-heading"><p class="subtle">Review before saving</p><label class="label" for="plan-title">Main task</label><input class="input plan-title" id="plan-title" maxlength="200" value="${esc(proposal.title)}"></div>
        <div id="plan-steps">${proposal.steps.map((t, i) => row(t, i)).join("")}</div>
        <div class="plan-actions"><button class="btn" id="plan-add-step" type="button">Add a step</button><button class="btn" id="plan-distribute" type="button">Rebalance dates</button><button class="btn btn-primary" id="plan-approve" type="button">Approve & schedule</button></div><p class="field-help">Dates respect your working days and include work already scheduled. Approval saves the whole plan.</p>`;
      host.querySelectorAll("[data-remove-step]").forEach(button => { button.onclick = () => button.closest(".plan-step").remove(); });
      $("#plan-add-step").onclick = () => {
        try {
          const opts = options();
          proposal.title = $("#plan-title").value;
          proposal.steps = [...readRows(), { title: "", duration: Math.min(30, opts.capacity), date: opts.deadline }];
          renderReview();
          wrap.querySelector(".plan-step:last-child input").focus();
        } catch (e) { message(e.message); }
      };
      $("#plan-distribute").onclick = () => {
        try { proposal.title = $("#plan-title").value; proposal.steps = P.scheduleDraft(readRows(), options(), POS.store.get().tasks); renderReview(); reviewMessage("Dates rebalanced. Check the plan, then approve."); }
        catch (e) { message(e.message); }
      };
      $("#plan-approve").onclick = () => {
        try {
          if (POS.cloud.getStatus().user?.uid !== owner) throw new Error("Your account changed. Reopen the planner.");
          const steps = readRows(), opts = options(), title = $("#plan-title").value.trim();
          if (!title) throw new Error("Give the main task a title.");
          if (steps.some(step => !step.date)) throw new Error("Some steps still need dates. Set them here, or adjust the deadline and choose Rebalance dates.");
          P.validate(steps, opts, POS.store.get().tasks);
          const projectId = U.uid("p");
          POS.store.set(s => {
            s.projects.push({ id: projectId, name: title, description: $("#plan-description").value.trim(), deadline: opts.deadline, color: "teal", status: "active", milestones: [], createdAt: U.todayISO() });
            steps.forEach((t, i) => s.tasks.push({ ...t, id: U.uid("t"), projectId, milestoneId: null, order: i, priority: 2, done: false, deps: [], notes: "", start: null, rescheduled: 0, createdAt: U.todayISO(), completedAt: null }));
            s.settings.capacity = opts.capacity; s.settings.workDays = opts.days;
          }, "plan:approve");
          POS.store.flush();
          close();
          location.hash = "#/calendar";
          POS.ui.toast("Plan approved. Your calendar is ready.");
        } catch (e) { message(e.message); }
      };
      host.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    function row(t, i) {
      return `<div class="plan-step"><span class="step-number">${String(i + 1).padStart(2, "0")}</span><label>Step<input class="input" name="title" maxlength="200" value="${esc(t.title)}" aria-label="Step ${i + 1} title"></label><label>Date<input class="input" name="date" type="date" value="${esc(t.date)}" aria-label="Step ${i + 1} date"></label><label>Minutes<input class="input" name="duration" type="number" min="5" max="720" value="${t.duration}" aria-label="Step ${i + 1} minutes"></label><button class="icon-btn" data-remove-step type="button" aria-label="Delete step ${i + 1}">${U.icon("close")}</button></div>`;
    }
    $("#plan-manual").onclick = () => {
      if (generating) return;
      try {
        const opts = options();
        proposal = { title: $("#plan-description").value.trim().slice(0, 200) || "My next project", steps: P.schedule([{ title: "", duration: Math.min(30, opts.capacity) }].map(t => ({ ...t, title: "First step" })), opts, POS.store.get().tasks) };
        message("Manual plan. Edit the steps below; no AI was used."); renderReview();
      } catch (e) { message(e.message); }
    };
    $("#plan-form").onsubmit = async e => {
      e.preventDefault();
      if (generating) return;
      try {
        const opts = options(), description = $("#plan-description").value.trim();
        if (description.length < 8) throw new Error("Describe your work in at least 8 characters.");
        generating = true; $("#plan-generate").disabled = true; $("#plan-manual").disabled = true;
        $("#plan-generate").textContent = "Building your plan…";
        message("Breaking the work into steps, then checking available space in your calendar…");
        const token = await POS.cloud.token();
        if (!wrap.isConnected || POS.cloud.getStatus().user?.uid !== owner) return;
        const response = await fetch("/api/plan", { method: "POST", signal: controller.signal, headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ description, capacity: opts.capacity }) });
        const result = await response.json().catch(() => { throw new Error("The planning server did not return a plan. Open Personal OS from the server started by npm run dev and try again."); });
        if (!response.ok) throw new Error(result.error || "AI generation failed. Try again or create manually.");
        if (!wrap.isConnected || POS.cloud.getStatus().user?.uid !== owner) return;
        proposal = { title: result.title, steps: P.scheduleDraft(result.steps, opts, POS.store.get().tasks) };
        renderReview(); reviewMessage("Your DeepSeek breakdown is ready. Review the steps and dates before approving.");
      } catch (e) { if (e.name !== "AbortError") message(e.message); }
      finally { generating = false; $("#plan-generate").disabled = false; $("#plan-manual").disabled = false; $("#plan-generate").textContent = proposal ? "Regenerate AI plan" : "Generate AI plan"; }
    };
  }
  POS.planEditor = { open };
})();
