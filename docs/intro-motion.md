# Personal OS intro — Progress takes shape

Software · 10 seconds · silent · one continuous shot, adapted from Bang Motion's opener architecture.

## Approved direction

Calm, tactile, creative. Existing forest `#315b43`, paper `#f3f4f0`, raspberry `#c22d63`, petal and chartreuse; MilesDane display / DM Mono UI. All colours and the botanical composition come from `css/studio.css` and `js/mosaic.js`. No new marketing claims, photographs, sound or WebGL.

Candidates: task-to-mosaic transformation (selected because it demonstrates the product's distinguishing interaction); scattered tasks becoming a plan; pixel logo build-on.

Structure: one shot · task panel → earned fragments → botanical mosaic → live hero. Opening: product UI being used. Closing: the same artwork docks into the page, not a logo end card.

| Seconds | Beat |
| --- | --- |
| 0–3 | Close-up of the product's task panel; references and first-direction tasks complete. |
| 3–5.4 | Earned fragments travel from the checks into an expanded botanical composition. |
| 5.4–7.8 | Fragments settle into the exact homepage mosaic; “Your progress takes shape” appears. |
| 7.8–10 | Copy clears, artwork docks into the live hero, and the page is revealed. |

Signature: a completed task becomes colour. Background: slowly moving botanical paper light over a fixed-seed paper texture (two layers, no flashing). Objects: flat geometric fragments matching the actual product. Text: sentence case, no added punctuation or highlight. One special moment: fragments form the botanical artwork. Camera: close-up to wide; final move follows the mosaic to its actual page coordinates.

## Runtime

- `js/intro.js` owns preflight, timeline and cleanup; `css/intro.css` owns only intro styling.
- The original botanical generator is shared through `POS.mosaic.cells`, not copied.
- GSAP 3.12.5 is vendored at `assets/vendor/gsap.min.js`, including its copyright/license header; see https://gsap.com/standard-license/.
- Bang Motion by Bang Tutorial is MIT licensed: `bang-motion/LICENSE`. Only its architecture and techniques are adapted; its demo imagery and styles are not shipped.
- Plays once per tab (`personal-os:intro-seen` in session storage). Stored accounts, hash deep links, reduced-motion preferences and missing GSAP bypass it. No account data is written by the demo.
- Pause/Resume and Skip are always available; Escape skips, Space pauses, R restarts while active. Tab remains inside the introduction. Hidden tabs pause instead of finishing unseen. A reduced-motion change exits immediately.
- End/skip restores page interaction, clears temporary hero styles, restores focus, removes listeners and kills the timeline. Missing script/library fails open.

## Review

- `?intro=1` forces a replay even after this tab has seen it.
- `?intro=0` bypasses it.
- `?intro=1&debug=1` opens a paused review timeline and scrubber.
- `?intro=1&clean=1` opens paused without review controls for frame capture.
- `POS.intro.seek(seconds)` or `OPENER.seek(seconds)` seeks deterministically; `POS.intro.play()` resumes. `OPENER.DUR` is 10.
- Responsive stage: 1440×900 landscape or 600×1000 portrait. Resize rebuilds the timeline at the same playback position.

The existing homepage, copy, authentication and workspace are otherwise unchanged. The existing MilesDane Trial licensing restriction still applies.
