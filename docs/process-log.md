# Personal OS — process and prompt log

## Follow-up — mosaic entrance

Inspected the requested sanvithi.com reference. Its public markup did not expose a standalone loading GIF. Built original 8×8 fragment artwork and finite opening/refresh motion instead of copying that site's assets or code. First-paint tiles live in HTML; script dismisses the entrance independently of Firebase and CSS also has a maximum-lifetime fallback. Actual route changes receive a short mosaic reveal; task updates do not. Both layers ignore pointer input and reduced-motion users skip them. Full suite: **42 passed**, one optional screenshot test skipped. After the final first-paint refinement, both loader-specific tests and the production build pass.

## Follow-up — voice conversation and interface font

Added an optional conversational project brief inside Add task, with typed or browser-dictated messages, contextual AI follow-ups, editable brief, explicit brief transfer and optional speech playback. Mic permission/unsupported/network errors retain text input; closing the planner aborts audio and requests. Conversation remains ephemeral and never bypasses plan approval. The same authenticated server endpoint handles bounded chat messages; no frontend secrets were introduced.

At the user's next direction, replaced UI monospace with self-hosted Neue Montreal Regular/Medium/Bold/Italic from the supplied archive, keeping MilesDane headings. Aliased the legacy numeric/mono token so timers, labels and older components also use Neue Montreal. The demo archive contains no license document; publication rights still need confirmation. Latest verification: **39 passing tests**, no failures, one optional screenshot test skipped; build passes. Real voice accuracy and live paid AI are not claimed as automated test results.

## Latest rebuild — mosaic task planner

The user supplied Milesdane Trial and two botanical/pixel references, then requested a responsive AI planning application. Inspected the font archive and retained its personal-use license; the source posters were not bundled. Built original geometric botanical artwork, a MilesDane/DM Mono system, responsive product landing, six-destination app navigation, an empty dashboard, authenticated server-only AI proposals with explicit editable approval, capacity-checked scheduling, weekly calendar and approved redistribution, task-earned weekly mosaics with history, focus presets and profile availability/logout.

Retained account-scoped local work and manual backups. Added revision-checked automatic Firestore state sync with deliberate conflict recovery and owner-only rules. The server verifies Firebase ID tokens before OpenAI calls; keys live in environment variables/Secret Manager, never frontend code. Unconfigured AI shows an error and provides manual creation. Updated deployment and setup instructions in `docs/AI_AND_SYNC_SETUP.md`.

Final regression run: **36 passed, 0 failed, 1 optional screenshot test skipped**. Build passes; Functions dependency audit reports no vulnerabilities. A real local button click again opened Google login, cancellation recovered and no app JavaScript errors occurred. Automated AI and database journey checks use mocked service boundaries, including simulated second-device hydration; no paid model call, production deployment or rules-emulator run is claimed. Design gate finishes **OPEN 7**; parsed-JavaScript performance findings and all open layout findings are documented in `docs/verification-report.md`. The font needs the appropriate license before commercial/large-audience release.

## Provenance

This log records work observed in the current session, dated 27 November 2026. The repository already contained an extensive app, a Google entry gate, Firebase snapshot integration and browser tests, including uncommitted changes. Earlier authorship, prompts, milestone submissions and user research were not supplied and are not reconstructed here.

## User prompts, verbatim

1. `open the personal os link`
   - Action: found the documented local URL, started the local server and opened `http://localhost:8000`.
2. `fetch all the data given in this link and apply it accordingly in personal os with proper functioning. first fetch all data from this page - https://gyanl.com/tech1/project-final-project`
   - Action: fetched the complete assignment before editing the app. Saved a readable transcription plus the original HTML snapshot. Mapped the seven requirements, milestone dates and full 20-mark rubric to this product.

## AI-directed implementation decisions

- Reused the app's existing vanilla JavaScript structure and design system.
- Changed the landing copy to name a reachable audience: design students. Added a screenshot captured from the real Today screen.
- Used a new account's display name and empty data instead of silently presenting Chirag's seeded demo workspace as every user's own data.
- Added a first-task form with a short task → complete → cloud-backup guide and links for existing backup owners.
- Scoped local work by Firebase UID. Preserved the legacy workspace and migrated it only once rather than deleting it.
- Closed overlays and destroyed active screen state on account changes.
- Surfaced localStorage failures with retry/export, and reused the cloud schema validator for file imports.
- Separated clearing the workspace from the existing opt-in sample-data reset.
- Added a runtime-only deployment build and Firebase Hosting configuration alongside the existing database rules.
- Added documentation for the proposal, sprint acceptance plans, stack and Demo Day.

