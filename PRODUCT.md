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

1. **Capture** — one free-text box, voice or file. No forms.
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

## Screens

Today · Brain Dump · Goal Breakdown · Projects · Calendar · Daily Planner · Notifications ·
Focus · Rescheduling · Notes · Habits · Reflection · Settings

## Scope of this build

Static frontend with Firebase Authentication, Cloud Firestore snapshots and Firebase Analytics.
`js/cloud.js` isolates the Firebase integration; `FIREBASE_SETUP.md` records console setup and
deployment. Planning still uses a structured local mock service (`js/ai.js`); seeded sample
data is available as an explicit reset. The mock layer is isolated so a real model can replace it without touching views.

The landing page shows an actual Today screenshot. `js/onboarding.js` owns the first-task guide.
Local data is separated by Firebase UID, with a one-time migration of the legacy workspace.
The course brief, proposal, rubric map, process log, stack guide and demo script are in `docs/`.
