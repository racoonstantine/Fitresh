# Fitresh — Data Import Schema (v1.0)

This is the JSON format Fitresh's **Account → My data → "Import structured
data (.json)"** button reads. If you're migrating history from another app,
chat log, or spreadsheet, paste the prompt at the bottom of this file into
that other tool (or hand it this whole file) and ask it to produce a JSON
file in this exact shape — then upload it in Fitresh.

Every top-level key is optional — include only what you have. Dates are
always `"YYYY-MM-DD"`. Anything you don't know, omit or set to `null` rather
than guessing.

## Top-level shape

```json
{
  "version": "1.0",
  "weighIns": [ ... ],
  "sleep": [ ... ],
  "fasting": [ ... ],
  "water": [ ... ],
  "nutritionDays": [ ... ],
  "workouts": [ ... ]
}
```

### `weighIns`
One entry per day you weighed yourself.

```json
{"date": "2026-09-16", "kg": 70.2}
```

### `sleep`
One entry per night, keyed by the date you *woke up*. Give either
`bedtime`/`waketime` (local timestamps, `YYYY-MM-DDTHH:mm`) and hours gets
computed automatically, or just `hours` directly if that's all you have.

```json
{"date": "2026-09-16", "bedtime": "2026-09-15T22:30", "waketime": "2026-09-16T06:15", "hours": 7.75}
```

### `fasting`
The final fasting duration for a day (hours, decimal — e.g. 16.5 = 16h30m).

```json
{"date": "2026-09-16", "hours": 16.5}
```

### `water`
Total ml drunk that day (not incremental — the day's final total).

```json
{"date": "2026-09-16", "ml": 2000}
```

### `nutritionDays`
One entry per day, broken into meals, each meal broken into individual food
items with their own macros. This is the important one — **itemize every
food, don't just give a day total.** `notes` is optional free-text context
for the day (travel, off days, etc.) and gets attached to that day's record.

```json
{
  "date": "2026-09-16",
  "notes": "Back to normal home eating after two travel/social days at uncle's house.",
  "meals": [
    {
      "mealType": "lunch",
      "items": [
        {
          "name": "Boiled okra",
          "amount": 112, "unit": "g",
          "calories": 37, "protein": 1.9, "fat": 0.1, "carbs": 6.5,
          "fiber": null, "sugar": null, "sodiumMg": null, "cholesterolMg": null
        },
        {
          "name": "Roast chicken from Sr. Pedro",
          "amount": 179, "unit": "g",
          "calories": 300, "protein": 36, "fat": 16.5, "carbs": 3.5
        }
      ]
    }
  ]
}
```

Field notes:
- `mealType`: one of `breakfast`, `lunch`, `dinner`, `snack`, `custom`.
- `amount`/`unit`: the actual portion you ate that day (`unit` is usually
  `g`, `ml`, or `serving`).
- `calories`/`protein`/`fat`/`carbs`: required, for that portion (not per
  100g — the amount actually eaten).
- `fiber`/`sugar`/`sodiumMg`/`cholesterolMg`: optional, same basis (grams for
  fiber/sugar, milligrams for sodium/cholesterol). Omit or `null` if unknown.

### `workouts`
One entry per logged session.

```json
{
  "date": "2026-09-16",
  "type": "A",
  "exercises": [
    {"name": "Goblet Squat", "weight": "6kg"},
    {"name": "Dumbbell Row (bent over)", "weight": "24.5kg"}
  ],
  "notes": "Warm-up completed. RDL at 24.5kg for a 3rd consecutive clean session, no dizziness.",
  "stats": {
    "duration": "01:17:00",
    "calories": 674,
    "hr": 121,
    "maxHr": 144,
    "distance": null,
    "pace": null,
    "steps": null,
    "elevation": null,
    "trainingStress": 2.4,
    "recoveryHr": 7,
    "hrZones": {"warmup": 48, "fatBurn": 22, "aerobic": 6, "anaerobic": null}
  }
}
```

Field notes:
- `type`: `A` or `B` (strength days), `steady` or `interval` (cardio days),
  or `custom` (anything off-plan — give it a `label` too, e.g.
  `"label": "Outdoor run"`).
- `exercises`: only for strength days (`A`/`B`) — list what you did with the
  weight used, as a string like `"24.5kg"`. Leave empty `[]` for cardio.
- `stats`: all optional, all from a watch/fitness app if you have it —
  `duration` as `"HH:MM:SS"` or `"MM:SS"`, `distance` in km, `hr`/`maxHr` in
  bpm, `pace` as e.g. `"12'56\""` (per km), `steps` as a count, `elevation`
  in meters, `trainingStress` as whatever 0–10-ish score your source uses,
  `recoveryHr` as the bpm drop in the minute after finishing, and `hrZones`
  as minutes spent in each zone (any/all of the four can be `null`).

## What happens on import

- Weigh-ins, sleep, fasting, water, and workouts merge directly — matching
  dates get overwritten with the imported value, nothing else is touched.
- Each food item becomes its own entry in your food library (so the amount
  and macros you specify are exactly what gets logged — no guessing at
  "per 100g" conversions) and gets logged against that day and meal.
  Because a lot of home-cooked dishes vary day to day, items are **not**
  deduplicated by name across days — if you ate "roast chicken" on five
  different days, that's five separate log entries, one per day's actual
  amount/macros. This matches how you'd have logged it in the app by hand.
- A day's `notes` field attaches to that date's legacy daily record (visible
  in the Nutrition Dashboard's "What was eaten" / history list) alongside
  the itemized food entries.
- Importing itemized food days is the slow part — it's one food-creation
  API call plus one log call per item, done one at a time, so it can take a
  while for a lot of history. Leave the tab open until it says "Import
  complete."

## Prompt template

Paste this into whatever chat/app already has your data, filling in the
`<...>` bits, and ask it to output the JSON directly (or as a downloadable
file):

> I need you to export my [nutrition / workout / sleep / weight] history as
> JSON matching this exact schema: [paste this whole markdown file, or just
> the sections you need]. Cover every day you have data for from
> `<start date>` to `<end date>`. For nutrition, break each day down into
> individual food items with their own amount and macros — don't summarize
> into day totals. Carry over any notes or context you have per day/session.
> Output only the JSON, no commentary.
