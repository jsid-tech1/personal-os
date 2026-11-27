/* The first five minutes: add real work, finish it, then save an account-owned backup. */
(function () {
  "use strict";
  const POS = window.POS;
  const U = POS.util;
  let unsubscribe = null;

  function html() {
    const state = POS.store.get();
    if (state.settings.onboarded) return "";
    const hasTask = state.tasks.length > 0;
    const completed = state.tasks.some(task => task.done);
    return `<section class="panel first-use" aria-labelledby="first-use-title">
      <div class="panel-body">
        <div class="first-use-head">
          <div><p class="first-use-step">Your first five minutes</p>
          <h2 id="first-use-title">${hasTask ? "Your plan is taking shape." : "Start with one task."}</h2>
          <p class="field-help">${hasTask ? "Tick a task when it is finished. Save a cloud backup to keep a copy with your Google account." : "Add something you want to finish today. Your workspace starts empty, ready for your own work."}</p></div>
          <button class="btn btn-ghost" id="first-use-dismiss" type="button">Dismiss guide</button>
        </div>
        ${!hasTask ? `<form id="first-task-form" class="first-task-form">
          <div class="field first-task-title"><label class="label" for="first-task-title">Task</label>
            <input class="input" id="first-task-title" name="title" placeholder="Finish my project proposal" maxlength="200" required aria-describedby="first-task-error" />
            <p class="field-help danger" id="first-task-error" role="alert"></p></div>
          <div class="field"><label class="label" for="first-task-date">Date</label>
            <input class="input" id="first-task-date" name="date" type="date" value="${U.todayISO()}" required /></div>
          <div class="field"><label class="label" for="first-task-duration">Time needed</label>
            <select class="select" id="first-task-duration" name="duration">
              <option value="15">15 minutes</option><option value="30" selected>30 minutes</option><option value="60">1 hour</option><option value="90">90 minutes</option>
            </select></div>
          <button class="btn btn-primary" type="submit">Add my first task</button>
        </form>` : `<ol class="first-use-progress">
          <li><span class="first-use-number">✓</span><span>Task added</span></li>
          <li><span class="first-use-number">${completed ? "✓" : "2"}</span><span>${completed ? "Task completed" : "Finish a task and tick it off"}</span></li>
          <li><span class="first-use-number">3</span><button class="btn" id="first-use-backup" type="button">Save cloud backup</button></li>
        </ol>`}
        <p id="first-use-status" class="field-help" role="status"></p>
        <div class="first-use-foot"><span class="field-help">Changes save in this browser. Cloud backup is manual.</span>
          <a href="#/settings" class="btn btn-ghost">Restore an existing backup</a></div>
      </div>
    </section>`;
  }

  function destroy() {
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
  }

  function bind(main) {
    destroy();
    const form = main.querySelector("#first-task-form");
    form?.addEventListener("submit", event => {
      event.preventDefault();
      const input = form.querySelector("#first-task-title");
      const title = input.value.trim();
      if (!title) {
        input.setAttribute("aria-invalid", "true");
        form.querySelector("#first-task-error").textContent = "Write the task you want to finish.";
        input.focus();
        return;
      }
      const date = form.elements.date.value;
      const duration = Number(form.elements.duration.value);
      document.activeElement?.blur();
      POS.store.actions.addTask({ title, date, duration, priority: 1 });
      POS.store.flush();
      POS.app.render("first-task");
      main.querySelector("#first-use-title")?.setAttribute("tabindex", "-1");
      main.querySelector("#first-use-title")?.focus();
      POS.ui.toast("Task added. Use Plan my day to give it a time.");
    });
    main.querySelector("#first-use-dismiss")?.addEventListener("click", () => {
      POS.store.actions.updateSettings({ onboarded: true });
      main.focus();
    });
    main.querySelector("#first-use-backup")?.addEventListener("click", async () => {
      try {
        await POS.cloud.saveBackup();
        // The guide can be dismissed at any point; saving never silently changes task status.
        POS.ui.toast("Cloud backup saved. Restore it from Settings on another device.");
      } catch (error) { /* Kept inline by the cloud subscription. */ }
    });
    const update = status => {
      const button = main.querySelector("#first-use-backup");
      const text = main.querySelector("#first-use-status");
      if (button) {
        button.disabled = !!status.busy;
        button.textContent = status.busy === "saving" ? "Saving cloud backup…" : "Save cloud backup";
      }
      if (text) {
        text.textContent = status.error || (status.lastSaved ? "Cloud backup saved to your Google account." : "");
        text.setAttribute("role", status.error ? "alert" : "status");
      }
    };
    if (main.querySelector(".first-use")) {
      update(POS.cloud.getStatus());
      unsubscribe = POS.cloud.subscribe(update);
    }
  }

  POS.onboarding = { html, bind, destroy };
})();
