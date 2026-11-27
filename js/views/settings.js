/* Control Centre — the honest switches, and the exit doors. */
(function () {
  "use strict";
  const POS = window.POS;
  const U = POS.util;
  const { icon, esc } = { icon: U.icon, esc: U.escapeHTML };
  const store = POS.store;
  const ui = POS.ui;

  const SECTIONS = [
    ["profile", "Profile"],
    ["work", "Work & planning"],
    ["notifications", "Notifications"],
    ["assistant", "Assistant"],
    ["connections", "Connections"],
    ["data", "Backup & restore"],
    ["privacy", "Privacy & security"],
  ];

  function bytesLabel(n) {
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
    return (n / 1048576).toFixed(2) + " MB";
  }

  function storageSize() {
    try {
      return new Blob([localStorage.getItem("personal-os:v1") || ""]).size;
    } catch (err) {
      return 0;
    }
  }

  function toastSaved(label) {
    ui.toast(label + " saved.");
  }

  function render(main) {
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
            <h1 class="page-title">Control <em>Centre</em></h1>
            <div class="page-sub">
              <span>All settings stay on this device</span>
              <span class="dot-sep">·</span>
              <span class="mono">VERSION 1.0 · LOCAL BUILD</span>
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
              <span class="mono">NO ACCOUNT · NO SERVER</span>
            </div>
          </nav>

          <div class="settings-body">
            <section class="settings-section" id="set-profile">
              <div class="settings-head">
                <h2>Profile</h2>
                <p>Used for greeting copy and the avatar. Nothing is uploaded.</p>
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
                </div>
              </div>
            </section>

            <section class="settings-section" id="set-work">
              <div class="settings-head">
                <h2>Work & planning</h2>
                <p>These numbers feed the local planner, not a preference stored in the cloud.</p>
              </div>
              <div class="panel">
                <div class="rows">
                  <div class="row-item settings-row">
                    <div class="grow">
                      <div class="row-title settings-label">Daily capacity</div>
                      <div class="row-meta">The most focused work a day can hold. The planner stops here.</div>
                    </div>
                    <div class="row gap-2">
                      <input class="input" type="number" id="s-capacity" min="60" max="720" step="15" value="${s.capacity}" style="width:88px;height:30px" aria-label="Daily capacity in minutes" />
                      <span class="mono" style="font-size:10px;color:var(--ink-3)">MIN</span>
                    </div>
                  </div>
                  <div class="row-item settings-row">
                    <div class="grow">
                      <div class="row-title settings-label">Week starts on Monday</div>
                      <div class="row-meta">Calendar and reflection both follow this.</div>
                    </div>
                    <label class="switch">
                      <input type="checkbox" data-setting="weekStartsMonday" ${s.weekStartsMonday ? "checked" : ""} />
                      <span class="track"></span><span class="sr-only">Week starts on Monday</span>
                    </label>
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
                <p>Planning runs on this device. Capture can optionally use DeepSeek for a conversation.</p>
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
                  <p class="field-help">DeepSeek is off by default. Enable it in Capture for the current conversation. No workspace details are shared unless you allow it there.</p>
                </div>
              </div>
            </section>

            <section class="settings-section" id="set-connections">
              <div class="settings-head">
                <h2>Connections</h2>
                <p>Shown honestly. A row marked not connected is not pretending to be.</p>
              </div>
              <div class="panel">
                <div class="rows">
                  ${[
                    ["calendar", "External calendar", "calendar", "Bring in events from Google, Apple or Outlook. Not implemented in this build."],
                    ["backup", "Cloud backup", "cloud", "Keep a copy outside this browser. Not connected; use export instead."],
                    ["sync", "Device sync", "wifi", "Keep two devices in step. No account or sync service exists here."],
                  ].map(([key, label, ico, desc]) => `
                    <div class="row-item settings-row">
                      <span class="settings-conn-icon">${icon(ico)}</span>
                      <div class="grow">
                        <div class="row-title settings-label">${label}</div>
                        <div class="row-meta">${desc}</div>
                      </div>
                      <span class="tag tag-outline tag-mono">NOT CONNECTED</span>
                      <button class="btn btn-sm" disabled title="Not available in this build">Connect</button>
                    </div>`).join("")}
                </div>
                <div class="panel-foot">
                  <div class="spread">
                    <p class="field-help">The local calendar is real and editable. Sync with an outside account is not.</p>
                    <span class="row gap-2 mono" style="font-size:10px;color:var(--ink-3)">
                      <i class="pdot pdot-round" style="--tone:var(--positive)"></i> LOCAL CALENDAR ACTIVE
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section class="settings-section" id="set-data">
              <div class="settings-head">
                <h2>Backup & restore</h2>
                <p>One JSON file holds everything: tasks, projects, notes, habits, sessions and settings.</p>
              </div>
              <div class="panel">
                <div class="panel-body">
                  <div class="data-grid">
                    <div class="data-cell">
                      <span class="stat-label">Stored locally</span>
                      <span class="mono data-num">${bytesLabel(size)}</span>
                      <span class="data-note">${counts.tasks} tasks · ${counts.notes} notes · ${counts.sessions} sessions</span>
                    </div>
                    <div class="data-cell">
                      <span class="stat-label">Projects</span>
                      <span class="mono data-num">${counts.projects}</span>
                      <span class="data-note">${counts.habits} habits · ${counts.dumps} dumps kept</span>
                    </div>
                    <div class="data-cell">
                      <span class="stat-label">Persistence</span>
                      <span class="mono data-num" style="font-size:15px">LOCALSTORAGE</span>
                      <span class="data-note">key personal-os:v1 · this browser only</span>
                    </div>
                  </div>
                  <div class="divider"></div>
                  <div class="data-actions">
                    <button class="btn" id="s-export-2">${icon("download")} Export everything</button>
                    <button class="btn" id="s-import-2">${icon("upload")} Import a backup</button>
                    <button class="btn btn-danger" id="s-reset">${icon("trash")} Reset to sample data</button>
                  </div>
                  <p class="field-help" style="margin-top:12px">Import replaces the current data after a confirmation. Reset throws away your changes and rebuilds the seeded demo.</p>
                </div>
              </div>
            </section>

            <section class="settings-section" id="set-privacy">
              <div class="settings-head">
                <h2>Privacy & security</h2>
                <p>Your saved workspace stays in this browser. DeepSeek is optional.</p>
              </div>
              <div class="panel">
                <div class="panel-body">
                  <dl class="def settings-def">
                    <dt>Where data lives</dt>
                    <dd><span class="value">localStorage</span>, on this device, under one key. No account sync or analytics.</dd>
                    <dt>Who can read it</dt>
                    <dd>Anyone with access to this browser profile and this device. A passcode or device lock is the real protection.</dd>
                    <dt>Network use</dt>
                    <dd>On-device planning works offline. DeepSeek needs a connection and is only used when you turn it on.</dd>
                    <dt>AI processing</dt>
                    <dd>With DeepSeek on, submitted messages and recorded turns go to DeepSeek. The app doesn’t save audio. Workspace details require a separate opt-in.</dd>
                    <dt>What removes it</dt>
                    <dd>Reset below, importing a backup, or clearing site data in the browser. Export first if it matters.</dd>
                  </dl>
                  <div class="divider"></div>
                  <div class="spread">
                    <div class="row gap-2" style="color:var(--ink-2);font-size:12px">${icon("lock")} There is no password to set in this build.</div>
                    <button class="btn btn-danger btn-sm" id="s-clear">${icon("trash")} Clear all local data</button>
                  </div>
                </div>
              </div>
            </section>

            <p class="settings-foot mono">
              PERSONAL OS · VERSION 1.0 · LOCAL WORKSPACE · BUILT ${new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>`;

    /* section nav */
    main.querySelectorAll("[data-section]").forEach((a) => a.addEventListener("click", (e) => {
      e.preventDefault();
      const target = main.querySelector("#set-" + a.dataset.section);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    }));

    /* profile */
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
      const value = U.clamp(Number(e.target.value) || 300, 60, 720);
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
        title: "Reset to sample data?",
        body: "Every task, project, note, habit and session you have changed will be replaced by the seeded demo. This cannot be undone unless you exported a backup.",
        confirmLabel: "Reset everything",
        danger: true,
      });
      if (!ok) return;
      store.reset();
      ui.toast("Reset to the seeded demo.");
    };
    main.querySelector("#s-reset").addEventListener("click", reset);
    main.querySelector("#s-clear").addEventListener("click", reset);

    /* online status */
    const status = main.querySelector("#s-conn-status");
    const sync = () => { if (status) status.textContent = navigator.onLine ? "Online" : "Offline"; };
    window.addEventListener("online", sync, { once: true });
    window.addEventListener("offline", sync, { once: true });
  }

  POS.views = POS.views || {};
  POS.views.settings = { render };
})();
