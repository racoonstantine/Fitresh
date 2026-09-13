# Full Circle — Fitness Tracker

Multi-user workout, nutrition, fasting, and weight tracker. Static frontend
(`public/`) + a small PHP/MySQL API (`api/`) so each account's data is private
to them. Deploys to Namecheap shared hosting automatically via GitHub Actions
on every push to `main`.

## How it fits together

- **`public/index.html`** — the whole frontend. One file, no build step, no
  framework. Talks to the API with `fetch()` for login/signup and for every
  read/write of workout, nutrition, weigh-in, etc. data.
- **`api/`** — PHP endpoints:
  - `auth.php` — register / login / logout / who-am-i, via PHP sessions.
    New signups are created with `status = 'pending'` and can't log in until
    approved (see "Admin approval for new signups" below).
  - `approve.php` — the link in the admin approval email hits this to
    approve/reject a pending signup.
  - `data.php` — get/save one user's data for a given resource (nutrition,
    weighins, history, checked, weights, theme), scoped to whoever is logged in
  - `config.local.php` — **not in git.** DB credentials + admin email, created
    once by hand directly on the server.
- **`db/schema.sql`** — the two tables (`users`, `user_data`). Run once, for a
  fresh install.
- **`db/migrations/`** — schema changes made after the initial install, run
  once each against your live database (phpMyAdmin → SQL tab).
- **`tools/seed-owner-data.js`** — a one-time console script to restore your
  own historical data (see below). Never deployed, never run by anyone else.
- **`.github/workflows/deploy.yml`** + **`.github/scripts/sftp_deploy.py`** —
  on every push to `main`, uploads `public/` and `api/` to your Namecheap
  server over SFTP (not rsync — Namecheap's SSH access here is SFTP/SCP-only,
  no remote shell, so rsync-over-ssh doesn't work). `config.local.php` is
  always excluded, so a deploy can never touch your DB credentials.

## One-time server setup (do this before the first deploy)

### 1. Create the MySQL database
In cPanel → **MySQL Databases**:
- Create a database (e.g. `yourcpaneluser_fitness`)
- Create a database user with a strong password
- Add that user to the database with **all privileges**

Then in **phpMyAdmin**, select the new database, open the **SQL** tab, and
paste in the contents of [`db/schema.sql`](db/schema.sql) and run it.

### 2. Create `api/config.local.php` on the server
Via cPanel **File Manager**, once the first deploy has run and `api/` exists
on the server (find it at your domain's actual **Document Root** — check
cPanel → **Domains** list, don't assume it's under `public_html`, addon
domains aren't always nested there): copy `api/config.example.php` to
`api/config.local.php` in the same folder, and fill in the DB name/user/
password from step 1, plus `admin_email` (see "Admin approval for new
signups" below). This file is gitignored on purpose — it only ever exists on
the server, never in the repo.

### 3. Set up the deploy SSH key
You already have SSH access (confirmed via cPanel → SSH Access). We'll make a
**second**, dedicated keypair just for GitHub Actions — don't reuse your
personal Mac key for this.

On your own machine (not here). Windows (PowerShell):
```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.ssh"
ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\namecheap_deploy" -N '""' -C "github-actions-deploy"
```
Mac/Linux:
```bash
ssh-keygen -t ed25519 -f ~/.ssh/namecheap_deploy -N "" -C "github-actions-deploy"
```
This creates two files: `namecheap_deploy` (private) and `namecheap_deploy.pub`
(public).

1. In cPanel → **SSH Access** → **Import Key**, paste the contents of
   `namecheap_deploy.pub`, give it a name, import it, then click **Manage** →
   **Authorize** on that key.
2. Find your SSH host and port: cPanel → SSH Access usually shows a "Connect
   via SSH" command with both (Namecheap shared hosting commonly uses port
   `21098`, not the default `22` — double check yours).
3. Find your deploy path: in File Manager, note the full path to your
   domain's web root (often `/home/<cpanelusername>/public_html`, or a
   subfolder if this domain is an addon domain).

### 4. Add GitHub Actions secrets
In your repo → **Settings** → **Secrets and variables** → **Actions** → **New
repository secret**, add:

| Secret name | Value |
|---|---|
| `NAMECHEAP_SSH_KEY` | contents of `namecheap_deploy` (the **private** key, whole file including the `-----BEGIN...-----` lines) |
| `NAMECHEAP_SSH_HOST` | your server hostname (from step 3) |
| `NAMECHEAP_SSH_PORT` | your SSH port (from step 3) |
| `NAMECHEAP_SSH_USER` | your cPanel username |
| `NAMECHEAP_REMOTE_PATH` | full path to your web root (from step 3) |

None of these ever pass through Claude — you're pasting them directly into
GitHub's own secret store.

### 5. Push
```bash
git push -u origin main
```
Watch the **Actions** tab in GitHub — that's your first automated deploy.
Every future `git push` to `main` redeploys automatically.

## Restoring your own historical data

Your original month of workout/nutrition history used to be hardcoded into
the app itself — that had to change, because it would've auto-inserted into
*every* friend's new account too. It now lives in
[`tools/seed-owner-data.js`](tools/seed-owner-data.js), which you run **once**,
manually, logged in as yourself:

1. Visit your live site and log in (or sign up) as yourself.
2. Open DevTools → Console.
3. Paste the entire contents of `tools/seed-owner-data.js`, press Enter.
4. Reload once you see "Owner data import complete" in the console.

## Admin approval for new signups

Anyone can submit a signup, but new accounts start out `pending` and can't log
in until you approve them. When someone signs up, the server emails
`admin_email` (set in `api/config.local.php`) with **Approve** / **Reject**
links — clicking one updates the account and, for approve, they can log in
right away.

This relies on PHP's built-in `mail()`, which uses the server's local mail
setup — on Namecheap shared hosting this generally works out of the box, but
check your spam folder the first time, and if nothing arrives at all, an
authenticated SMTP method (e.g. PHPMailer through a real cPanel email account)
is more reliable than `mail()` — worth switching to if delivery is flaky.

If you're setting this up on an existing database that predates this feature,
run [`db/migrations/001_add_signup_approval.sql`](db/migrations/001_add_signup_approval.sql)
once — it defaults existing accounts to `approved` so nobody already using the
app gets locked out; only new signups from that point on start `pending`.

## Inviting friends

Signup is open (anyone with the link can create an account) but every account
needs your approval before it can be used, and each approved account only
ever sees its own data. Share the URL, then check your email for the
approval request when someone signs up.

## Local development

There's no build step. To preview the frontend against a local PHP server:
```bash
php -S localhost:8000 -t public
```
You'll also need a local MySQL database and `api/config.local.php` pointed at
it, and to run `php -S localhost:8000` from the repo root instead so `/api/`
resolves — e.g. `php -S localhost:8000` from the repo root, then browse to
`http://localhost:8000/public/index.html`.
