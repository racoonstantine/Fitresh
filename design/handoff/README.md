# Handoff: Full Circle — holistic health tracking (wireframes + two navigation directions)

## Overview

Full Circle currently tracks workouts, nutrition, fasting and weight in a single
static frontend (`public/index.html`) against a small PHP/MySQL API
(`api/data.php`). This handoff covers the expansion to a holistic health app:
six tracked domains — **nutrition, training, vitals, sleep, water, mind** — plus
**weight** and **fasting**, with watch-captured and hand-entered data side by
side, and a recommendations layer derived from the user's own history.

It contains one wireframe set and two hi-fi navigation directions. **Pick one
navigation direction before implementing** — they are the same day's data under
two different information architectures.

## About the design files

`Full Circle Health.dc.html` is a **design reference created in HTML** — a
prototype showing intended look, layout and copy. It is not production code to
copy. It renders three mockups on a single pan/zoom canvas; it is not a runnable
app and has no data layer.

The task is to **recreate these designs in the target codebase's existing
environment**. For this project that is `public/index.html`: one file, vanilla
JS, no build step, no framework, talking to `api/data.php` with `fetch()`.
Follow that existing pattern — panel `<div>`s toggled by a tab/nav row, render
functions that read from in-memory arrays hydrated from the API — rather than
introducing a framework. If you do decide a build step is warranted, that is a
separate decision from this design work.

`styles.css` is the **Organic** design system's token + component sheet. It is
the source of truth for every color, font, radius, spacing and shadow value
below. Link it and use the CSS variables; do not hard-code the hex values.

## Fidelity

Mixed, and labelled on the canvas:

- **1a — low fidelity.** Wireframes for four screens (Today, Log an entry,
  Trends, Insights). Structure, hierarchy and flow only; dashed boxes and
  monospace labels are placeholders, not a visual style. Use these for layout
  and functionality, then style with the Organic system.
- **1b and 1c — high fidelity.** Final colors, type, spacing, radii and copy.
  Recreate these pixel-accurately using `styles.css` tokens and classes.

## Design tokens

All from `styles.css` (`:root`). Use the variable, never the literal.

**Roles**

| Token | Value | Use |
| --- | --- | --- |
| `--color-bg` | `#f5ead8` | page ground |
| `--color-surface` | `#ebddc5` | header bar, filled cards, hub tiles |
| `--color-text` | `#201e1d` | body ink |
| `--color-accent` | `#c67139` | primary action, active nav, "today" emphasis |
| `--color-accent-2` | `#7a8a5e` | second voice — sleep, water, sage sidebar |
| `--color-divider` | `color-mix(in srgb, #201e1d 16%, transparent)` | card borders, rules |

**Ramps** (100–900, OKLCH on one shared lightness scale). Steps used in the
mockups: `--color-neutral-100 #f9f4ed` (card fill, frame ground),
`--color-neutral-200 #eee7db`, `--color-neutral-300 #dcd3c4` (empty track /
inactive bar), `--color-neutral-400 #c0b6a5` (wireframe dashed border),
`--color-neutral-600 #82796a`, `--color-neutral-700 #645c50` (muted label),
`--color-neutral-800 #474238` (secondary body), `--color-neutral-900 #2e2b25`;
`--color-accent-100 #fff2eb`, `--color-accent-200 #ffe1d0`,
`--color-accent-300 #ffc6a5`, `--color-accent-400 #f6a06b`,
`--color-accent-700 #8c491a` (accent text at body size),
`--color-accent-800 #643312`, `--color-accent-900 #402310`;
`--color-accent-2-200 #e1eecc`, `--color-accent-2-300 #ccdbb2`,
`--color-accent-2-400 #aebf92`, `--color-accent-2-500 #8fa073`,
`--color-accent-2-600 #728157`, `--color-accent-2-700 #56633f`,
`--color-accent-2-800 #3d472b` (sidebar), `--color-accent-2-900 #272e1b`.

**Type** — `--font-heading` Caprasimo 400 for headings and all large numerics;
`--font-body` Figtree 400/600/700 for everything else. Body base 15px / 1.55.
Sizes used: h3 25px, h4 20px; hero numeric 38px; tile numeric 30px; vitals
numeric 26px; body 14.5px; secondary 13–13.5px; meta 12.5px; uppercase label
11.5–12px with `letter-spacing:.08em; font-weight:700`. Wireframe labels are
`ui-monospace, Menlo, monospace` at 10–11px — wireframes only, never in hi-fi.