## Dead ends, discoveries and fixes

1. **The old welcome page was an account gate, not a complete landing page.** It did not identify a specific group or show the actual product. The new first screen provides both.
2. **A single localStorage key mixed accounts.** Owner-only Firestore rules did not solve local account switching. UID-scoped keys and account-switch tests address that separately.
3. **Sample data hid the first-use problem.** Every new user got a full seeded workspace. Empty-state rendering and the first-task flow now have browser coverage; sample data is opt-in.
4. **The first completion test used `checkbox.check()`.** Completing a task removes it from the priorities list, so Playwright could no longer inspect the same checkbox and timed out. Changed the test to click and assert the actual task and saved backend snapshot.
5. **The default Hosting address returned HTTP 404.** No Firebase CLI executable or CLI login record was found in the standard Windows location. Deployment is prepared but a public release is not claimed.

## Evidence and limits

Browser tests replace Firebase's SDK network boundary with deterministic modules. They exercise the actual app DOM, state, routing and cloud integration code without authenticating a real person or writing production data. They do not prove that Google is enabled or that production rules have been published.

Run `npm test` for the current result. Tests cover sign-in gating, session restoration, cancellation and retry, sign-out cleanup, account-owned backup paths, account-local isolation, confirmed restore, concurrent edits, malformed/oversized backups, network/permission failures, blocked Analytics, first use, empty screens, phone layout and persistence failures.

The landing screenshot was captured from Today with the existing opt-in seeded demo via `UPDATE_PRODUCT_PREVIEW=1`; no external product photograph or generated UI illustration was used. Generated test screenshots live in ignored `test-results/`.

Final session result: 17 functional browser tests passed; the optional preview-generation test was skipped on the final run and had passed when generating the image. The runtime build passed. See `verification-report.md` for open design-layout findings and the initial JavaScript-size performance finding.

## What we would do differently

- Validate the class-sized problem with classmates before expanding the number of screens.
- Design and test empty accounts before investing in populated demo screens.
- Choose account-local and cloud ownership together at the start.
- Deploy a minimal version in Sprint 1, so provider/domain/rule problems surface early.
- Keep original prompts, feedback and submission timestamps as work happens rather than reconstructing them before Demo Day.
- Consider live synchronization and conflict resolution only after the explicit snapshot flow is reliable and users ask for it.

## Team records still to add

Original three idea pitches; team names; dated submissions; original sprint/prompt logs; real user feedback; public deployment URL; actual Google and owner/non-owner database checks; rehearsal notes. These require facts from the team rather than generated history.

## Follow-up: actual sign-in and stale entry page

The user enabled Google authentication and added localhost after the live Firebase endpoint returned `CONFIGURATION_NOT_FOUND`. The public configuration endpoint then returned HTTP 200 with localhost authorized. A real browser click reached Google's account login page; completing the user's account authentication still requires their selection.

The user subsequently reported an unclickable page and supplied screenshots showing a distorted, left-aligned preview. The local server logs showed their new HTML/image loads reusing previously cached CSS/JavaScript, while fresh test browsers requested all the files. Reopening only the HTML URL had not refreshed those cached dependencies.

Fixes: version every local entry asset; serve development files with no-store; fingerprint production assets by content; independently wire entry recovery; decouple sign-in from Firestore loading; bound auth startup waits; provide a same-tab option for blocked popups. Rebuilt the landing as centered copy and signup with a wide, proportional, explicitly labelled workspace preview.

Regression checks now include unavailable Firestore during sign-in, auth startup timeout/retry, popup blocking, the header sign-in action, stale unversioned entry files and missing app-code recovery. Final functional run: **21 passed**, optional screenshot generation skipped (passed when regenerating the wider screenshot). The live Google login page again opened with no app JavaScript errors and the button correctly received pointer events.
