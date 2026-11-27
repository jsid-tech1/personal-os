# Personal OS — Product

**One line:** A daily planner for design students managing coursework and portfolio deadlines.

**Promise:** It doesn't just remember what you want to do. It figures out how you can get it done.

## Who it's for

The initial reachable audience is design students in the team's class, working alone with several live goals
(portfolio, client work, applications) and no project manager. They think in paragraphs, not
fields. They open the app in the morning to decide what matters, and in the evening to close
the loop.

## The loop

CAPTURE → UNDERSTAND → BREAK DOWN → ORGANISE → SCHEDULE → EXECUTE → TRACK → ADAPT

1. **Capture** — one free-text box. Send a thought or question to start a conversation. Local
   dictation and read-aloud are optional when the browser supports them. Plain-text files can
   be inserted into a message.
2. **Understand** — the assistant proposes tasks, goals, projects, notes, dates. Everything is
   editable before it is saved.
3. **Break down** — a goal becomes milestones, milestones become tasks with estimates and
   dependencies, and a draft schedule.
4. **Schedule** — drafts land on the calendar as *proposed*, never as fact. Approve, edit, or
   reject, per item.
5. **Execute** — Today, Focus Mode, habits.
6. **Adapt** — missed work produces a rescheduling proposal with an impact summary; nothing
   moves until the user approves.

## Rules the product keeps

- The assistant proposes; the user decides. No silent edits, moves or deletes.
- Proposed and existing are visually distinct, always.
- Every control does what it says. No decorative buttons.
- **Google sign-in is the front door.** The workspace stays hidden until Firebase resolves the
  session. Returning sessions open the requested screen; signing out closes the workspace and
  returns to the welcome page. Google manages passwords and account recovery.
- **New accounts start empty**, using the Google display name. There is no demo persona, no
  sample tasks and no seeded project data. The first-run guide offers one real task and an
  explicit cloud backup.
- **Data is isolated by Google user ID** in account-scoped localStorage. Signing out keeps the
  local copy but hides it. Switching accounts loads that account's own workspace.
- **On-device** is the default assistant. Planning and rescheduling use local rules. In Capture,
  the user can opt in to DeepSeek for general chat, turn-based voice, and drafts. See
  [DeepSeek setup](DEEPSEEK.md). Workspace access is a separate choice.
- **Cloud saving is manual.** One recovery snapshot per Google account in Cloud Firestore.
  Sign-in does not upload the workspace, and there is no analytics. File export/import and
  backup/restore are real.
- External calendar sync remains **not connected**. It is labelled, not faked.
- Offline-first: on-device planning and saved work remain usable without a connection. A fresh
  sign-in needs the network. Fonts are self-hosted.

## Screens

Welcome · Today · My Mosaic · Brain Dump · Goal Breakdown · Projects · Calendar · Daily Planner ·
Notifications · Focus · Rescheduling · Notes · Habits · Reflection · Profile

## Scope of this build

Static frontend with Firebase Authentication, optional Cloud Firestore backup, on-device rules
(`js/ai.js`) and an optional local DeepSeek relay (`server.mjs`). `js/cloud.js` isolates the
Firebase integration. Planning uses `js/planning.js`; the weekly artwork uses `js/mosaic.js`.
The API key never reaches the browser. `FIREBASE.md` records console setup and rules deployment.

Every new account starts empty. `js/onboarding.js` owns the first-task guide. Local data is
separated by Firebase UID. An older anonymous workspace, if present, is left untouched and is
not attached to the first Google account that signs in.
