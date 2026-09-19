# Live food database validator

Double-click `H:\Site_Projects\Fitness_Win\Launch Food DB Validator.cmd`,
then open http://127.0.0.1:8765. Keep the launcher window open; Ctrl+C stops it.
The launcher uses the installed Codex Python runtime or falls back to Python
on PATH. There are no third-party dependencies or build steps.

Server: `tools/food_validator.py`. Interface: `tools/food_validator.html`.
CSV directory: `data/food-db`. Run from any directory with the launcher, or run
`python tools/food_validator.py --port 8766` from the repository to choose a
different port (then use that port in the browser).

All records are visible by default, including KFC and Mang Inasal estimates,
inactive records, and unresolved identities. Searches include aliases and food
IDs, ignore accents, and ignore spacing/punctuation inside names. Results are
paged in groups of 100. Filters are for inspection, not production eligibility.

The server reads current CSV files for every query and detail request. The
browser checks file revisions every three seconds and reloads results and the
selected food when changes are detected. Refresh now forces a fresh read.
During a multi-file database update, wait for the update to finish before using
the result as a final validation; a read overlapping a file write is rejected.

Select an estimate explicitly to inspect its calculated nutrition; estimates
remain labeled and never become verified values. Unknown nutrients are shown
as unknown. Source details and raw estimate records retain provenance. Grams
scale nutrition; the tool does not assume ml density or a piece weight.

The server binds only to 127.0.0.1, serves only its own interface and API, and
does not write CSVs, change production search, or deploy the app. Existing
production search excludes estimate-only entries by default. Both app search
screens now offer an explicit Include estimates checkbox for eligible entries;
incomplete models remain visible only in this validator.
