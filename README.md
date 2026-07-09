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

## Deploying to cPanel (GitHub → cPanel Git Version Control)

1. **Push this repo to GitHub** (see below).
2. **cPanel → Git™ Version Control → Create**, paste the repo's SSH URL.
   For a private repo, copy the SSH key cPanel shows into the GitHub repo's
   **Settings → Deploy keys** (read access is enough), then Pull.
3. **Create the database** in cPanel (MySQL Databases), import the migrations,
   and create `/home/<user>/api/config/database.php` with the real credentials.
4. **Create an `api` subdomain** with document root `/home/<user>/api/public`.
5. **Set the production API base and rebuild the frontend** before each deploy:
   ```bash
   cd learnersforge
   echo "VITE_API_BASE=https://api.yourdomain.com/api/v1" > .env.production
   npm run build
   ```
   Commit the updated `learnersforge/dist/` (the deploy copies it to the web root).
6. Edit `.cpanel.yml` — replace `CPANELUSER` with your account name — then
   **Deploy HEAD Commit** in cPanel.

### How cPanel talks to GitHub
cPanel does **not** log into your GitHub account. It clones the repo over SSH
using a **deploy key** you add to the repo, and pulls on demand (or via a webhook
you configure). Pushing is always done from your machine.
