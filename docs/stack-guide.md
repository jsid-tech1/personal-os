# Personal OS — explain the stack

## Where does the data live?

- **Running tab:** `POS.store` in `js/store.js` is the source of truth. Screens read it and call its actions.
- **This browser:** state is serialized to localStorage after a short debounce (180 ms). Each Google UID has a different key: `personal-os:v1:user:{encodedUid}`. Appearance uses `personal-os:theme`.
- **Legacy work:** an old `personal-os:v1` workspace is adopted once by the first account that signs in after this change. `personal-os:v1:owner` records that claim. The original key stays as a recovery copy. Later accounts start separately.
- **Cloud:** Save cloud backup writes one document at `users/{firebaseAuthUid}/backups/workspace`. Fields: `schemaVersion: 1`, JSON `payload`, Firestore server `updatedAt`. Payload is excluded from indexing and capped at 900 KB by the client.
- **Another device:** sign in with the same account, open Settings and choose Restore cloud backup. It asks before replacing local work. There is no automatic background sync or merge.
- **No password in the app:** Google/Firebase manage credentials and browser session persistence.

## What happens when I click?

### Continue with Google

1. `js/welcome.js` calls `POS.cloud.signIn()`.
2. Firebase opens Google's account chooser using `signInWithPopup`.
3. Firebase's auth observer supplies a verified UID, email and display name.
4. `syncAuth` activates that UID's local workspace before rendering any app content.
5. A new workspace uses the account's display name and empty lists. Today shows the first-task guide. Returning sessions keep the requested hash route.

### Add my first task

1. `js/onboarding.js` validates the title and reads date and duration.
2. `store.actions.addTask` gives the task an ID and defaults.
3. The store notifies subscribers. Today shows the task, load and progress.
4. The store persists to this account's local key. Storage failures show a persistent message with retry and export controls.

### Plan my day / complete a task

The Planner uses local deterministic rules in `js/ai.js` to draft a plan. The user approves proposals. Completing a task updates `done` and `completedAt`, redraws Today and saves locally. No language model is called.

### Save cloud backup

1. Check network and the current Firebase user.
2. Flush local state, validate it, serialize JSON and enforce the size limit.
3. `setDoc` writes this UID's snapshot with a server timestamp.
4. Firestore evaluates the deployed rules using `request.auth.uid`.
5. Show success only after the write resolves and the account is still the same.

### Restore cloud backup

Read that UID's document, validate it, show a replacement confirmation, then replace local state. If identity or local state changes during the request/confirmation, restoration aborts. Cancel leaves local data intact.

## How does the app know who I am?

Firebase Authentication maintains the session. The UI gate listens to its auth state; it does not accept an email typed into a profile as identity. Profile name and initials are display preferences. Firestore uses the Firebase UID, not the editable profile or email, for authorization.

The local gate is not encryption. Someone with access to a browser profile/devtools can inspect local data, including signed-out accounts. Published database rules protect the cloud separately. Project administrators have administrative access.

## What runs on a server?

Firebase Hosting serves static runtime files. Firebase Authentication verifies identity. Cloud Firestore stores snapshots and enforces rules. There is no app-owned Node server in production. The Python development server and Node build/test tools are development-only.

## What is deliberately limited?

- Saving a snapshot replaces the previous cloud snapshot; no history or conflict merging.
- Local changes are automatic; cloud saving is explicit. Multi-tab edits are not synchronized.
- A fresh launch needs the Firebase SDK and auth to load. An already-open authenticated tab can keep working offline. This is not a service-worker offline application.
- Existing assistant features are rules-based demos, not generative AI.
- External calendar integration is not connected.
- Firebase Analytics may initialize; blocking Analytics does not block the product. Task content is not put into custom analytics events.

## Files to point at during Q&A

| Question | File |
| --- | --- |
| What loads in the browser? | `index.html` |
| How do screens change? | `js/app.js` hash router |
| How does new-user onboarding work? | `js/onboarding.js`, `js/data.js` |
| Where does a task save? | `js/store.js` |
| How do sign-in and backup work? | `js/cloud.js` |
| Who can access cloud data? | `firestore.rules` |
| Where does the planner logic run? | `js/ai.js` |
| What is deployed? | `scripts/build.cjs`, `firebase.json` |
| What is tested versus real? | `tests/cloud.test.cjs`, `FIREBASE_SETUP.md` |
