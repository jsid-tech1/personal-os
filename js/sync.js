/* Local-first automatic sync with optimistic revisions. Conflicts never silently replace work. */
(function () {
  "use strict";
  const POS = window.POS;
  let uid = null, epoch = 0, revision = 0, dirty = false, importing = false, working = false, timer;
  let state = { text: "Saved on this device", error: "", ready: false };
  function publish(patch) {
    state = { ...state, ...patch };
    document.querySelectorAll("[data-sync-status]").forEach(el => {
      el.textContent = el.classList.contains("sidebar-sync") && state.error ? "Cloud unavailable · saved locally" : state.error || state.text;
    });
    window.dispatchEvent(new Event("pos:sync"));
  }
  function remember() { try { localStorage.setItem("personal-os:sync:" + uid, JSON.stringify({ revision, dirty })); } catch { /* Store handles quota recovery. */ } }
  function changed() {
    if (!uid || importing) return;
    dirty = true;
    remember();
    publish({ text: "Changes saved locally; syncing…" });
    clearTimeout(timer);
    timer = setTimeout(save, 800);
  }
  async function activate(user) {
    if (uid === user?.uid) return;
    epoch++;
    uid = user?.uid || null;
    revision = 0; dirty = false; working = false;
    clearTimeout(timer);
    if (!uid) { publish({ text: "Signed out", error: "", ready: false }); return; }
    try {
      const saved = JSON.parse(localStorage.getItem("personal-os:sync:" + uid));
      revision = saved?.revision || 0;
      dirty = saved ? !!saved.dirty : !!(POS.store.get().tasks.length || POS.store.get().projects.length || POS.store.get().focusSessions.length || POS.store.get().notes.length);
    } catch { dirty = true; /* An unreadable sync marker must never permit silent replacement. */ }
    publish({ text: "Connecting cloud storage…", error: "", ready: false });
    await refresh();
  }
  async function refresh(choice) {
    if (!uid || working) return;
    const run = epoch;
    working = true;
    const before = JSON.stringify(POS.store.get());
    try {
      const remote = await POS.cloud.readWorkspace();
      if (run !== epoch) return;
      if (remote.data && (remote.revision !== revision || choice === "remote")) {
        if ((dirty || before !== JSON.stringify(POS.store.get())) && !choice) throw new Error("Another device has changes. Choose which workspace to keep in Profile. Your local copy is untouched.");
        if (choice !== "local") {
          importing = true;
          try { POS.store.importState(remote.data); POS.store.flush(); } finally { importing = false; }
          dirty = false;
        }
      }
      revision = remote.revision;
      if (!remote.data) dirty = true;
      if (choice === "local") dirty = true;
      remember();
      publish({ ready: true, error: "", text: "Cloud connected" });
    } catch (error) { if (run === epoch) publish({ ready: false, error: error.message, text: "Saved on this device" }); }
    finally { if (run === epoch) { working = false; if (state.ready && dirty) save(); } }
  }
  async function save() {
    if (!uid || working || !state.ready || !dirty) return;
    const run = epoch, payload = JSON.stringify(POS.store.get());
    working = true;
    publish({ text: "Syncing…", error: "" });
    try {
      const next = await POS.cloud.writeWorkspace(JSON.parse(payload), revision);
      if (run !== epoch) return;
      revision = next;
      dirty = JSON.stringify(POS.store.get()) !== payload;
      remember();
      publish({ text: dirty ? "Syncing newer changes…" : "Saved across devices", error: "" });
    } catch (error) { if (run === epoch) publish({ ready: false, error: error.message, text: "Saved on this device" }); }
    finally { if (run === epoch) { working = false; if (dirty && state.ready) timer = setTimeout(save, 800); } }
  }
  POS.store.subscribe(changed);
  window.addEventListener("online", () => refresh());
  window.addEventListener("focus", () => { if (uid) refresh(); });
  POS.sync = { activate, refresh, save, status: () => ({ ...state }) };
})();
