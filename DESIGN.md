---
name: Personal OS
description: A calm, editorial instrument for planning and executing personal work.
colors:
  paper: "#F2F2EE"
  surface: "#FAFAF7"
  sunken: "#ECECE6"
  ink: "#121417"
  ink-2: "#43474E"
  ink-3: "#6F747C"
  line: "#DEDED6"
  accent: "#2036D6"
  positive: "#2C6A4F"
  warning: "#9A6216"
  danger: "#A63C36"
typography:
  display:
    family: Instrument Serif
    weight: 400
  ui:
    family: Geist
    weight: 300–700
  measure:
    family: DM Mono
    weight: 400–500
rounded:
  sm: 6px
  md: 10px
  lg: 14px
spacing:
  unit: 4px
  page: 36px
---

# Personal OS — Design

**Mode:** Operate. This is a tool used daily, before coffee and after dinner. Scanability,
consistency and calm outrank expression; the brand lives in precision and in a handful of
authored moments.

## The world: The Instrument

A precision desk instrument built on archival paper. Hairline structure, ink typography, one
signal colour. Nothing floats, nothing glows. Depth is declared once — a border, or a shadow,
never both. Panels are planes of tone, not cards stacked on cards.

**Why light:** the app is used at a desk in daylight and lamplight, for long stretches, with
text as the primary content. Paper is the correct base, not a costume.

## Colour

Warm, slightly green-grey paper (`#F2F2EE`) with an off-white plane (`#FAFAF7`) and a deeper
tone (`#ECECE6`) for wells. Ink (`#121417`) carries all body text. Hairlines (`#DEDED6`) do the
structural work that shadows do in lesser tools.

One signal: **ultramarine `#2036D6`**. It appears only where the product wants a decision —
primary action, active navigation tick, focused field, the "proposed" state, the current time.
It is never a background wash and never decoration.

Semantic tones are muted and hue-tinted, never pure red/green:

| Meaning | Token |
|---|---|
| Done, on track | `--positive #2C6A4F` |
| Approaching, attention | `--warning #9A6216` |
| Overdue, destructive | `--danger #A63C36` |
| Project identity | six restrained hues, see `tokens.css` |

Projects carry a 6px square of their hue, never a coloured border or tinted panel.

## Type

| Role | Face | Use |
|---|---|---|
| Display | Instrument Serif 400 | page titles, project titles, the reflection summary, empty-state prompts |
| Interface | Geist 300–700 | everything interactive, body, labels, buttons |
| Measure | DM Mono 400–500 | times, durations, counts, dates, timer, tabular figures |

Scale: 40 / 30 / 22 / 15 / 13.5 / 12 / 10.5.
Page titles are serif at 40px with -0.01em tracking. Section headings are Geist 600 at 15px.
Metadata is mono at 11px, letter-spaced, uppercase only when it is genuinely a field label
(a date, a duration). Never a decorative kicker above a heading.

Numerals are tabular everywhere numbers align. Body measure is 66ch.

## Grid and space

- Sidebar 236px; top bar 60px; page padding 36px (24px below 900px); content max 1320px.
- 4px base unit; spacing steps 4 / 8 / 12 / 16 / 24 / 32 / 48.
- Panels: 1px `--line`, radius 14px, padding 20–24px. Nested panels are never used.
- Grouping is tighter than separation: 8px inside a row group, 24px between groups,
  36px above a heading than below it.

## Motion

One authored entrance per view: content settles 8px upward with a 120ms opacity ramp, 240ms
exponential ease-out, from an already-visible default. Overlays slide 12px and fade. Hover
states are colour and 1px shifts only. Timer digits do not animate; they tick. Respect
`prefers-reduced-motion` by removing transforms, not feedback.

## Today: The Day Sheet

The first priority is the strongest element after the date, with a visible Start focus action.
On desktop, workload, deadlines and habits sit in a quiet margin. On narrow screens they
follow the priorities and schedule.

Read the schedule down a shared time column. Show meaningful gaps and use ultramarine for
the current time. Booked blocks have solid edges; proposals have dashed edges and a text
label. The review action opens the planner; only approval changes the schedule.

## Browser surfaces

Selection is ultramarine at 18% with ink text. Focus is a 2px accent ring offset 2px. Scrollbars
are 10px, `--line` thumb with transparent track. Caret is accent. Underlines are 1px with 3px
offset. All shipped, none left at browser default.

## Voice

Plain, specific, unhurried. Controls name their action ("Approve 3 changes", not "Continue").
The assistant explains itself in one sentence and offers a choice. Errors name the problem and
the recovery. No exclamation marks. No praise for basic actions.