**Spacing** — `--space-1 4.4px` · `--space-2 8.8px` · `--space-3 13.2px` ·
`--space-4 17.6px` · `--space-6 26.4px` · `--space-8 35.2px`. Layout gaps in the
mockups: 28px frame padding, 20–24px between major blocks, 14–16px between
tiles, 8–12px inside a tile.

**Radius** — `--radius-sm 8px` (wireframe boxes, inner chips) ·
`--radius-md 16px` (stat tiles, vitals cards) · `--radius-lg 28px` (app frame,
hub tiles, large cards) · `999px` for every button, tag, pill and progress
track.

**Shadow** — `--shadow-sm` · `--shadow-md` · `--shadow-lg` (used on the app
frame). No ad-hoc shadows.

**Component classes to reuse** — `.btn` + `.btn-primary` / `.btn-secondary` /
`.btn-ghost`; `.tag` + `.tag-accent` / `.tag-accent-2` / `.tag-neutral` /
`.tag-outline`; `.card`; `.field` / `.input` / `.seg` / `.seg-opt` for the log
form; `.table` for trends tables; `.dialog` for confirmations. Hover, active and
`:focus-visible` states are already defined in the sheet — do not restyle them.
Buttons in the mockups override only `border-radius: 999px` and padding.

## Direction 1b — top tabs

**Purpose.** Five fixed destinations; everything about the current day lives on
one scrolling page. Lowest navigation cost to "what is my day", highest scroll
cost. Closest to today's `main-tab` pattern (Workout / Weight / Nutrition /
Summary), so the cheapest migration.

**Frame.** `--color-neutral-100` ground, `--radius-lg`, `--shadow-lg`,
`overflow:hidden`. Design width 1220px.

**Header.** `--color-surface`, padding `18px 28px`, flex row, 24px gap, wraps.
- Brand: 30px accent circle with `inset 0 0 0 5px var(--color-neutral-100)`
  (a ring, not a filled dot), then "Full Circle" in Caprasimo 21px.
- Tabs: **Today · Body · Nutrition · Training · Insights**, Caprasimo 14px,
  `padding:8px 18px`, `border-radius:999px`. Active tab = `--color-accent` fill
  with `--color-bg` text; inactive = `--color-neutral-800` on transparent. Give
  inactive tabs a hover tint from the accent ramp.
- Right: sync chip — "Watch synced 6 min ago", 12.5px/600,
  `--color-accent-2-700` on `--color-accent-2-200`, pill — then a 34px avatar
  circle, `--color-accent-2-400` fill, initials 13px/700 in
  `--color-accent-2-900`.

**Content**, 28px padding, vertical stack, 20px gaps:

1. **Day header row.** `<h3>` "Wednesday, 13 September"; sub-line 13.5px
   `--color-neutral-700`: "Day 96 of the current block · 2 entries pending
   review". Right: primary pill button "Log an entry", `padding:10px 22px`.
