# Exercise library and session logging

The Train screen now includes a shared searchable library, Strength A/B starter templates, and private editable workout sessions. The original routines and historical `user_data` records remain untouched. New sessions appear in the new Recent sessions section; legacy dashboards and exports currently continue to use legacy history only.

## Install

1. Back up the database.
2. Run `db/migrations/004_workout_library.sql` in phpMyAdmin.
3. Run `db/workout_seed.sql` in the same database.
4. Deploy `api/workouts.php`, `api/workout_validation.php`, `public/workouts.js`, `public/workouts.css`, and the updated `public/index.html` through the normal deployment workflow.

The migration and seed are rerunnable. They do not rewrite existing history. The API reports a storage error when the migration is missing. Roll back the frontend assets to hide the new panel; leave the new tables intact to preserve saved sessions.

## Data conventions

- Each session has a client-generated UUID. Saves replace that session atomically, so retries do not create another session. Every read, edit, and delete is scoped to the authenticated user. Several sessions may share the same date.
- Each activity occurrence stores its catalog snapshot, measurements, and ordered sets. Editing a session refreshes its catalog snapshot from the current definition.
- Weight is stored in kg. For paired dumbbells, enter the combined load. For unilateral work, record each side as a separate set. Body mass is excluded from external lifting volume. Assisted and added-weight variants need separate catalog definitions in a later release.
- Volume is the sum of actual reps × external kg. It is a recording summary, not a measure of calorie expenditure or a fair comparison between different exercises.
- Duration is stored in seconds; distance in km. Optional measurements remain null. Entered calories and heart rate are manual observations; they are not estimated by the app.
- Style is a session label in this release. Superset groups, interval phases, rest timers, scheduled plans, preference matching, and automatic progression are future work.
- Sessions store their local activity date and IANA timezone. The source/external ID columns reserve a per-user unique provider key. Future integrations still need exact timestamps, per-metric provenance, consent/authentication, and cross-provider reconciliation before enabling device import.
- API history returns the latest 200 sessions. Pagination, combined legacy/new analytics, and export are follow-up work.

## Verification

Run `php tools/test_workouts.php`, `node tools/test_workouts_ui.cjs`, `php -l api/workouts.php`, `php -l api/workout_validation.php`, and `node --check public/workouts.js`.

`node tools/preview_workouts.cjs` serves an isolated in-memory UI fixture at `http://127.0.0.1:8766`. Browser checks verified search, adding sets, saving strength work, editing, switching units, and saving a second sports session on the same date. This fixture tests the interface, not the MySQL API.

Rebuild catalog SQL using `node tools/build_workout_seed.cjs`. The original legacy definitions are retained as the input for the two starter templates.

Before production enablement, verify against a configured MySQL instance: run both SQL files twice, save two sessions on the same date, retry the same ID, edit and delete, and confirm a second user cannot read or modify the first user's sessions. This workstation lacks the MySQL PDO driver and live database credentials, so these database integration checks cannot run locally.
