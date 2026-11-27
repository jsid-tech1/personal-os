# Firebase connection

For the Vercel production site, see [Personal OS on Vercel](docs/vercel.md).

Project: **personal-os-12b89**. Web SDK: **13.4.0**.
Configuration is in `js/firebase-config.js`; the connection is in `js/cloud.js`.

## Enable the services in Firebase Console

1. Open [Authentication](https://console.firebase.google.com/project/personal-os-12b89/authentication/providers).
   Get started if needed, enable **Google** under **Sign-in method**, select a support email,
   and save.
2. In Authentication → Settings → Authorized domains, add **localhost** for local development.
   Add `127.0.0.1` if you use that address, and your deployed hostname when hosting the app.
3. Open [Cloud Firestore](https://console.firebase.google.com/project/personal-os-12b89/firestore).
   Create a **Standard edition**, **(default)** database, choose its region, and use production mode.
4. Publish the contents of `firestore.rules` in Firestore → Rules. Alternatively deploy the
   checked-in rules and payload index exemption with the Firebase CLI:

   ```powershell
   npx firebase-tools login
   npx firebase-tools deploy --only firestore --project personal-os-12b89
   ```

The web configuration cannot enable these services or publish database rules. These steps
require access to the Firebase project. Do not enable public read/write rules.

## Use it

Serve the app with `npm run dev`, then open
[Personal OS](http://localhost:8000) and choose **Continue with Google** on the welcome screen.
Google sign-in is required; there is no guest bypass. New accounts are created on first sign-in.
Returning Firebase sessions open the requested route automatically after authentication resolves.
Signing out from Settings returns to welcome and closes workspace dialogs and shortcuts.

The development server sends `Cache-Control: no-store` for all runtime files. Entry scripts and
styles also have versioned URLs; production builds replace these with content hashes. This avoids
mixing new HTML with old cached sign-in scripts or landing styles.

Authentication initializes separately from Firestore. Loading and session checks time out after
12 seconds with a Retry connection action. A blocked popup offers **Sign in in this tab** using
Firebase's redirect flow; popup sign-in remains the default. Browsers restricting cross-site auth
storage may still need popups enabled for localhost. Missing workspace scripts show a reload action.

After signing in, open **Settings → Connections** for cloud backup controls.

- **Save cloud backup** uploads the current local workspace and replaces this account's previous snapshot.
- **Restore cloud backup** reads this account's snapshot and asks before replacing the local workspace.
- On a second device, sign in with the same Google account and restore the backup.
- Local edits save automatically to the browser, but cloud saving is **manual**, not live sync.
- Signing in never uploads work. Each account opens its own local workspace. Signing out keeps that account's local copy.
- File export/import remains available in an already open signed-in workspace, even if the network disconnects.

## Storage and access

Each account owns `users/{firebaseAuthUid}/backups/workspace`. The document contains:

| Field | Value |
| --- | --- |
| `schemaVersion` | `1` |
| `payload` | JSON-serialized Personal OS workspace |
| `updatedAt` | Firestore server timestamp |

JSON preserves nested app data, including arrays inside arrays. The app limits a snapshot to
900 KB to stay below Firestore's 1 MiB document limit. Larger workspaces can still be exported
as files. The payload is excluded from indexing; backup history and per-item queries are not
implemented. Each save replaces the snapshot, so simultaneous saves are last-write-wins.

Rules require an authenticated owner, validate the document envelope, and deny all other
paths. Firebase administrators retain administrative access. Test rules in the Firebase Rules
Playground with signed-out, owner and other-user identities before deploying changes.

Google authentication persists through the Firebase SDK's browser storage. App state uses
`personal-os:v1:user:{encodedFirebaseUid}`; appearance remains device-local in `personal-os:theme`. Signing out does
not remove local data. Reset and import affect local data; they do not modify a cloud backup
until Save cloud backup is chosen.

An existing legacy `personal-os:v1` workspace is adopted once by the first account to sign in;
`personal-os:v1:owner` records the migration. The legacy key is retained as a recovery copy.
Subsequent accounts open their own saved workspace or a new empty one. Local storage is not encrypted.

## Deploy the public product and landing page

```powershell
npm run build
npx firebase-tools login
npm run deploy
```

`scripts/build.cjs` copies only runtime files (`index.html`, `css`, `js`, `assets`) to `dist/`.
Firebase Hosting serves that folder. Documentation, source-page archives, tests and development
tools are not published. Hash routes work from the same entry page without a server rewrite.
The deploy command publishes Hosting plus the existing Firestore rules/index exemption.

Expected default Hosting address: `https://personal-os-12b89.web.app` (use the URL printed by
the successful deploy). In the 27 November 2026 session this address returned **404**, and no
Firebase CLI login was present in the standard Windows location. Publishing is still required.
Enable Google, create the database and check the deployed hostname in Authorized domains.
Then perform a real sign-in, save and cross-device restore on the HTTPS URL, including a phone.

## Analytics

The supplied measurement ID (`G-DR6N5VGN0S`) initializes Firebase Analytics when supported.
The app adds no custom events containing tasks, notes or workspace content. Default Analytics
usage events are separate from Firestore backups. Analytics being blocked does not prevent
local work, sign-in, or cloud backup.

## Troubleshooting

- **Unauthorized domain:** add the current hostname under Authentication → Settings.
- **Operation not allowed / configuration not found:** enable the Google auth provider.
- **Permission denied:** publish the checked-in rules for this project and sign in again.
- **Database not found / failed precondition:** create the `(default)` Firestore database.
- **Popup blocked:** allow pop-ups for this site and click Continue with Google again.
- **Connecting to Google:** wait for the button to read Continue with Google; it connects on load. If loading stalls, the timeout exposes Retry connection rather than leaving the button disabled.
- **No cloud backup:** save one from the original device using the same Google account.
- **Connection unavailable at startup:** check the network, then use Retry connection. Saved local data is retained while the workspace stays closed.

Firebase sign-in requires HTTP(S); use localhost rather than opening `index.html` directly.
This is a UI entry gate, not encryption of localStorage. Browser-profile access still exposes
the saved local copy. Firestore authorization is enforced separately by the published rules.

## Development checks

`npm install` installs Playwright for tests; the app itself has no build step. Run `npm test`
for browser integration checks covering required sign-in, session restoration, sign-out,
route/shortcut gating, scoped backup paths, confirmed restore,
account changes, concurrent local edits, malformed/oversized data, permissions, offline work,
SDK/Analytics failure, first-task onboarding, empty views, account-local isolation, local storage failure and mobile layout. Tests replace Firebase's SDK network boundary with deterministic
modules and never write production data. Windows tests use installed Microsoft Edge; on other
platforms run `npx playwright install chromium` first. `PLAYWRIGHT_CHANNEL` can select a browser.

Live SDK initialization is separate from an authenticated database read/write. Complete the
console setup above and save/restore a backup with your Google account to verify the deployed
rules and database end to end.

To regenerate the landing screenshot from the app's real opt-in sample workspace:

```powershell
$env:UPDATE_PRODUCT_PREVIEW = '1'
npm test
Remove-Item Env:UPDATE_PRODUCT_PREVIEW
```

The optional screenshot test writes a 1440 × 760 capture to `assets/product-today.png`; normal test runs leave it alone.
Course documentation starts at `docs/final-project-plan.md`.
