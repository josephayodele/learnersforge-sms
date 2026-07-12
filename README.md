# The Learners Forge — School Management System

Monorepo for the LearnersForge SMS.

```
learnersforge/   React + Vite frontend (source)
backend/         PHP 8 REST API (app/, config/, database/, public/)
.cpanel.yml      cPanel Git deployment manifest
```

> The legacy `learnersforge-backend/` folder is superseded by `backend/` and is
> git-ignored. `backend/` is the copy that actually runs.

## Local development

**Backend** (XAMPP): serve `backend/` under Apache so the API answers at
`http://localhost/learnersforge/public/api/v1`. Create `backend/config/database.php`
from `database.php.example`. Requires **PHP 8+** (uses `match`, `str_starts_with`).

**Frontend**:
```bash
cd learnersforge
npm install
npm run dev
```
The API base defaults to the local XAMPP path; override it with `VITE_API_BASE`
(see `learnersforge/.env.production.example`).

## Database

Create the MySQL database, then run the migrations in order, plus the seeder:
```
backend/database/migrations/001_schema.sql
backend/database/migrations/003_school_logo.sql
backend/database/migrations/004_remark_ranges.sql
backend/database/migrations/005_remark_ranges_class.sql
backend/database/seeders/002_demo_data.sql   (optional demo data)
```

## Deploying to Bluehost cPanel — API at `api.sjacedu.ng`

Repo: `https://github.com/josephayodele/learnersforge-sms.git`

1. **cPanel → Git™ Version Control → Create.** Paste the repo URL. For a private
   repo, copy the SSH key cPanel shows into the GitHub repo's
   **Settings → Deploy keys** (read access is enough), then **Update from Remote**.
2. **cPanel → Domains → create subdomain** `api.sjacedu.ng` with Document Root
   `/home/CPANELUSER/learnersforge-api/public`.
3. **cPanel → MultiPHP Manager:** set `api.sjacedu.ng` to **PHP 8.x**.
4. **cPanel → MySQL Databases:** create a database + user, then import the SQL in
   `backend/database/migrations` (`001`,`003`,`004`,`005`) and optionally
   `seeders/002_demo_data.sql` (via phpMyAdmin).
5. **Create `/home/CPANELUSER/learnersforge-api/config/database.php`** on the
   server from `backend/config/database.php.example` with the real DB credentials.
   (It's git-ignored and never overwritten by a deploy.)
6. **Edit `.cpanel.yml`** — replace `CPANELUSER` with your Bluehost username
   (confirm the `/home/...` path in File Manager) — then **Deploy HEAD Commit**.
7. Browse `https://api.sjacedu.ng/api/v1/classes` — you should get JSON.

### Frontend
The build already targets `https://api.sjacedu.ng/api/v1` (baked into
`learnersforge/dist`). Host the built site wherever the app lives (e.g.
`sjacedu.ng`) — its origin must be in the API's CORS allowlist in
`backend/public/index.php` (currently `sjacedu.ng` and `www.sjacedu.ng`).
To retarget the API, edit `learnersforge/.env.production`, run `npm run build`,
and commit `learnersforge/dist/`.

### How cPanel talks to GitHub
cPanel does **not** log into your GitHub account. It clones the repo using a
**deploy key** you add to the repo, and pulls on demand (or via a webhook you
configure). Pushing is always done from your machine.