2. **Balance + tiles.** `grid-template-columns: 290px minmax(0,1fr)`, 20px gap.
   - *Daily balance card*: `--color-surface`, `--radius-lg`, 24px padding,
     centred column. Ring = 176px circle,
     `conic-gradient(var(--color-accent) 0 68%, var(--color-accent-2-500) 68% 84%, var(--color-neutral-300) 84% 100%)`,
     with a 132px `--color-surface` disc knocked out of the middle holding
     "84" (Caprasimo 38px) over "OF 100" (11.5px uppercase). Below: three
     `space-between` rows at 13px — Intake vs. expenditure **−410 kcal**;
     Recovery **Moderate**; Adherence, 7 d **6 of 7**.
   - *Tile grid*: `repeat(3, minmax(0,1fr))`, 14px gap, six tiles —
     `--color-neutral-100` fill, 1px `--color-divider`, `--radius-md`, 16px
     padding, 8px inner gap, uppercase 11.5px label, Caprasimo 30px value with
     any unit at 15px, then one supporting line at 12.5px.
     - **Steps** 8,412 · 7-bar sparkline (heights 40/62/55/88/47/71/60%, 3px
       gap, `--color-accent-300`, today's bar `--color-accent`, 28px tall) ·
       "Goal 10,000 · 84%"
     - **Resting HR** 54 bpm · "+6 bpm vs. 7-day average" in
       `--color-accent-700`/700 · "Measured 04:12–06:40"
     - **Sleep** 6h 08m · 10px stacked stage bar, widths 18/24/46/12% in
       `--color-accent-2-700` / `-500` / `-300` / `--color-neutral-300` ·
       "Deep 1h 06m · REM 1h 28m"
     - **Water** 1.8 L · 10px track `--color-neutral-300` with a 72%
       `--color-accent-2-500` fill · "Target 2.5 L · 0.7 L remaining"
     - **Fast** 14:32 · "Started 20:10 · window 16:8" · secondary pill
       "End fast"
     - **Weight** 94.2 kg · "−0.42 kg/week, 30-day trend" in
       `--color-accent-2-700`/700 · "Goal 85.0 kg · projected 22 Nov"
3. **Nutrition + Training.** Two equal columns, 20px gap, both
   `--color-neutral-100` / 1px `--color-divider` / `--radius-lg` / 22px padding.
   - *Nutrition*: `<h4>` + "1,640 of 2,050 kcal". Three macro rows — label/value
     at 13px above a 12px `999px` track on `--color-neutral-300`: Protein
     112/145 g at 77% `--color-accent`; Carbohydrate 168/190 g at 88%
     `--color-accent-2-500`; Fat 54/62 g at 87% `--color-neutral-600`. Then a
     `--color-divider` top border and three meal rows at 13.5px: Breakfast ·
     oats, whey, blueberries **412 kcal**; Lunch · chicken, rice, greens
     **638 kcal**; Dinner · not logged **—** (whole row `--color-neutral-700`).
   - *Training*: `<h4>` + "Week 14 · load 412 AU". Seven-day strip — day initial
     11px/700 above a 52px `border-radius:12px` block: Mon **A**
     `--color-accent`, Tue **Z2** `--color-accent-2-500`, Wed **B** dashed
     `--color-accent-400` border with `--color-accent-700` text (today,
     planned), Thu **—**, Fri **A**, Sat **Int**, Sun **Rest** all
     `--color-neutral-300`. Then a `--color-surface` `--radius-md` panel:
     "TODAY · STRENGTH B", "6 exercises · 18 sets · est. 48 min. Last completed
     6 Sep at 07:20.", primary "Start session" + secondary "Swap for Zone 2".
     Footer row at 13px: Avg HR last session **131 bpm** · Pace **6:02 /km** ·
     Calories **486**.
4. **Vitals strip.** `repeat(4, minmax(0,1fr))`, 14px gap, `--color-surface`
   `--radius-md` 16px padding: **Blood pressure** 118/76 "Entered manually ·
   07:05"; **Glucose, fasting** 5.4 mmol/L "In range, 14-day mean 5.3"; **HRV**
   42 ms "−9 ms vs. baseline"; **Mind** 10 min "Breathing · stress 34 of 100".
5. **Recommended from your data.** `<h4>` plus the provenance line "Derived from
   7–30 September, watch and manual entries". Three cards,
   `repeat(3, minmax(0,1fr))`, `--color-neutral-100` / 1px `--color-divider` /
   `--radius-md` / 18px padding: a tag (`.tag-accent` Recovery,
   `.tag-accent-2` Nutrition, `.tag-neutral` Hydration), the recommendation at
   14.5px / 1.45, then a primary pill and a ghost "Dismiss" pinned to the bottom
   with `margin-top:auto`. Copy verbatim in the HTML file — keep it; the
   observation → recommendation → action shape and the stated data window are
   the point.

## Direction 1c — hub

**Purpose.** Home is a hub of six domain tiles, each opening its own workspace;
recommendations get a permanent rail. Scales better as domains grow and makes
each domain's own history first-class; costs one extra click to any detail.

**Frame.** Same ground/radius/shadow, `grid-template-columns: 216px minmax(0,1fr)`.

**Sidebar.** `--color-accent-2-800`, padding `24px 18px`, column, 26px gaps.
Brand = 26px `--color-accent-400` ring + "Full Circle" Caprasimo 18px in
`--color-neutral-100`. Nav items 14px, `padding:10px 14px`, `999px`: **Hub**
active — `--color-accent-2-600` fill, `#ffffff` text, 700 — then Log, Trends,
Insights, Devices in `--color-accent-2-200`. Pinned to the bottom: a
`--color-accent-2-900` `--radius-md` device card ("WATCH" / "Synced 6 min ago ·
battery 62%") and a 30px `--color-accent-400` avatar + name at 13.5px.

**Main.** 28px padding, `grid-template-columns: minmax(0,1fr) 300px`, 24px gap,
`align-items:start`.

*Left column* — day header ("Wednesday, 13 September" / "Readiness 82 · fast
14:32 · 2 entries pending review" + "Log an entry" primary), then:

- **Hub grid**, `repeat(3, minmax(0,1fr))`, 16px gap. Each tile:
  `--color-surface`, `--radius-lg`, 20px padding, `min-height:168px`, column,
  10px gap — a title row (uppercase 12px label + a `.tag` on the right), a
  Caprasimo 32px value, a 13px supporting line, and a bottom element pushed by
  `margin-top:auto`.
  - **Nutrition** · `.tag-outline` −410 kcal · 1,640 · "of 2,050 kcal · protein
    112 g" · 7-bar sparkline (62/78/54/90/70/44/80%), last bar `--color-accent`
  - **Training** · `.tag-accent` Strength B · 412 AU · "Week 14 load · 3 of 5
    sessions done" · five 10px pills, three `--color-accent`, two
    `--color-neutral-300`
  - **Vitals** · `.tag-outline` 3 of 4 in range · 118/76 · "Glucose 5.4 · SpO₂
    97% · HRV 42 ms" · "HRV 9 ms below baseline" in `--color-accent-700`/700
  - **Sleep** · `.tag-outline` −52 min · 6h 08m · "Deep 1h 06m · REM 1h 28m ·
    2 wakes" · the same 10px stage bar as 1b
  - **Water** · `.tag-outline` 72% · 1.8 L · "Target 2.5 L · last glass 12:40" ·
    two secondary pills "+250 ml" "+500 ml"
  - **Mind** · `.tag-accent-2` Streak 9 · 10 min · "Breathing · stress 34 of
    100" · primary "Start 5-min session"
- **Weight & fasting card.** `--color-neutral-100`, 1px `--color-divider`,
  `--radius-lg`, 22px padding. `<h4>` + "30-day window". Four stats in
  `repeat(4, minmax(0,1fr))` — Current 94.2 kg · Rate −0.42 kg/wk · Goal
  85.0 kg · Fasts ≥16 h 18 of 30 (uppercase 11.5px label over Caprasimo 26px).
  Below, a 15-bar 88px column chart, 4px gaps, `--color-accent-2-300`, the last
  three stepping to `-500`, `-500`, `--color-accent`; heights descend
  100→69% (the weight trend).

*Right rail*, 16px gaps:

- **Recommended for you** — `--color-accent-100` fill, 1px
  `--color-accent-300`, `--radius-lg`, 20px padding. Uppercase label in
  `--color-accent-800`; body 14.5px/1.45 in `--color-accent-900`; provenance
  12px "From sleep and HR data, 7–13 September"; primary "Apply" + ghost
  "Why this" in `--color-accent-800`.
- **Also worth acting on** — `--color-neutral-100` card, three items separated
  by 1px `--color-divider` rules: title 14px/700 + one 13px line each (protein
  27 g under target; hydration dips 14:00–18:00; goal reached 22 Nov 2026).
- **Needs your input** — `--color-surface` card: "Dinner not logged · evening
  weigh-in missing · blood pressure due tomorrow." + secondary "Fill in now".

## Wireframes (1a) — screens to build beyond Today

1. **Today** — header, balance ring, six metric tiles, macros + training week,
   and a persistent "log" action that opens screen 02.
2. **Log an entry** — a segmented control across **meal / workout / vitals /
   water / weight / mind**; date + time; a search field with recent items;
   numeric fields (kcal, protein, carbs, fat) for meals; and a read-only block
   for watch-supplied fields, each labelled with its source. Cancel / Save.
3. **Trends** — range pills 30d / 90d / 1y, a metric picker, one chart with a
   trend line and a goal band, three summary stats (avg per week, rate,
   projection), and a correlation table (sleep × resting HR × training load)
   with CSV export. The existing CSV export in `index.html` already builds rows
   of this shape; extend it rather than replacing it.
4. **Insights** — a readiness score with the two inputs that moved it, then
   recommendation cards. Every card must state the data window it was derived
   from.

## Interactions & behavior

- **Navigation.** 1b: five top tabs swap the content region; Today scrolls. 1c:
  sidebar switches Hub / Log / Trends / Insights / Devices, and each hub tile
  opens that domain's workspace with a back path to the hub. Keep the current
  approach of showing/hiding panel `<div>`s and re-running that panel's render
  function.
- **Log an entry** is the one action available from every screen. In 1b it is a
  header-row button; in 1c it also sits in the sidebar.
- **Watch vs. manual.** Every value carries its provenance. Watch-derived fields
  render read-only with a source label and are never silently overwritten by a
  manual edit — on conflict, keep both and mark the manual value as the one in
  use. The sync chip shows relative time since last sync and is the entry point
  to Devices.
- **Recommendation cards** have exactly two actions: apply (writes the change —
  swaps today's session, adds the reminder, adds the food) and dismiss (hides it
  and suppresses that rule for the current window). "Why this" expands the
  derivation. Never show a recommendation without its data window.
- **Fast timer** counts up live from the start timestamp; "End fast" writes the
  duration and clears the running state.
- **Water quick-adds** (+250 / +500 ml) write immediately and re-render the
  tile; they need no confirmation step.
- **States.** Empty (a domain with no data yet shows the tile with an explicit
  "no entries" line and a log action, not a zero), pending (2 entries pending
  review → Needs your input), loading (skeleton at the tile's final height so
  the grid does not reflow), error (a save failure keeps the form open and
  states which field failed).
- **Transitions** are short and functional — 120–180ms ease on hover tints and
  panel swaps. No decorative motion; the tone is clinical and precise.
- **Responsive.** The mockups are drawn at 1220px. Collapse the hi-fi grids at
  narrower widths: tile grids `repeat(3,…)` → 2 → 1; 1b's 290px balance column
  stacks above the tiles; 1c's 300px rail moves below the hub and its sidebar
  becomes a top row of pills. All text blocks must reflow — nothing in the
  design needs a fixed height.

## State & data

Existing resource keys in `api/data.php` are
`['nutrition','weighins','history','checked','weights','theme']`. This design
needs new ones — add them to `$ALLOWED_RESOURCES` (the table stores one JSON
blob per user per key, so no schema change is required):

| Key | Shape |
| --- | --- |
| `water` | `[{date, entries:[{time, ml}], targetMl}]` |
| `sleep` | `[{date, totalMin, deepMin, remMin, lightMin, awakeMin, source}]` |
| `vitals` | `[{date, time, systolic, diastolic, glucose, spo2, hrv, restingHr, source}]` |
| `mind` | `[{date, minutes, kind, stressScore}]` |
| `fasting` | `[{startedAt, endedAt, windowHours}]` |
| `goals` | `{kcal, protein, carbs, fat, waterMl, steps, goalWeightKg, sleepMin}` |
| `devices` | `{provider, lastSyncAt, battery}` |

Derived client-side, not stored: daily balance score, readiness, 7/30-day
averages and deltas, weight trend and projection date, training load, adherence,
and the recommendation set. Keep derivation in pure functions that take the
loaded arrays and a date range — the recommendation copy quotes its own inputs,
so those functions need to return the numbers they used, not just a verdict.

Client state to add: `activePanel` (or `activeDomain` + `view` for 1c), the
selected trend range and metric, the running fast, the log-form draft, and a
dismissed-recommendations set with its expiry window.

## Assets

None. No photography, no bitmaps. Every chart in the mockups is plain HTML —
flex rows of `div` bars, a `conic-gradient` ring, `999px` tracks with a percentage
fill — so they can be recreated without a chart library. Icons: use
[Lucide](https://lucide.dev) at `stroke-width: 2.75`, per the design system. The
sidebar/nav items in the mockups have no icons yet; adding Lucide glyphs there is
expected.

## Files

- `Full Circle Health.dc.html` — the three mockups (wireframes 1a, tabs 1b, hub
  1c) on one canvas. Open it in a browser to read exact values off the markup.
  It carries four props at the top (`units` kg/lb, `goalWeight`,
  `showWatchBadges`, `showWireframes`) that only affect the mockup, not the
  design.
- `styles.css` — the Organic design system: tokens in `:root`, then the
  component layer (`.btn`, `.tag`, `.card`, `.field`, `.input`, `.seg`,
  `.table`, `.dialog`, `.washed`). Link this, or port its `:root` block into the
  target codebase's own token layer.
