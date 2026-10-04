# Note Library Admin API

This PHP API is deployed from the same `admin` branch and domain as the admin portal. Production URL: `https://admin.notelibraryapp.com/api/v1`; the portal calls it same-origin, so no cross-origin browser request is needed. Student and admin endpoints remain separate; this API serves the admin portal.

## cPanel deployment

GitHub Actions builds and deploys the `admin` branch to `/home/notelibr/admin.notelibraryapp.com`; the PHP API lives under that same domain at `/api`. See the repository-root `DEPLOYMENT.md` for the one-time SSH and GitHub environment setup. cPanel's manual **Deploy HEAD Commit** option remains available through `.cpanel.yml` and invokes the same path-guarded deployment script.

Before the first automatic deployment, authorize a dedicated SSH key in cPanel and add the required values to GitHub's `admin-production` environment. The server deployment script creates a verified private backup before replacing the document root, preserves `.well-known`, `cgi-bin`, API credentials, and API storage, and never writes to the student site or a separate API subdomain.

On the server, copy `backend/config.example.php` to `/home/notelibr/admin.notelibraryapp.com/api/config.local.php` after the first deploy. Replace every placeholder with the real cPanel MySQL values. Generate `APP_KEY` with `php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"`; never commit the resulting secret. Ensure the database and required schema migrations exist before expecting authentication or admin data to work.

The configuration file maps `DB_NAME` / `DB_USER` to the API's `DB_DATABASE` / `DB_USERNAME` environment names and only supplies values that are not already set in the environment. Restrict permissions on `config.local.php` (normally `0600`) and keep `/api` protected by its `.htaccess` rules.

## Local development

1. Copy `.env.example` to `.env` and set database credentials and a random `APP_KEY` of at least 32 characters.
2. Ensure the student backend has applied the shared schema migrations; this backend includes the same migration files and safely skips migrations already recorded in `schema_migrations`.
3. Run `php -S 127.0.0.1:8081 -t public public/index.php`.
4. Set the admin portal's `VITE_API_BASE_URL` to `http://127.0.0.1:8081/api/v1` (or use the production same-origin setting from `.env.production`).

The API uses its own `nl_admin_session` and `nl_admin_csrf` cookies plus local logs/cache. Keep `FRONTEND_ORIGINS` limited to exact trusted origins.
