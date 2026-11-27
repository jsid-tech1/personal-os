# AI planning and automatic cloud sync

## Project conversation and voice

In Add task, expand **Talk through your project**. Send typed messages or use **Start microphone** to dictate, review the transcript, then send it. The AI asks contextual follow-ups and maintains a running editable brief. **Use this brief for my plan** copies it into the planning form; generation, review and explicit approval still happen separately. No conversation message creates tasks by itself.

Conversation uses the same authenticated `/api/plan` endpoint with `mode: conversation` and the existing server-only OpenAI configuration. It is bounded to eight exchanges and ten total API requests/user/minute per warm instance. The transcript is ephemeral, cleared on closing the planner, and not written to the account database. Only messages explicitly sent go to OpenAI. Browser dictation may use the browser vendor's remote speech service. Supported browsers require microphone permission and HTTPS or localhost; unsupported/denied/error cases retain typing. **Read reply aloud** and **Stop reading** provide optional browser speech playback. Closing the planner or signing out stops capture/playback and aborts pending requests. Automated voice tests simulate recognition; real microphone accuracy is device/browser-dependent.

Latest typography uses Neue Montreal for interface copy and numeric information, retaining MilesDane display headings. The supplied Neue Montreal demo archive contains no license document; verify the appropriate license before publication.

## What works without new credentials

The existing Firebase Google sign-in remains real. Account-local task plans, calendar, completion, weekly artwork archives, focus sessions, preferences, import/export and logout run immediately. Manual planning is explicitly labelled manual, never presented as AI. No new account has fabricated progress.

## Local AI server

1. `npm install` and `npm install --prefix functions`.
2. Copy `.env.example` to `.env`. Set `OPENAI_API_KEY` and optionally `OPENAI_MODEL` (default `gpt-4.1-mini`).
3. Provide Firebase Admin application-default credentials, or set `GOOGLE_APPLICATION_CREDENTIALS` to a service account JSON **outside this repository**. Never place a service account or AI key in `js/firebase-config.js`, browser storage, or a public directory.
4. Restart `npm run dev` and open `http://localhost:8000`.

The browser sends a Firebase ID token to same-origin `/api/plan`. The server verifies it with Firebase Admin before contacting OpenAI. Only the task description and daily capacity go to the AI provider. The response must match a strict schema and is validated again before deterministic scheduling. The user reviews, edits and explicitly approves before any task is saved.

Missing credentials, provider errors, invalid output and insufficient calendar capacity produce visible messages. Manual creation stays available. Local verification uses mocked network boundaries; a paid live model call cannot be verified without a configured key.

## Production Firebase deployment

Cloud Functions requires a Firebase project on the Blaze billing plan and an authorized CLI account. Review provider costs before enabling it.

```
npx firebase-tools login
npx firebase-tools functions:secrets:set OPENAI_API_KEY --project personal-os-12b89
npm run deploy
```

The function `plan` deploys to `us-central1`; Hosting rewrites `/api/plan` to it. Runtime identity uses Firebase-managed credentials. The API rejects unapproved browser origins, checks Firebase ID tokens, bounds input/output, has a 45-second model timeout, limits each warm instance to ten requests/user/minute and caps deployment at three instances. For broader public use, add App Check, a distributed quota/budget control and monitoring; the warm-instance limiter alone is not a global abuse-protection service.

## Automatic sync and rules

Create the default Firestore database and deploy the included `firestore.rules`. Automatic state lives at `users/{uid}/state/workspace`. Rules require owner identity, bounded schema/payload, server timestamps and monotonically increasing revisions. All account data (tasks, projects, calendar dates, preferences, focus logs and mosaic archive) is in this versioned document. This single-document design is appropriate to a small personal workspace, not unbounded enterprise history; there is a visible 900 KB limit and JSON export.

On sign-in and window refocus the app reads the account's remote state. Edits save locally immediately and sync automatically after a short debounce. Firestore transactions detect stale revisions. Conflicts pause sync and preserve the local version; Profile provides explicit **Keep this device’s version** and **Load cloud version** actions. These replace, not merge. Export before resolving if both versions matter. An open second device receives updates on refocus rather than through a realtime listener. Reconnect retries sync. Failed configuration never reports a successful cloud save.

Manual backups remain a separate recovery snapshot at `users/{uid}/backups/workspace`, preserving existing data and workflows. Signing out retains the account-scoped local cache; shared-device users should clear site data when necessary. Backups and exports contain personal information.

## Font and artwork

The supplied `Milesdane Trial.otf` license permits personal use only, not commercial or large-audience use. Obtain the appropriate license before publication. `assets/fonts/Read Me.txt` contains the original terms. Neue Montreal replaces DM Mono in the current interface; confirm the demo font's licensing separately. The supplied posters are references only, not bundled assets; mosaic artwork is original deterministic HTML geometry.
