# Food review (shared AI Assist / My Entry foods)

Foods people make with **AI Assist** or **Manual Log** are private to them. When several different
people independently make the same dish, that is a good sign it belongs on the food list, but the
numbers are user estimates, so a person has to check them against a real source first.

## How it works

1. **Opt-in.** Account → Help improve the food list (off by default). Stored as the per-user
   `sharing` setting (`{"foods": true}`).
2. **Candidates.** Foods with the same name (word order, punctuation and case ignored) made by at
   least **3 different opted-in users**. Each user counts once (their newest matching food). Values
   are compared **per 100 g / ml** (or **per serving** when the food has no weight). The result shows
   the median and range, and flags foods where users disagree by more than 25% on calories.
   No user ids or emails are included.
3. **Admin view.** Me → Admin → *Food review*. Mark each item **Reviewed** or **Dismiss**; either
   removes it from the list and from future digests.
4. **Digest.** On the 1st and 16th of each month `api/food_review_digest.php` emails the admin
   the candidates that have not been sent before and records them as "sent".

Nothing is ever published automatically.

## One-time setup on the server

1. Run `db/migrations/007_food_review.sql` on the MySQL database (phpMyAdmin → SQL tab).
2. Add a cron job in cPanel → **Cron Jobs**, custom schedule `0 8 1,16 * *`:

   ```
   /usr/local/bin/php /home/<cpanel-user>/<path-to-site>/api/food_review_digest.php
   ```

   (Use the same PHP path and site folder that cPanel shows for your other cron jobs.)
3. To preview without sending or recording anything, run the same command with `--dry-run`.

The script only runs from the command line; requesting it over HTTP returns 403.
`admin_email` in `api/config.local.php` is where the digest goes.
