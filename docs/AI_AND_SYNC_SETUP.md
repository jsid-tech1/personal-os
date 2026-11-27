# AI planning and automatic cloud sync

## What works without new credentials

The existing Firebase Google sign-in remains real. Account-local task plans, calendar, completion, weekly artwork archives, focus sessions, preferences, import/export and logout run immediately. Manual planning is explicitly labelled manual, never presented as AI. No new account has fabricated progress.

## Local AI server

1. `npm install` and `npm install --prefix functions`.
2. Copy `.env.example` to `.env` if you do not already have one. Set `DEEPSEEK_API_KEY` and optionally `DEEPSEEK_MODEL` (default `deepseek-flash`). Do not overwrite existing secrets.
3. Firebase Admin verifies Google sign-in tokens against `GCLOUD_PROJECT` (default `personal-os-12b89`). Token verification needs public signing certificates, not a service-account file. If you use Admin operations that require credentials, keep that JSON **outside this repository**. Never place a service account or AI key in `js/firebase-config.js`, browser storage, or a public directory.
4. Restart `npm run dev` and open `http://127.0.0.1:8000`. Do not use a generic static file server: it cannot run the AI endpoint and may expose `.env`.

Open **Goal Breakdown**, describe the goal and context, choose the target date and daily capacity, leave **DeepSeek agent** selected, then choose **Draft the plan**. DeepSeek proposes named milestones and actionable tasks with minute estimates. Choose **On-device templates** for a local, non-AI alternative. Edit the draft, then **Approve & schedule** to save it.

The browser sends a Firebase ID token to same-origin `/api/plan`. The server verifies it with Firebase Admin before contacting DeepSeek. Only the goal description/context and daily capacity go to the provider; existing tasks, calendar dates and the Firebase token do not. JSON-mode output is validated on the server before deterministic local scheduling, and edited dates/capacity are checked again at approval. Nothing is saved until the user explicitly approves. Signing out or switching accounts discards the draft.

Missing keys, provider errors, invalid output and insufficient calendar capacity produce visible messages. On-device templates stay available; failures never silently substitute templates for AI output.

### Run the agent directly

With Node.js 22 or newer, this uses the same server-side agent and the key in `.env`, without Firebase sign-in or saving any tasks:

```sh
npm run agent -- "Build my design portfolio from three existing case studies" --capacity=120
```

It prints JSON containing the goal title and ordered steps, each with `title`, `duration` (minutes) and `milestone`. This makes a real, billable DeepSeek request. Run mock checks without spending credits using `node --test tests/api.test.cjs tests/goal-agent.test.cjs tests/planning.test.cjs`.

## Production Firebase deployment

Cloud Functions requires a Firebase project on the Blaze billing plan and an authorized CLI account. Review provider costs before enabling it.

```
npx firebase-tools login
npx firebase-tools functions:secrets:set DEEPSEEK_API_KEY --project personal-os-12b89
npm run deploy
```

The function `plan` deploys to `us-central1`; Hosting rewrites `/api/plan` to it. Runtime identity uses Firebase-managed credentials. The API rejects unapproved browser origins, checks Firebase ID tokens, bounds input/output, has a 45-second model timeout, limits each warm instance to five requests/user/minute and caps deployment at three instances. For broader public use, add App Check, a distributed quota/budget control and monitoring; the warm-instance limiter alone is not a global abuse-protection service.

## Automatic sync and rules

Create the default Firestore database and deploy the included `firestore.rules`. Automatic state lives at `users/{uid}/state/workspace`. Rules require owner identity, bounded schema/payload, server timestamps and monotonically increasing revisions. All account data (tasks, projects, calendar dates, preferences, focus logs and mosaic archive) is in this versioned document. This single-document design is appropriate to a small personal workspace, not unbounded enterprise history; there is a visible 900 KB limit and JSON export.

On sign-in and window refocus the app reads the account's remote state. Edits save locally immediately and sync automatically after a short debounce. Firestore transactions detect stale revisions. Conflicts pause sync and preserve the local version; Profile provides explicit **Keep this device’s version** and **Load cloud version** actions. These replace, not merge. Export before resolving if both versions matter. An open second device receives updates on refocus rather than through a realtime listener. Reconnect retries sync. Failed configuration never reports a successful cloud save.

Manual backups remain a separate recovery snapshot at `users/{uid}/backups/workspace`, preserving existing data and workflows. Signing out retains the account-scoped local cache; shared-device users should clear site data when necessary. Backups and exports contain personal information.

## Font and artwork

The supplied `Milesdane Trial.otf` license permits personal use only, not commercial or large-audience use. Obtain the appropriate license before publication. `assets/fonts/Read Me.txt` contains the original terms. DM Mono is retained from the existing project. The supplied posters are references only, not bundled assets; mosaic artwork is original deterministic HTML geometry.
