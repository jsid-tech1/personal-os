# Personal OS — Product

**One line:** A second brain that turns what you say you want into a schedule you can actually keep.

**Promise:** It doesn't just remember what you want to do. It figures out how you can get it done.

## Who it's for

One person, working alone: a designer, student or independent maker with several live goals
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
- **On-device** is the default. Planning and rescheduling use local rules. In Capture, the user can
  opt in to DeepSeek for general chat, turn-based voice, and drafts. See [DeepSeek setup](DEEPSEEK.md).
  Workspace access is a separate choice. Messages are not saved automatically.
- Integrations (calendar sync, cloud backup) are shown as **not connected**. They are labelled,
  not faked.
- Saved workspace data lives in the browser (localStorage). Export and import are real; cloud sync
  is off. An opted-in DeepSeek conversation sends submitted messages or audio to the provider.
- Offline-first: the app runs from disk without DeepSeek. Fonts are self-hosted.

## Screens

Today · Brain Dump · Goal Breakdown · Projects · Calendar · Daily Planner · Notifications ·
Focus · Rescheduling · Notes · Habits · Reflection · Settings

## Scope of this build

Static frontend with on-device rules (`js/ai.js`) and seeded sample data. The optional local
server (`server.mjs`) relays DeepSeek requests without exposing the API key to the browser.
