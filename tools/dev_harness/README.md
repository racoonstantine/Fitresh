# Dev harness

Runs the real `api/*.php` against a throwaway **SQLite** database with fixed fixture data,
and serves the live `public/` folder, so logged-in screens can be tested without MySQL.
It works on a temp copy; the real `api/config.local.php` is never read or changed.

```
node tools/dev_harness/start.cjs [--port 8124]   # http://127.0.0.1:8124, Ctrl+C cleans up
node tools/dev_harness/smoke.cjs                 # 15 API checks on its own port, then tears down
```

Accounts (password `testpass123`):

| Account | Data |
|---|---|
| `tester@example.com` | 28 days of weigh-ins, 14 days of nutrition/water/steps/sleep, 4 history entries, Moderate training plan |
| `other@example.com` | empty (onboarding and ownership checks) |
| `admin@example.com` | admin console (the copy of `admin_guard.php` is patched to this address) |

Fixture dates are relative to today, but the content is deterministic. Edit `fixtures.php`.
Today itself is left empty on purpose so the log/save flows can be tried.

How it works:
- `sqlite_pdo.php`: a PDO subclass translating MySQL bits at prepare time (`NOW()`, `DATE_ADD`,
  `ON DUPLICATE KEY UPDATE`, `FOR UPDATE`, `<=>`), plus a MySQL-DDL to SQLite converter used to build
  the schema from `db/schema.sql`, `db/migrations/*.sql` and `db/workout_seed.sql`.
- `setup.php`: builds the temp copy, swaps `get_db()`, patches `ADMIN_EMAILS`, seeds users and data.
- `router.php`: `/api/*` served from the temp copy, everything else from `public/`.

If a new API query uses another MySQL-only feature, the smoke test or the page will fail loudly;
add a translation in `sqlite_pdo.php`. A new `ON DUPLICATE KEY UPDATE` table needs a
`CONFLICT_TARGETS` entry. Not covered: `food_search.php` (proxies Open Food Facts over the network)
and outgoing email.
