# Personal foods and review queue

Users can open **My foods · Create food** from either food-search screen, enter nutrition per serving, and save a private entry. Search results also offer **Save a personal copy**. Only calories is required (it defaults to 0 in the form so someone who just wants to log the food, macros unknown, doesn't have to type it); protein, carbohydrates, fat and every other nutrient stay unknown when left blank. Explicit zero values are retained.

A serving may have a known gram or milliliter amount. These entries support serving conversion to their recorded measure; gram entries also support ounces. Without a weight or volume, logging is by servings. No density is guessed between grams and milliliters.

Editing creates a new food version. Existing meal components keep their original food ID and nutrient values. The latest version appears in search and My foods (up to 200 current entries). Entries are labeled User entered; saving does not verify them.

## Enable on the server

Apply `db/migrations/005_personal_foods.sql` to the application's MySQL database after migration 003, then deploy the changed API and public files together. Migration 005 adds version metadata and the submission queue; it does not overwrite the curated food CSV or existing nutrition. This migration has not been applied to the live server by this implementation task.

The endpoint requires the existing authenticated session. Writes require a session CSRF token and JSON. Retry keys prevent duplicate saves; stale edits are rejected. Owners can access only their own private foods.

## Shared database curation

The submission checkbox defaults to unchecked. Checking it sends an immutable snapshot of that version's food details, notes and source link to the review queue. It does not publish the food. Source photos are links, not uploaded files.

On the configured application server, use:

```sh
php tools/review_food_submissions.php list
php tools/review_food_submissions.php show 123
php tools/review_food_submissions.php review 123 needs_evidence "Need a readable nutrition label and serving weight."
php tools/review_food_submissions.php review 123 ready_for_curation "Source checked; ready for duplicate and alias review."
```

Allowed review decisions are `needs_evidence`, `ready_for_curation`, and `rejected`. This operator-only CLI does not publish entries. Before manually adding a candidate to the shared database, check duplicates, source reliability, serving basis, aliases and confidence; preserve provenance and document any replacement of manually verified values. FNRI/PhilFCT remains the first verification source where applicable. A submitted personal entry must never automatically become a verified shared entry.

## Validation

`php tools/test_personal_foods.php` exercises the actual save and conversion code with SQLite: ownership, normalization, unknown versus zero, immutable edits and review snapshots, retry idempotency, stale edits and invalid inputs. Existing measurement and food-search UI regression tests also apply. SQLite integration tests do not replace a staging MySQL migration smoke test.

`tools/preview_personal_foods.cjs` serves an isolated browser fixture on localhost:8781 with in-memory mock responses. It uses the real form assets, but does not test production authentication or MySQL persistence.
