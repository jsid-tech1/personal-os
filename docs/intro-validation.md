# Intro validation

## Scope

This change adds the approved ten-second introduction to the existing Personal OS website. It does not redesign the homepage or change workspace, authentication, backup or planning behaviour.

Brand direction is retained, not redealt: forest/paper/raspberry botanical palette, MilesDane / DM Mono, task UI followed by the original mosaic. Voice: the existing product's plain, unhurried wording; no invented features, customer claims, photographs or figures. There are no new asset placeholders or external image dependencies. The MilesDane Trial licence remains a release consideration.

## Checks

- Build: `node scripts/build.cjs` succeeds, including locally vendored GSAP and content-hashed intro assets.
- Syntax: `node --check js/intro.js` succeeds.
- Final intro run: **8 tests passed, 0 failed, 0 skipped**. Covers timing, deterministic backward seeking, task completion, live-hero docking after late layout changes, resize, pause, focus trap, Escape, Skip, once-per-tab persistence, reduced motion, dark appearance, missing GSAP and blocked storage.
- Keyframes: reviewed at 0, 1.9, 3.8, 5.9, 7.5, 8.9 and 9.7 seconds, at 1440, 1024, 768, 390 and 320 pixels. Frames and contact sheet are generated in the ignored `test-results/intro/` directory. This is frame verification, not a video export.
- Copy lint: 0 failures; one retained rhythm warning concerns the existing homepage's short-sentence style, not new intro copy.
- Settled-page consistency (`?intro=0`): 52 findings across 1440, 1024, 820, 768 and 390 widths. These concern the existing page's section heights, footer, kit-specific container/grid scaffold and hash-route interpretation. The 320-pixel overflow walk reports 0 failures. Contrast, accessibility names, keyboard focus, reduced motion, collisions, loaded visuals and asset checks pass. Findings were recorded, not resolved by redesigning unrelated sections.
- Performance: **0 failures** at 1440 and 390, using one sample per width. Existing bundle weight produces warnings (800.3 KiB parsed JS; 186 KiB CSS). No broken requests or live WebGL contexts. This is a local CPU-rendered check, not field performance data.
- Separate layout checker: could not complete; its own script throws `Cannot read properties of undefined (reading 'map')` and `r.sections is not iterable`. Reported without editing the checker. Responsive intro keyframes and the consistency checker were independently completed.
- Broader suite: the full run reported ten failures outside the intro tests (account adoption, Analytics, existing first-task/manual-plan/focus/redistribution controls, and automatic cloud sync). Those tests use reduced motion and hash routes, which bypass the intro. One intro autoplay timing assertion also failed under the full CPU-heavy run; foregrounding that test and allowing lag smoothing corrected it in the dedicated run. Unrelated application flows were not modified.

## Whole-page design gate

**Final: `GATE: OPEN 9 (rounds used up)`.** No waivers. The settled-page gate leaves these existing scaffold/layout findings open:

1. `links`: hidden workspace hash route `#/today` is interpreted as a missing section anchor.
2. `section-height`: footer is not a whole-screen section.
3. `one-section`: footer shares a screen with the preceding section.
4. `container-edges`: body-level skip link differs from the kit scaffold.
5. `container-edges`: welcome wrapper differs from the kit scaffold.
6. `container-edges`: existing sections do not each have one `.wrap` child.
7. `container-edges`: existing interactive-flower hint starts off the kit's shared text lines.
8. `split-pair`: existing hero columns are vertically centred rather than top-aligned.
9. `container`: the website uses its own containers instead of `.wrap`.

### Initial first-visit gate

The initial gate checked the first visit during its intentionally blocking, user-approved animation: `GATE: FAIL 13 (round 1 of 3)`. It is not a clean bill of health for the existing page. No waivers were added and no skill/checker files were changed.

Reported findings:

1. `nav`: no page navigation visible during the introduction.
2. `button-styles` (one screen): intro controls and existing page actions have three surface styles.
3. `button-styles` (page): same style count across the page.
4. `cta`: live hero actions are not yet visible during the intro.
5. `copy-headline`: live h1 is not yet visible during the intro.
6. `links`: the hidden workspace's `#/today` route is not a page-section anchor.
7. `section-height`: the existing footer is shorter than a whole screen.
8. `one-section`: the existing footer shares a screen with the previous section.
9. `container-edges`: the existing body-level skip link does not follow the kit's header scaffold.
10. `container-edges`: the requested intro dialog does not follow the kit's static page scaffold.
11. `container-edges`: the existing welcome wrapper does not follow that scaffold.
12. `split-pair`: the checker does not see the hidden hero copy as text-first during the intro.
13. `container`: the existing website uses its own layout containers rather than the kit's `.wrap`.

The animation is reviewed independently from the settled page. `?intro=0` is the documented bypass for reviewing the homepage without replaying the introduction; `?intro=1&debug=1` reviews the animation itself. Passing the full-page template gate would require changes outside this intro request.
