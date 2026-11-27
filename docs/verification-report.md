# Verification report

## Follow-up — mosaic opening and screen reveals

Verification: **42 passing tests**, no failures, one optional screenshot test skipped; build passes. The two loader-specific tests also passed after the final first-paint HTML/failure-fallback refinement. The fallback test disables the loader script with normal motion enabled and verifies the CSS layer hides itself.

Added original mosaic loader artwork and finite CSS animation, using sanvithi.com as a motion reference rather than copying its proprietary asset or effect code. The public HTML exposed no standalone GIF. Opening/refresh assembly dismisses shortly after DOM readiness, with a CSS safety dismissal after about 1.2 seconds from first styling. Route changes use a 260ms paint-only mosaic reveal. Neither blocks input or waits on Firebase, and state updates do not replay the transition. Reduced-motion users skip both. Tests cover expiry, pointer hit-testing, task-update behaviour, refresh, reduced motion and a missing loader script.

## Follow-up — readable body and interface text

Added a final shared type layer in `css/readability.css`: 16px body/conversation, 18px landing descriptions, 17px task titles, 14px secondary information/labels, and 15–16px actions. Increased secondary-text contrast in both themes; phone layouts wrap and stack rather than reducing body text. Restored multiline textarea sizing and kept the planner close button alongside its title. Date-range labels use Neue Montreal rather than trial-restricted numeral glyphs.

Final suite: **40 passed, 0 failed, 1 optional screenshot test skipped**. Includes computed-font-size regressions across 1440/768/390/320px plus landing responsiveness, mobile settings and AI review. Build passes. Reviewed refreshed landing, calendar, review and conversation screenshots. Prior marketing-layout/performance findings below remain recorded, not claimed as cleared.

## Follow-up — project conversation and Neue Montreal

Latest suite: **39 passed, 0 failed, 1 optional screenshot test skipped**; production build passes. Added a contextual, authenticated project conversation with browser dictation, editable transcript-before-send, optional spoken replies, running editable brief, and explicit transfer into the existing approval flow. Tests simulate speech results, denied permissions, unsupported recognition, conversation context and brief transfer without saving tasks. Actual microphone accuracy and paid AI conversation require device/browser testing and the existing server credentials.

Neue Montreal now replaces monospace throughout UI/body/forms/navigation/dates/timers, while MilesDane remains for headings. Regular/Medium/Bold/Italic are self-hosted from the user-supplied archive, with cache-versioned stylesheet and a preload for Regular. Inspected the refreshed 320px plan-review screenshot; the full suite again verifies responsive fit. No license document was included in the Neue Montreal demo archive; confirm publication rights. Layout/performance measurements below belong to the preceding MilesDane/DM Mono iteration and were not remeasured for this font-only update. The seven existing strict layout findings remain open.

**GATE: OPEN 7 (rounds used up).** Functional tests and the production build pass. Seven strict marketing-layout findings remain open; performance checks also flag initial parsed JavaScript weight. This is not a claim of a clean design gate or a deployed production service.

## Current results — 27 November 2026

- `npm test`: **36 passed, 0 failed, 1 skipped**. The skipped test regenerates an old optional screenshot asset; the new landing does not use it.
- `npm run build`: **passed**. Runtime-only output is in `dist/`; server code and secrets are not published as Hosting assets.
- `npm audit --prefix functions --omit=dev`: **0 vulnerabilities** after updating Firebase Admin and Functions. Local Node is 24; deployment targets Node 22 and npm notes that engine difference.
- `git diff --check`: no whitespace errors; existing Windows line-ending conversion notices remain.
- `copy-lint.mjs`: **0 FAIL, 0 WARN**.
- Real localhost browser: Firebase auth initializes; the button receives pointer events; Google popup reaches **accounts.google.com**; cancellation resets the button; app page JavaScript errors are **empty**. Completing account selection requires the user.
- Real local `/api/plan`: anonymous request returns **401**. No paid model call was made or unconfigured integration presented as working.
- Development serves `Cache-Control: no-store, max-age=0`; entry assets are versioned and the build fingerprints their URLs.

## Functional coverage

Browser tests replace Firebase/network boundaries with deterministic test implementations, not real production writes. AI success and provider-error responses are mocked. Server tests separately cover method, origin and anonymous-access rejection.

- Empty accounts contain no invented tasks, completions, calendar entries, focus logs or artwork rewards.
- Desktop first use: login → empty dashboard → natural-language description → AI proposal → editable review → explicit approval → calendar → completion → mosaic → reload.
- Mobile at **320px**: AI review, deletion/addition of steps, rebalancing, approval, calendar and task-earned artwork. Both the document and review dialog are checked for horizontal overflow.
- Manual creation without AI credentials; generation failure; invalid review edits; cancellation without saving tasks/projects.
- Scheduling respects available days, dependency order and existing work, including completed work that already consumed capacity. Impossible workload/deadlines and over-capacity edits are rejected. Explicit dates such as “10 December” can prefill the deadline.
- Missed work is redistributed only after approval; cancellation preserves dates; new dates persist after reload without overloading a day.
- Automatic private state writes, second-device hydration, stale revision detection and explicit conflict recovery. Account changes isolate local and cloud paths.
- Completion earns fragments; undo removes the contribution; week rollover starts an empty canvas and retains history; other accounts have separate archives.
- Focus presets, pause/resume and completed sessions associated with a task. Focus time alone never fabricates task completion or artwork progress.
- Google retry/session restoration, offline and permission errors, lazy Firestore failure, missing-script recovery, storage failure, manual backup/restore, preferences and logout.

