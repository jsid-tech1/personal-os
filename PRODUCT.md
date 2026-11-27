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
<<<<<<< HEAD
- **On-device** is the default. Planning and rescheduling use local rules. In Capture, the user can
  opt in to DeepSeek for general chat, turn-based voice, and drafts. See [DeepSeek setup](DEEPSEEK.md).
  Workspace access is a separate choice. Messages are not saved automatically.
- Integrations (calendar sync, cloud backup) are shown as **not connected**. They are labelled,
  not faked.
- Saved workspace data lives in the browser (localStorage). Export and import are real; cloud sync
  is off. An opted-in DeepSeek conversation sends submitted messages or audio to the provider.
- Offline-first: the app runs from disk without DeepSeek. Fonts are self-hosted.
=======
- The AI is a **local, deterministic demo** in this build. No model is called, no key is used.
  The UI says so where it matters.
- External calendar sync remains **not connected**. Firebase provides Google sign-in and
  explicit cloud backup/restore, with connection and error states shown in Settings.
- Google sign-in is required at the opening welcome screen. Returning authenticated sessions
  enter the requested screen; signing out closes the workspace and returns to welcome.
  New users create their Firebase account through the same Google button.
- New accounts start empty, using their Google display name. Today guides users through a first
  real task, completion and explicit cloud backup; the populated demo is opt-in in Settings.
- Data saves automatically in account-scoped localStorage. File export/import and Firestore backup/restore
  are real. Cloud saving is manual, with one snapshot per Google account; it is not live sync.
- Local planning can continue offline in an already authenticated, open session. A fresh launch
  needs Firebase SDK loading and authentication before the workspace opens. Cloud operations
  and Analytics use the network. Fonts are self-hosted.
>>>>>>> 196832040d9384cac7bfb875f089b4300511be07

## Screens

Today · Brain Dump · Goal Breakdown · Projects · Calendar · Daily Planner · Notifications ·
Focus · Rescheduling · Notes · Habits · Reflection · Settings

## Scope of this build

<<<<<<< HEAD
Static frontend with on-device rules (`js/ai.js`) and seeded sample data. The optional local
server (`server.mjs`) relays DeepSeek requests without exposing the API key to the browser.
=======
Static frontend with Firebase Authentication, Cloud Firestore snapshots and Firebase Analytics.
`js/cloud.js` isolates the Firebase integration; `FIREBASE_SETUP.md` records console setup and
deployment. Planning still uses a structured local mock service (`js/ai.js`); seeded sample
data is available as an explicit reset. The mock layer is isolated so a real model can replace it without touching views.

The landing page shows an actual Today screenshot. `js/onboarding.js` owns the first-task guide.
Local data is separated by Firebase UID, with a one-time migration of the legacy workspace.
The course brief, proposal, rubric map, process log, stack guide and demo script are in `docs/`.
>>>>>>> 196832040d9384cac7bfb875f089b4300511be07
