/* Firebase cloud snapshots. Local edits remain local until Save cloud backup is used. */
(function () {
  "use strict";
  const POS = window.POS;
  const SDK = "https://www.gstatic.com/firebasejs/13.4.0/";
  const MAX_BYTES = 900000;
  let authSDK, dbSDK, auth, db, app;
  let starting = null;
  let databaseStarting = null;
  let startAttempt = 0;
  let stopAuthObserver = null;
  let accountVersion = 0;
  const listeners = new Set();
  const status = { ready: false, user: null, busy: null, error: "", errorCode: "", lastSaved: null };

  function withTimeout(promise, milliseconds, text) {
    let timer;
    return Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(text)), milliseconds); }),
    ]).finally(() => clearTimeout(timer));
  }

  async function connectDatabase() {
    if (db) return;
    if (!databaseStarting) {
      databaseStarting = withTimeout(import(SDK + "firebase-firestore-lite.js"), 15000,
        "Cloud backup took too long to connect. Your local work is available; try saving again.")
        .then(module => { dbSDK = module; db = dbSDK.getFirestore(app); })
        .finally(() => { databaseStarting = null; });
    }
    await databaseStarting;
  }

  function getStatus() {
    return { ...status, user: status.user ? { ...status.user } : null };
  }

  function update(patch) {
    Object.assign(status, patch);
    listeners.forEach((fn) => fn(getStatus()));
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function message(error) {
    const code = String(error.code || "").replace(/^firestore\//, "");
    const messages = {
      "auth/operation-not-allowed": "Enable Google sign-in in Firebase Console → Authentication → Sign-in method.",
      "auth/configuration-not-found": "Set up Firebase Authentication and enable the Google provider in Firebase Console.",
      "auth/unauthorized-domain": "Add this hostname to Firebase Authentication → Settings → Authorized domains.",
      "auth/popup-blocked": "Allow pop-ups for this site, then choose Continue with Google again.",
      "auth/popup-closed-by-user": "Sign-in was cancelled. Choose Continue with Google to try again.",
      "auth/cancelled-popup-request": "Another sign-in window is already open. Finish that sign-in first.",
      "auth/network-request-failed": "Google sign-in could not connect. Check your connection and try again.",
      "auth/web-storage-unsupported": "This browser blocks the storage Google sign-in needs. Allow site data or try another browser.",
      "auth/operation-not-supported-in-this-environment": "Google sign-in cannot open here. Open Personal OS in a regular browser tab.",
      "auth/invalid-api-key": "The Firebase API key was rejected. Check js/firebase-config.js against Firebase Console.",
      "permission-denied": "Firestore access was denied. Publish firestore.rules for personal-os-12b89 and sign in again.",
      "failed-precondition": "Create the default Cloud Firestore database in Firebase Console, then try again.",
      "not-found": "The Firestore database was not found. Create the default database in Firebase Console.",
      "unavailable": "Firestore is unavailable. Your local work is safe; check your connection and retry.",
      "resource-exhausted": "The Firebase quota is exhausted. Your local workspace is still available.",
      "unauthenticated": "Your Firebase session expired. Sign out and sign in again.",
    };
    return messages[code] || error.message || "Firebase could not complete the request. Try again.";
  }

  function validateWorkspace(data) {
    const arrays = ["tasks", "projects", "events", "habits", "notes", "brainDumps", "notifications", "focusSessions"];
    const objects = ["settings", "profile", "reflection", "plans", "proposals"];
    const object = (v) => v && typeof v === "object" && !Array.isArray(v);
    if (!object(data) || data.version !== 1 ||
        arrays.some((key) => !Array.isArray(data[key]) || data[key].some((item) => !object(item))) ||
        objects.some((key) => !object(data[key])) || !Array.isArray(data.reflection.wins) ||
        typeof data.settings.name !== "string" ||
        data.tasks.some((t) => typeof t.id !== "string" || typeof t.title !== "string") ||
        data.projects.some((p) => typeof p.id !== "string" || typeof p.name !== "string" || !Array.isArray(p.milestones)) ||
        data.notes.some((n) => typeof n.title !== "string" || typeof n.body !== "string" || !Array.isArray(n.tags)) ||
        data.habits.some((h) => typeof h.name !== "string" || !object(h.log))) {
      throw new Error("This cloud backup is not a supported Personal OS workspace. Nothing was replaced.");
    }
    if (data.mosaics !== undefined && (!object(data.mosaics) || Object.entries(data.mosaics).some(([week, record]) =>
      !/^\d{4}-\d{2}-\d{2}$/.test(week) || !object(record) || !Array.isArray(record.taskIds) || record.taskIds.some(id => typeof id !== "string")))) {
      throw new Error("The mosaic archive is not valid. Nothing was replaced.");
    }
    return data;
  }

  function requireAccount() {
    if (!navigator.onLine) throw new Error("You're offline. Reconnect to use cloud backup; local saving still works.");
    if (!auth || !auth.currentUser) throw new Error("Sign in with Google to use cloud backup.");
    const uid = auth.currentUser.uid;
    const version = accountVersion;
    return {
      get ref() { return dbSDK.doc(db, "users", uid, "backups", "workspace"); },
      check() {
        if (version !== accountVersion || auth.currentUser?.uid !== uid) {
          throw new Error("The signed-in account changed. Try again with the current account.");
        }
      },
    };
  }

  async function run(busy, action) {
    if (status.busy) throw new Error("Wait for the current Firebase request to finish.");
    update({ busy, error: "", errorCode: "" });
    try {
      return await action();
    } catch (error) {
      const text = message(error);
      update({ error: text, errorCode: error.code || "" });
      throw new Error(text);
    } finally {
      update({ busy: null });
    }
  }

  function start() {
    if (status.ready) return Promise.resolve(true);
    if (starting) return starting;
    const attempt = ++startAttempt;
    update({ busy: "loading", error: "", errorCode: "" });
    starting = (async () => {
      try {
        if (location.protocol === "file:") throw new Error("Open Personal OS from its local server (node server.mjs) to use Google sign-in. Your saved work is still on this device.");
        const retry = attempt > 1 ? "?retry=" + attempt : "";
        const [appSDK, authModule] = await withTimeout(Promise.all([
          import(SDK + "firebase-app.js"),
          import(SDK + "firebase-auth.js" + retry),
        ]), 12000, "Google sign-in took too long to load. Check your connection, then choose Retry connection.");
        authSDK = authModule;
        app = appSDK.getApps().length ? appSDK.getApp() : appSDK.initializeApp(POS.firebaseConfig);
        auth = authSDK.getAuth(app);
        await withTimeout(auth.authStateReady(), 12000,
          "Your Google session took too long to load. Choose Retry connection to try again.");
        // Read redirect failures too; otherwise a rejected redirect appears to do nothing.
        await withTimeout(authSDK.getRedirectResult(auth), 12000,
          "Google could not finish returning to the app. Choose Retry connection.");
        if (stopAuthObserver) stopAuthObserver();
        stopAuthObserver = authSDK.onAuthStateChanged(auth, (user) => {
          accountVersion++;
          update({
            user: user ? { uid: user.uid, email: user.email, name: user.displayName, photoURL: user.photoURL || "" } : null,
            lastSaved: null,
          });
        });
        update({ ready: true, busy: null, error: "", errorCode: "" });
        return true;
      } catch (error) {
        update({ ready: false, busy: null, error: message(error), errorCode: error.code || "" });
        return false;
      } finally {
        starting = null;
      }
    })();
    return starting;
  }

  function signIn() {
    return run("signing-in", async () => {
      if (!status.ready) throw new Error("Firebase is not ready. Choose Retry connection first.");
      if (!navigator.onLine) throw new Error("Reconnect to sign in with Google.");
      const provider = new authSDK.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await authSDK.signInWithPopup(auth, provider);
    });
  }

  function signOut() {
    return run("signing-out", async () => {
      if (!auth || !auth.currentUser) return;
      await authSDK.signOut(auth);
      // Local workspace is deliberately retained. Signing out never deletes work.
    });
  }

  function signInRedirect() {
    return run("redirecting", async () => {
      if (!status.ready) throw new Error("Choose Retry connection before signing in.");
      if (!navigator.onLine) throw new Error("Reconnect to sign in with Google.");
      const provider = new authSDK.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await authSDK.signInWithRedirect(auth, provider);
    });
  }

  function saveBackup() {
    return run("saving", async () => {
      const account = requireAccount();
      await connectDatabase();
      account.check();
      POS.store.flush();
      const payload = JSON.stringify(validateWorkspace(POS.store.get()));
      if (new TextEncoder().encode(payload).length > MAX_BYTES) {
        throw new Error("This workspace exceeds the 900 KB cloud backup limit. Use Export backup to save it as a file.");
      }
      await dbSDK.setDoc(account.ref, { schemaVersion: 1, payload, updatedAt: dbSDK.serverTimestamp() });
      account.check();
      update({ lastSaved: new Date().toISOString() });
    });
  }

  function restoreBackup(confirm) {
    return run("restoring", async () => {
      const account = requireAccount();
      const localBefore = JSON.stringify(POS.store.get());
      await connectDatabase();
      account.check();
      const snapshot = await dbSDK.getDoc(account.ref);
      account.check();
      if (!snapshot.exists()) throw new Error("No cloud backup exists for this Google account. Save one from your original device first.");
      const backup = snapshot.data();
      if (backup.schemaVersion !== 1 || typeof backup.payload !== "string") {
        throw new Error("This cloud backup format is not supported. Nothing was replaced.");
      }
      let data;
      try { data = JSON.parse(backup.payload); } catch (error) {
        throw new Error("This cloud backup could not be read. Nothing was replaced.");
      }
      validateWorkspace(data);
      const accepted = await confirm(data);
      if (!accepted) return false;
      account.check();
      if (JSON.stringify(POS.store.get()) !== localBefore) {
        throw new Error("Your local workspace changed while restoring. Try Restore cloud backup again.");
      }
      POS.store.importState(data);
      POS.store.flush();
      return true;
    });
  }

  async function token() {
    if (!auth?.currentUser) throw new Error("Sign in to generate a plan.");
    return auth.currentUser.getIdToken();
  }

  async function readWorkspace() {
    const account = requireAccount();
    const uid = auth.currentUser.uid;
    await connectDatabase();
    account.check();
    const ref = dbSDK.doc(db, "users", uid, "state", "workspace");
    const snapshot = await withTimeout(dbSDK.getDoc(ref), 20000, "Cloud sync took too long. Your work is saved on this device; retry in Profile.");
    account.check();
    if (!snapshot.exists()) return { revision: 0, data: null };
    const saved = snapshot.data();
    if (!Number.isInteger(saved.revision) || saved.revision < 1 || typeof saved.payload !== "string") throw new Error("The cloud workspace format is invalid. Export your local copy before recovery.");
    return { revision: saved.revision, data: validateWorkspace(JSON.parse(saved.payload)) };
  }

  async function writeWorkspace(data, revision) {
    const account = requireAccount();
    const uid = auth.currentUser.uid;
    const payload = JSON.stringify(validateWorkspace(data));
    if (new TextEncoder().encode(payload).length > MAX_BYTES) throw new Error("Workspace exceeds the 900 KB cloud limit. Export a backup from Profile.");
    await connectDatabase();
    account.check();
    const ref = dbSDK.doc(db, "users", uid, "state", "workspace");
    await withTimeout(dbSDK.runTransaction(db, async transaction => {
      const snapshot = await transaction.get(ref);
      const current = snapshot.exists() ? snapshot.data().revision : 0;
      if (current !== revision) throw new Error("Another device changed this workspace. Resolve the conflict in Profile before syncing.");
      account.check();
      transaction.set(ref, { schemaVersion: 1, payload, revision: revision + 1, updatedAt: dbSDK.serverTimestamp() });
    }), 25000, "Cloud save took too long. Your local copy is safe. Retry cloud sync in Profile.");
    account.check();
    return revision + 1;
  }

  POS.cloud = { start, getStatus, subscribe, signIn, signInRedirect, signOut, saveBackup, restoreBackup, validateWorkspace, token, readWorkspace, writeWorkspace };
})();
