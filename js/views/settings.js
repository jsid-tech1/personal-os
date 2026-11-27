/* Control Centre — the honest switches, and the exit doors. */
(function () {
  "use strict";
  const POS = window.POS;
  const U = POS.util;
  const { icon, esc } = { icon: U.icon, esc: U.escapeHTML };
  const store = POS.store;
  const ui = POS.ui;
  let unsubscribeCloud = null;

  const SECTIONS = [
    ["profile", "Profile"],
    ["work", "Work & planning"],
    ["connections", "Cloud connection"],
    ["data", "Backup & restore"],
  ];

  function bytesLabel(n) {
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
    return (n / 1048576).toFixed(2) + " MB";
  }

  function storageSize() {
    try {
      return new Blob([JSON.stringify(store.get())]).size;
    } catch (err) {
      return 0;
    }
  }

  function toastSaved(label) {
    ui.toast(label + " saved.");
  }

  function renderCloud(main) {
    const host = main.querySelector("#s-cloud");
    if (!host) return;
    const cloud = POS.cloud;
    const s = cloud.getStatus();
    const logout = main.querySelector("#s-profile-logout");
    if (logout) {
      logout.disabled = !s.user || !!s.busy;
      logout.textContent = s.busy === "signing-out" ? "Logging out…" : "Log out";
    }
    const disabled = s.busy ? "disabled" : "";
    const progress = {
      loading: "Connecting to Firebase…", "signing-in": "Waiting for Google sign-in…",
      "signing-out": "Signing out…", saving: "Saving your cloud backup…", restoring: "Reading your cloud backup…",
    };
    const label = s.busy ? progress[s.busy] : s.user ? "Signed in with Google" : s.ready ? "Ready to sign in" : "Connection unavailable";
    host.innerHTML = `
      <div class="stack gap-3">
        <div class="row gap-3">
          <span class="settings-conn-icon">${icon("cloud")}</span>
          <div class="grow cloud-account">
            <h3 class="settings-label">Firebase cloud backup</h3>
            <p class="field-help">${s.user ? esc(s.user.email || s.user.name || "Google account") : "Sign in with Google to save a copy outside this browser."}</p>
          </div>
        </div>
        <p class="field-help" role="status">${esc(label)}${s.lastSaved ? " · Last saved " + esc(new Date(s.lastSaved).toLocaleString()) : ""}</p>
        ${s.error ? `<div class="note note-warning" role="alert">${icon("warning")}<span>${esc(s.error)}</span></div>` : ""}
        <div class="data-actions">
          ${!s.ready ? `<button class="btn" id="s-cloud-retry" ${disabled}>${icon("rotate")} Retry connection</button>` : s.user ? `
            <button class="btn btn-primary" id="s-cloud-save" ${disabled}>${icon("upload")} Save cloud backup</button>
            <button class="btn" id="s-cloud-restore" ${disabled}>${icon("download")} Restore cloud backup</button>
            <button class="btn btn-ghost" id="s-cloud-signout" ${disabled}>Sign out</button>` : `
            <button class="btn btn-primary" id="s-cloud-signin" ${disabled}>${icon("user")} Continue with Google</button>`}
        </div>
        <p class="field-help">One manual recovery copy per Google account. Saving replaces it; restoring replaces your active workspace after confirmation. Automatic workspace sync is separate; its status is shown in Profile above. Signing out keeps the local copy.</p>
      </div>`;
    const analytics = main.querySelector("#s-analytics-status");
    if (analytics) analytics.textContent = s.analytics === "enabled" ? "Firebase Analytics is enabled for usage measurement." :
      s.analytics === "loading" ? "Firebase Analytics is initializing." : "Firebase Analytics is unavailable in this browser or connection.";
    const bind = (id, action, success) => {
      const button = host.querySelector(id);
      if (!button) return;
      button.addEventListener("click", async () => {
        try {
          const result = await action();
          if (success && result !== false) ui.toast(success);
        } catch (error) {
          ui.toast(error.message, { kind: "danger" });
        }
      });
    };
    bind("#s-cloud-retry", () => cloud.start());
    bind("#s-cloud-signin", () => cloud.signIn());
    bind("#s-cloud-signout", () => cloud.signOut(), "Signed out. Your local workspace is still here.");
    bind("#s-cloud-save", () => cloud.saveBackup(), "Cloud backup saved to your Google account.");
    bind("#s-cloud-restore", () => cloud.restoreBackup((data) => ui.confirm({
      title: "Restore your cloud backup?",
      body: `This backup holds ${data.tasks.length} tasks, ${data.projects.length} projects and ${data.notes.length} notes. It replaces this device's workspace. Export a file first if you want to keep the current version.`,
      confirmLabel: "Restore cloud backup",
    })), "Cloud backup restored on this device.");
  }

  function render(main) {
    if (unsubscribeCloud) unsubscribeCloud();
    const st = store.get();
    const s = st.settings;
    const size = storageSize();
    const counts = {
      tasks: st.tasks.length,
      projects: st.projects.length,
      notes: st.notes.length,
      habits: st.habits.length,
      sessions: st.focusSessions.length,
      dumps: st.brainDumps.length,
    };

    main.innerHTML = `
      <div class="page">
        <header class="page-head">
          <div>
            <h1 class="page-title">Your profile.</h1>
            <div class="page-sub">
              <span>Local workspace · optional Firebase cloud backup</span>
              <span class="dot-sep">·</span>
              <span class="mono">VERSION 1.0</span>
            </div>
          </div>
          <div class="page-actions">
            <button class="btn" id="s-export">${icon("download")} Export backup</button>
            <button class="btn btn-primary" id="s-import">${icon("upload")} Import backup</button>
            <input type="file" id="s-import-file" accept="application/json,.json" hidden />
          </div>
        </header>

        <div class="settings-layout">
          <nav class="settings-nav" aria-label="Settings sections">
            ${SECTIONS.map(([id, label]) => `<a href="#/settings" data-section="${id}">${label}</a>`).join("")}
            <div class="settings-nav-foot">
              <span class="status-line">
                <span class="dot"></span>
                <span id="s-conn-status">${navigator.onLine ? "Online" : "Offline"}</span>
              </span>
              <span class="mono">LOCAL + FIREBASE</span>
            </div>
          </nav>

          <div class="settings-body">
            <section class="settings-section" id="set-profile">
              <div class="settings-head">
                <h2>Profile</h2>
                <p>${esc(POS.cloud.getStatus().user?.email || "Your Google account")} / Your space, your pace.</p>
              </div>
              <div class="panel">
                <div class="panel-body stack gap-4">
                  <div class="settings-profile">
                    <span class="avatar avatar-lg" id="s-avatar">${esc(s.initials || "CS")}</span>
                    <div class="grow">
                      <div class="field">
                        <label class="label" for="s-name">Name</label>
                        <input class="input" id="s-name" value="${esc(s.name)}" />
                      </div>
                      <div class="field" style="margin-top:10px">
                        <label class="label" for="s-role">Role or context <span class="opt">optional</span></label>
                        <input class="input" id="s-role" value="${esc(s.role || "")}" />
                      </div>
                    </div>
                    <div class="field" style="max-width:110px">
                      <label class="label" for="s-initials">Initials</label>
                      <input class="input" id="s-initials" maxlength="3" value="${esc(s.initials)}" />
                    </div>
                  </div>
                  <div class="spread">
                    <span class="field-help">Changes update the greeting and avatar immediately.</span>
                    <button class="btn btn-primary btn-sm" id="s-save-profile">Save profile</button>
                  </div>
                  <div class="row-item settings-row">
                    <div class="grow">
                      <div class="row-title settings-label">Google account</div>
                      <p class="field-help">Logging out keeps your saved work in this browser. Cloud backups are manual.</p>
                    </div>
                    <button class="btn" id="s-profile-logout" type="button">Log out</button>
                  </div>
                </div>
              </div>
              <div class="sync-panel">
                <h3>Across your devices</h3><p data-sync-status role="status">${esc(POS.sync?.status().error || POS.sync?.status().text || "Connecting cloud storage…")}</p>
                <div class="plan-actions"><button class="btn" id="s-sync-retry" type="button">Retry cloud sync</button><button class="btn" id="s-sync-local" type="button">Keep this device’s version</button><button class="btn" id="s-sync-remote" type="button">Load cloud version</button><a class="btn btn-ghost" href="#/mosaic">My mosaic archive</a></div>
                <p class="field-help">Local changes save automatically. Cloud errors are shown here. Resolve a device conflict deliberately; export a backup before replacing either version.</p>
              </div>
            </section>

            <section class="settings-section" id="set-work">
              <div class="settings-head">
                <h2>Working availability</h2>
                <p>Your plans use these days and leave room for work already scheduled.</p>
              </div>
              <div class="panel">
                <div class="rows">
                  <div class="row-item settings-row">
                    <div class="grow">
                      <div class="row-title settings-label">Daily capacity</div>
                      <div class="row-meta">The most focused work a day can hold. The planner stops here.</div>
                    </div>
                    <div class="row gap-2">
                      <input class="input" type="number" id="s-capacity" min="15" max="720" step="15" value="${s.capacity}" style="width:88px;height:30px" aria-label="Daily capacity in minutes" />
                      <span class="mono" style="font-size:10px;color:var(--ink-3)">MIN</span>
                    </div>
                  </div>
                  <div class="row-item settings-row">
                    <div class="grow">
                      <div class="row-title settings-label">Default pomodoro</div>
                      <div class="row-meta">Focus mode uses this as the work block length.</div>
                    </div>
                    <select class="select" id="s-focus-length" style="width:110px;height:30px" aria-label="Default pomodoro minutes">
                      ${[15, 20, 25, 30, 45, 50].map((n) => `<option value="${n}" ${s.focusLength === n ? "selected" : ""}>${n} minutes</option>`).join("")}
                    </select>
                  </div>
                  <div class="row-item settings-row">
                    <div class="grow">
                      <div class="row-title settings-label">Quiet hours</div>
                      <div class="row-meta">Notifications stay silent in this window. In-app only.</div>
                    </div>
                    <input class="input" id="s-quiet" value="${esc(s.quietHours)}" style="width:130px;height:30px" aria-label="Quiet hours" />
                  </div>
                </div>
              </div>
            </section>

            <section class="settings-section" id="set-notifications">
              <div class="settings-head">
                <h2>Notifications</h2>
                <p>What the notification centre is allowed to bring up. Turning one off hides it everywhere it appears.</p>
              </div>
              <div class="panel">
                <div class="rows">
                  ${[
                    ["notifyTasks", "Task reminders", "Reminders and overdue work from your own task list."],
                    ["notifyDeadlines", "Project deadlines", "Milestone and project dates approaching inside a week."],
                    ["notifyHabits", "Habit nudges", "A quiet prompt when a habit is still open late in the day."],
                    ["notifyReschedule", "Rescheduling proposals", "When unfinished work needs a new home."],
                  ].map(([key, label, desc]) => `
                    <div class="row-item settings-row">
                      <div class="grow">
                        <div class="row-title settings-label">${label}</div>
                        <div class="row-meta">${desc}</div>
                      </div>
                      <label class="switch">
                        <input type="checkbox" data-setting="${key}" ${s[key] ? "checked" : ""} />
                        <span class="track"></span><span class="sr-only">${label}</span>
                      </label>
                    </div>`).join("")}
                </div>
                <div class="panel-foot">
                  <p class="field-help">Nothing is delivered by email, push or SMS. This build has no notification service; the centre reads your data when you open it.</p>
                </div>
              </div>
            </section>

            <section class="settings-section" id="set-assistant">
              <div class="settings-head">
                <h2>Assistant</h2>
                <p>A local, deterministic demo. No model, no API key, no network request.</p>
              </div>
              <div class="panel">
                <div class="panel-body stack gap-4">
                  <div class="note">${icon("sparkles")}
                    <div><strong>What is actually running</strong>
                    <p style="margin-top:4px">Capture parsing, goal breakdown, day planning and rescheduling come from rules in <span class="mono">js/ai.js</span>. They are repeatable and explain themselves, but they are not a language model. Treat their output as a draft.</p></div>
                  </div>
                  <div class="rows" style="border-top:1px solid var(--line-soft)">
                    <div class="row-item settings-row">
                      <div class="grow">
                        <div class="row-title settings-label">Build a rescheduling proposal on open</div>
                        <div class="row-meta">Off means the Rescheduling screen waits for you to ask.</div>
                      </div>
                      <label class="switch">
                        <input type="checkbox" data-setting="aiAutoReschedule" ${s.aiAutoReschedule ? "checked" : ""} />
                        <span class="track"></span><span class="sr-only">Build rescheduling proposal on open</span>
                      </label>
                    </div>
                    <div class="row-item settings-row">
                      <div class="grow">
                        <div class="row-title settings-label">Assistant writes changes automatically</div>
                        <div class="row-meta">Locked off by design. Every change needs your approval.</div>
                      </div>
                      <label class="switch" style="opacity:.55">
                        <input type="checkbox" disabled />
                        <span class="track"></span><span class="sr-only">Locked off</span>
                      </label>
                    </div>
                  </div>
                  <p class="field-help">Model: none connected. Provider: device-local rules. To replace it, swap the functions in <span class="mono">js/ai.js</span>; the views do not know the difference.</p>
                </div>
              </div>
            </section>

            <section class="settings-section" id="set-connections">
              <div class="settings-head">
                <h2>Cloud backup</h2>
                <p>A separate recovery copy, alongside automatic workspace sync.</p>
              </div>
              <div class="panel">
                <div class="panel-body" id="s-cloud"></div>
                <div class="panel-foot">
                  <div class="spread">
                    <p class="field-help">Your built-in calendar updates with your tasks. External calendar integrations are not needed.</p>
                    <span class="row gap-2 mono" style="font-size:10px;color:var(--ink-3)">
                      <i class="pdot pdot-round" style="--tone:var(--positive)"></i> BUILT-IN CALENDAR
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section class="settings-section" id="set-data">
              <div class="settings-head">
                <h2>Backup & restore</h2>
                <p>Keep a recovery file of your tasks, calendar, mosaics, focus sessions and preferences.</p>
              </div>
              <div class="panel">
                <div class="panel-body">
                  <div class="data-grid">
                    <div class="data-cell">
                      <span class="stat-label">Stored locally</span>
                      <span class="mono data-num">${bytesLabel(size)}</span>
                      <span class="data-note">${counts.tasks} tasks / ${counts.sessions} focus sessions</span>
                    </div>
                    <div class="data-cell">
                      <span class="stat-label">Projects</span>
                      <span class="mono data-num">${counts.projects}</span>
                      <span class="data-note">${Object.keys(st.mosaics || {}).length} saved weekly canvases</span>
                    </div>
                    <div class="data-cell">
                      <span class="stat-label">Persistence</span>
                      <span class="mono data-num" style="font-size:15px">Local + cloud</span>
                      <span class="data-note">Account-specific / cloud status above</span>
                    </div>
                  </div>
                  <div class="divider"></div>
                  <div class="data-actions">
                    <button class="btn" id="s-export-2">${icon("download")} Export everything</button>
                    <button class="btn" id="s-import-2">${icon("upload")} Import a backup</button>
                    <button class="btn btn-danger" id="s-reset">${icon("trash")} Clear workspace</button>
                  </div>
                  <p class="field-help" style="margin-top:12px">Import and clear replace the active workspace across synced devices. Export a file first if you need to keep a copy.</p>
                </div>
              </div>
            </section>

            <section class="settings-section" id="set-privacy">
              <div class="settings-head">
                <h2>Privacy & security</h2>
                <p>Local work stays available offline. Google sign-in gives you a private cloud backup.</p>
              </div>
              <div class="panel">
                <div class="panel-body">
                  <dl class="def settings-def">
                    <dt>Where data lives</dt>
                    <dd><span class="value">localStorage</span> on this device. Save cloud backup also stores a workspace snapshot in Cloud Firestore under your Google account.</dd>
                    <dt>Who can read it</dt>
                    <dd>Anyone with access to this browser profile can read its local copy, including after sign-out. Published Firestore rules restrict cloud access to your signed-in account; Firebase project administrators also have administrative access.</dd>
                    <dt>Network use</dt>
                    <dd>Firebase SDKs, Google sign-in and cloud backup use a network connection. Fonts and local planning remain available from the app's files. <span id="s-analytics-status"></span></dd>
                    <dt>AI processing</dt>
                    <dd>Rule-based and local. No model provider is connected. Workspace text is sent to Firestore only when you save a cloud backup.</dd>
                    <dt>What removes it</dt>
                    <dd>Reset, importing or restoring a backup replaces the local workspace. Clearing browser site data removes the local copy. Cloud backups remain until replaced or deleted in Firebase Console.</dd>
                  </dl>
                  <div class="divider"></div>
                  <div class="spread">
                    <div class="row gap-2" style="color:var(--ink-2);font-size:12px">${icon("lock")} Google manages your sign-in. This app never receives your password.</div>
                    <button class="btn btn-danger btn-sm" id="s-clear">${icon("trash")} Reset local workspace</button>
                  </div>
                </div>
              </div>
            </section>

            <p class="settings-foot mono">
              PERSONAL OS · VERSION 1.0 · FIREBASE CLOUD BACKUP · NO MODEL CONNECTED · BUILT ${new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>`;

    renderCloud(main);
    unsubscribeCloud = POS.cloud.subscribe(() => renderCloud(main));

    /* section nav */
    main.querySelectorAll("[data-section]").forEach((a) => a.addEventListener("click", (e) => {
      e.preventDefault();
      const target = main.querySelector("#set-" + a.dataset.section);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    }));

    /* Account preferences and explicit cross-device conflict recovery. */
    main.querySelector("#s-sync-retry").onclick = () => POS.sync.refresh();
    const resolveSync = async choice => {
      const accepted = await ui.confirm({ title: choice === "local" ? "Keep this device’s workspace?" : "Load the cloud workspace?", body: "This replaces the other version, not a merge. Export a backup first if you need both copies.", confirmLabel: choice === "local" ? "Keep local version" : "Load cloud version" });
      if (accepted) POS.sync.refresh(choice);
    };
    main.querySelector("#s-sync-local").onclick = () => resolveSync("local");
    main.querySelector("#s-sync-remote").onclick = () => resolveSync("remote");
    const availability = document.createElement("fieldset");
    availability.className = "day-picker settings-days";
    availability.innerHTML = `<legend>Working days</legend>${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => `<label><input type="checkbox" value="${i}" ${(s.workDays || [1, 2, 3, 4, 5]).includes(i) ? "checked" : ""}><span>${d}</span></label>`).join("")}`;
    main.querySelector("#set-work .panel").prepend(availability);
    availability.onchange = event => {
      const days = [...availability.querySelectorAll("input:checked")].map(el => Number(el.value));
      if (!days.length) { event.target.checked = true; ui.toast("Keep at least one working day.", { kind: "danger" }); return; }
      store.actions.updateSettings({ workDays: days });
      ui.toast("Working days saved.");
    };

    /* profile */
    main.querySelector("#s-profile-logout").addEventListener("click", async () => {
      try {
        await POS.cloud.signOut();
        ui.toast("Logged out. Your local workspace is still here.");
      } catch (error) {
        ui.toast(error.message, { kind: "danger" });
      }
    });
    const avatar = main.querySelector("#s-avatar");
    const initialsInput = main.querySelector("#s-initials");
    initialsInput.addEventListener("input", () => {
      avatar.textContent = (initialsInput.value || "—").toUpperCase().slice(0, 3);
    });
    main.querySelector("#s-save-profile").addEventListener("click", () => {
      const name = main.querySelector("#s-name").value.trim();
      const initials = main.querySelector("#s-initials").value.trim().toUpperCase().slice(0, 3) || "OS";
      if (!name) { ui.toast("A profile needs a name.", { kind: "danger" }); return; }
      store.actions.updateSettings({
        name,
        role: main.querySelector("#s-role").value.trim(),
        initials,
      });
      toastSaved("Profile");
    });

    /* work */
    main.querySelector("#s-capacity").addEventListener("change", (e) => {
      const value = U.clamp(Math.round(Number(e.target.value) || 120), 15, 720);
      e.target.value = value;
      store.actions.updateSettings({ capacity: value });
      toastSaved("Daily capacity");
    });
    main.querySelector("#s-focus-length").addEventListener("change", (e) => {
      store.actions.updateSettings({ focusLength: Number(e.target.value) });
      ui.toast("Pomodoro length updated.");
    });
    main.querySelector("#s-quiet").addEventListener("change", (e) => {
      store.actions.updateSettings({ quietHours: e.target.value.trim() || "22:00 – 07:00" });
      ui.toast("Quiet hours updated.");
    });

    /* switches */
    main.querySelectorAll("[data-setting]").forEach((cb) => cb.addEventListener("change", () => {
      store.actions.updateSettings({ [cb.dataset.setting]: cb.checked });
      ui.toast("Preference saved.");
    }));

    /* data */
    const doExport = () => {
      const st2 = store.get();
      const stamp = U.todayISO();
      U.download(`personal-os-backup-${stamp}.json`, JSON.stringify(st2, null, 2), "application/json");
      ui.toast("Backup downloaded. Keep it somewhere you trust.");
    };
    main.querySelector("#s-export").addEventListener("click", doExport);
    main.querySelector("#s-export-2").addEventListener("click", doExport);
    const openImport = () => main.querySelector("#s-import-file").click();
    main.querySelector("#s-import").addEventListener("click", openImport);
    main.querySelector("#s-import-2").addEventListener("click", openImport);
    main.querySelector("#s-import-file").addEventListener("change", (e) => {
      const file = (e.target.files || [])[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onerror = () => ui.toast("That file could not be read. Nothing changed.", { kind: "danger" });
      reader.onload = async () => {
        let parsed;
        try {
          parsed = JSON.parse(String(reader.result));
        } catch (err) {
          ui.toast("That is not valid JSON. Nothing changed.", { kind: "danger" });
          return;
        }
        if (!parsed || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.projects)) {
          ui.toast("That file is not a Personal OS backup. Nothing changed.", { kind: "danger" });
          return;
        }
        const ok = await ui.confirm({
          title: "Import and replace everything?",
          body: `The backup holds ${parsed.tasks.length} tasks, ${parsed.notes ? parsed.notes.length : 0} notes and ${parsed.projects.length} projects. Your current data is replaced. Export first if it matters.`,
          confirmLabel: "Replace my data",
          danger: true,
        });
        if (!ok) return;
        try {
          store.importState(parsed);
          ui.toast("Backup imported. Everything is now the imported version.");
        } catch (err) {
          ui.toast(err.message || "Import failed. Nothing changed.", { kind: "danger" });
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    });

    const reset = async () => {
      const ok = await ui.confirm({
        title: "Clear your workspace?",
        body: "This removes your tasks, projects, mosaic archive and focus sessions from the active workspace, including synced devices. Manual cloud backups are kept. Export a file first; this cannot be undone here.",
        confirmLabel: "Clear workspace",
        danger: true,
      });
      if (!ok) return;
      store.clear();
      store.flush();
      location.hash = "#/today";
      ui.toast("Workspace cleared. Your next plan starts fresh.");
    };
    main.querySelector("#s-reset").addEventListener("click", reset);
    main.querySelector("#s-clear").addEventListener("click", async () => {
      const accepted = await ui.confirm({
        title: "Clear this account's local workspace?",
        body: "This removes this account's tasks, projects, notes, habits and sessions from this browser. Export a backup first if you need them. Your cloud backup is kept.",
        confirmLabel: "Clear local workspace",
        danger: true,
      });
      if (!accepted) return;
      store.clear();
      store.flush();
      location.hash = "#/today";
      ui.toast("Your workspace is empty and ready for a new plan.");
    });

    /* online status */
    const status = main.querySelector("#s-conn-status");
    const sync = () => { if (status) status.textContent = navigator.onLine ? "Online" : "Offline"; };
    window.addEventListener("online", sync, { once: true });
    window.addEventListener("offline", sync, { once: true });
  }

  POS.views = POS.views || {};
  POS.views.settings = { render, destroy() {
    if (unsubscribeCloud) unsubscribeCloud();
    unsubscribeCloud = null;
  } };
})();