## Visual review

Kind: software. Client-directed MilesDane/DM Mono typography and botanical pixel references guide the identity. Palette: mist `#f3f4f0`, ink `#202923`, forest `#315b43`, raspberry `#c22d63`, petal `#efb4c8`, chartreuse `#d5df83`. Dark mode uses deep botanical surfaces. Posters are references only, not bundled product art; the mosaic is original deterministic HTML geometry.

Voice: calm, direct, task-specific. No invented prices, customers, testimonials or adoption figures. The interface-component preview is labelled as an example and never inserted into account data. There is no `.example` form endpoint or fake authentication service. Canonical public URL awaits deployment.

Six primary destinations: Today, Tasks, Calendar, My Mosaic, Focus, Profile. Historical routes and data are preserved. The landing contains a hero, actual interface-component preview/process explanation, interactive reward demonstration and final Google action.

Dealt moment: **word-highlight**, on the mosaic statement; kit loader, lib, CSS and module copied unchanged. The micro-interaction layer is present. Reduced motion stops entrances/tile transitions and shows the statement in full ink. No shader, scene, stock imagery, client asset stand-in or WebGL context is used.

Inspected screenshots in `test-results/` include `welcome-1440.png`, `welcome-1024.png`, `welcome-768.png`, `welcome-390.png`, `first-use-desktop.png`, `plan-review-320.png`, `mosaic-mobile.png` and `firebase-desktop.png`. The skill's `mosaic-landing-light.png` filename is historical naming only: that capture follows the machine's dark appearance. Both themes are exercised. Widths **1440, 1024, 820, 768, 390 and 320** are checked for fit and reachable sign-in.

The supplied Milesdane Trial restricts numeral glyphs; calendar dates, timer digits and archive date labels use DM Mono. The original license is retained. **Commercial or large-audience publication requires an appropriate MilesDane license.**

### Seven open layout findings

| Check | Finding |
| --- | --- |
| `section-height` | Compact footer is 74px, not a full 900px marketing screen. |
| `one-section` | Footer shares the last viewport with the mosaic section. |
| `container-edges` | Accessible top-level skip link is outside the kit-prescribed header structure. |
| `container-edges` | Signed-out `#welcome` wrapper differs from the kit's top-level structure. |
| `container-edges` | Sections/footer use app layout wrappers rather than the exact single-`.wrap` child recipe. |
| `split-pair` | Hero copy has a 580px reading-width cap rather than ending exactly on the kit's split line. |
| `container` | No kit-named `.wrap` container. |

These remain **open**, not falsely waived. The one existing waiver is `links` for `aside#sidebar > div.brand > a.brand-mark`: `#/today` is an authenticated route exercised by integration tests, not a missing document anchor. Checker warnings include the expected dealt statement's scroll colouring, visual-recognition warnings for original HTML artwork and provider wording “Continue with Google”; standalone copy lint is clean.

## Current performance

`perf.mjs`, headless Edge, local CPU measurements—not field data:

| Metric | 1440px | 390px |
| --- | --- | --- |
| Transfer | 557.1 KiB | 554.9 KiB |
| Parsed JavaScript | **1229.3 KiB — FAIL** | **1229.3 KiB — FAIL** |
| Fonts | 2 / 124.5 KiB | 2 / 124.5 KiB |
| LCP | 400 ms | 324 ms |
| Layout shift | 0.091 | 0.000 |
| Broken requests | 0 | 0 |
| WebGL contexts | 0 | 0 |

The Firebase SDK and preserved legacy views load eagerly; parsed JavaScript exceeds the tool's 900 KiB threshold. Further route-level code splitting is an improvement opportunity, not reported as fixed.

## Required external configuration and verification

See **[AI_AND_SYNC_SETUP.md](AI_AND_SYNC_SETUP.md)** and `.env.example`.

1. Configure a server-only OpenAI key and Firebase Admin credentials locally. Production uses Firebase-managed credentials and Secret Manager. Missing AI configuration shows an error and offers manual creation.
2. Authorize Firebase CLI, enable necessary Functions billing, create the default Firestore database, and deploy Hosting, Functions and updated owner-only rules. Cross-device storage is implemented; production deployment is not performed or claimed.
3. Complete real Google login, paid model generation and owner/non-owner database tests on the public deployment. Rules-emulator verification has not been run.
4. Obtain the appropriate MilesDane license before commercial/large-audience publication.

Automatic sync uses a version-checked single-document workspace with a visible 900 KB limit, not an unbounded history store or collaborative merge service. Other devices refresh on refocus/reconnect. Conflicts require an explicit choice and preserve local edits. Export is available before replacement. Strengthen public abuse protection with App Check and distributed quotas before broad launch.
