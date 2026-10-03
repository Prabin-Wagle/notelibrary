# Note Library Admin API

This PHP API is deployed from the same `admin` branch and domain as the admin portal. Production URL: `https://admin.notelibraryapp.com/api/v1`; the portal calls it same-origin, so no cross-origin browser request is needed. Student and admin endpoints remain separate; this API serves the admin portal.

## cPanel deployment

The repository root contains `.cpanel.yml` and `deploy-cpanel.sh`. The script deploys the committed Vite build to `/home/notelibr/admin.notelibraryapp.com` and the PHP app under `/api`. It replaces app files but preserves `.well-known`, `cgi-bin`, and private API runtime state (`/api/config.local.php`, `/api/.env`, and `/api/storage`). It refuses to run unless the dated private backup ZIP exists.

Before the first deployment:

1. In cPanel File Manager, create `/home/notelibr/admin-predeploy-backups` and compress the complete current `/home/notelibr/admin.notelibraryapp.com` directory into `admin.notelibraryapp.com-20261003.zip` in that private folder. Do not place the ZIP under the public document root.
2. Copy `backend/config.example.php` to `/home/notelibr/admin.notelibraryapp.com/api/config.local.php` after the first deploy. Replace every placeholder with the real cPanel MySQL values. Generate `APP_KEY` with `php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"`; never commit the resulting secret.
3. Ensure the database and required schema migrations exist. The API cannot authenticate or load admin data until valid DB credentials and the shared schema are installed.
4. In cPanel Git Version Control, select the `admin` branch, click **Update from Remote**, verify the latest commit, then **Deploy HEAD Commit**. Subsequent deploys keep the private config, logs, cache, and uploads.

The configuration file maps `DB_NAME` / `DB_USER` to the API's `DB_DATABASE` / `DB_USERNAME` environment names and only supplies values that are not already set in the environment. Restrict permissions on `config.local.php` (normally `0600`) and keep `/api` protected by its `.htaccess` rules.

## Local development

1. Copy `.env.example` to `.env` and set database credentials and a random `APP_KEY` of at least 32 characters.
2. Ensure the student backend has applied the shared schema migrations; this backend includes the same migration files and safely skips migrations already recorded in `schema_migrations`.
3. Run `php -S 127.0.0.1:8081 -t public public/index.php`.
4. Set the admin portal's `VITE_API_BASE_URL` to `http://127.0.0.1:8081/api/v1` (or use the production same-origin setting from `.env.production`).

The API uses its own `nl_admin_session` and `nl_admin_csrf` cookies plus local logs/cache. Keep `FRONTEND_ORIGINS` limited to exact trusted origins.
