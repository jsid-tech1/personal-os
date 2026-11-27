# Personal OS — Tech 1 final project

Prepared 27 November 2026 against [the fetched assignment](tech1-final-project-source.md). This is a current implementation plan and evidence map, not a claim that earlier course milestones were submitted on time.

## One-page proposal

**This is for** design students in the team's class, **who currently** keep coursework, portfolio deadlines and next actions across notes, messages and separate calendars. This is the problem hypothesis to validate with classmates; no interviews or sign-ups have been supplied.

**It lets them** add a task, choose what matters today, assign time, finish it, and keep an account-owned backup.

**They'd sign up because** they can turn an upcoming submission into a small, visible daily plan and return to their own work.

**It uses** Google authentication, browser persistence and a Firestore database. The planner uses local rules. It is not a language-model feature. The assignment welcomes AI but does not require it; there is no need to add an unearned AI call.

**Problem:** a deadline is not a next action. Students need a short list they can finish today rather than another large workspace to configure.

**Core flow:** landing page → Continue with Google → empty Today workspace → add a real task → plan a time or begin work → complete it → Save cloud backup → reload or restore on another device.

**MVP demonstration scope:** Today, task creation/completion, Planner, sign-in and save/restore. Existing projects, notes, habits and other screens remain supporting tools. Present one complete loop rather than promising all of them as separate products.

**Stack:** static HTML/CSS/JavaScript; hash routes; one local state store; Firebase Authentication; Cloud Firestore; Firebase Hosting configuration. No frontend build framework, custom server, model API key or external calendar connection.

**Reachable users:** classmates who have a real upcoming submission. Before presenting, ask a few to sign in on their own phones, add a task and save a backup. Record what actually happened; do not invent adoption metrics.

**Team:** the assignment allows up to three people. Team names and responsibilities must be supplied by the team. Each person must understand the complete core flow, not just their screen.

## Milestones and sprint plans

The dates below are transcribed from the course page, which does not attach a year to them.

| Milestone | Course date | Deliverable | Evidence still needed from the team |
| --- | --- | --- | --- |
| Introduction, L9 | 13 October | Collect three ideas and sharpen the problem | Original ideas / discussion record |
| Kickoff, L10 | 27 October | Team, pitch, one-page proposal | Submitted proposal and submission timestamp |
| Sprint 1, L11 | Wednesday 4 November | Sign-in and core flow end to end; live crit | Sprint record, crit feedback and submission timestamp |
| Sprint 2, L12 | 19 November | Landing, empty/error states, security, polish; freeze at week's end | Sprint review and freeze record |
| Demo Day, L13 | Friday 27 November, from 2:15pm | Seven-minute live demo and process story, then three-minute Q&A | Public URL, live account test and presentation |

### Sprint 1 acceptance plan

1. A visitor signs in with Google and enters Today.
2. A new account sees an empty workspace, with a labelled form for its first task.
3. A task persists after reload and can be completed.
4. Saving writes to `users/{uid}/backups/workspace`; restoring asks before replacement.
5. Switching accounts loads that account's local workspace and closes previous dialogs.

### Sprint 2 acceptance plan

1. The first screen names the product and audience, with one Google sign-up action.
2. A screenshot of the running Today screen shows the actual product.
3. New users can add work without configuring projects or importing sample data.
4. Sign-in, offline, permission, quota and malformed-backup failures have useful messages.
5. Phone layout and keyboard paths are checked in a browser.
6. Deploy Hosting and rules, verify with real accounts, freeze features, rehearse.

## Requirement-to-implementation map

| Requirement | Application / evidence | Status |
| --- | --- | --- |
| Public, deployed, usable on phone | `firebase.json`, `scripts/build.cjs`, `npm run deploy`; phone browser tests | Deployment pending project login; configured Hosting URL returned 404 during this session |
| Sign-in and owner-only rules | `js/cloud.js`, `js/app.js`, `firestore.rules` | Implemented; mocked SDK integration checked; real Google and published rule checks pending |
| Real backend | Firestore snapshot save/restore from Today guide or Settings | Implemented; production read/write requires authorized project setup |
| Landing page: what / for whom | `index.html`: daily planner for design students | Implemented |
| Landing page: show product | `assets/product-today.png`, captured from the running Today view using opt-in demo data | Implemented |
| Landing page: clear signup and mobile | Existing Google entry button, responsive `css/welcome.css` | Implemented; browser checks cover narrow layouts and cancellation |
| First five minutes | Empty account state, `js/onboarding.js`, Today empty states and backup feedback | Implemented; end-to-end browser test |
| Process documentation | This proposal, sprint plans, `process-log.md`, `demo-day.md` | Current work recorded; historical prompts/submissions require team records |
| Stack understanding | `stack-guide.md`, `FIREBASE_SETUP.md` | Written; each team member must rehearse answers |

## Evaluation evidence — 20 marks

| Criterion | Marks | Evidence to show |
| --- | --- | --- |
| Timeliness | 2 | Real submission timestamps for proposal and sprints; cannot be created retroactively |
| Concept | 3 | Proposal's class-sized audience, weekly problem, one complete task-planning loop |
| Working Product | 5 | Public phone URL, real Google sign-in, create/complete/reload, owner-only cloud save/restore, error states |
| Landing Page & Sign-up | 3 | First screen, actual screenshot, Google button, empty first-use flow |
| Design & Polish | 3 | Consistent existing design, mobile and keyboard behavior, meaningful empty/error/loading states |
| Stack Understanding | 2 | Team explains identity, state, database path, rules and click lifecycle |
| Presentation & Process | 2 | Seven-minute demo, actual prompt log, limitations, dead ends and next steps |
| **Total** | **20** | This is an evidence map, not an awarded score. |

## Release verification that needs a real account

- Enable Google provider, database and authorized domains as described in `FIREBASE_SETUP.md`.
- Log into Firebase CLI with an account that owns or can deploy to `personal-os-12b89`.
- Run `npm run deploy`. Open the returned HTTPS URL on a phone using mobile data.
- In account A: create a task, save cloud backup, sign out. In account B: confirm that A's tasks do not appear and its backup cannot be read or written.
- In a separate browser or phone, sign in as A and explicitly restore the backup. Complete the task and save again.
- Check Firestore Rules Playground (or an emulator): anonymous reads/writes denied; UID A can read/write A's path; UID B cannot read/write A's path; invalid envelope, extra fields and non-server timestamp writes denied.
- Record the actual URL, device, accounts anonymized, date and results in the process log. Do not present mocked browser tests as proof of deployed database authorization.
