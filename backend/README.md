# Note Library Admin API

This PHP API is deployed from the same `admin` branch and domain as the admin portal. Production URL: `https://admin.notelibraryapp.com/api/v1`; the portal calls it same-origin, so no cross-origin browser request is needed. Student and admin endpoints remain separate; this API serves the admin portal.

## Manual cPanel deployment

There is no GitHub Actions or cPanel Git auto-deploy in this setup. Build the portal locally with `npm ci` and `npm run build`, then upload the **contents** of `dist/` to the admin domain's document root (`/home/notelibr/admin.notelibraryapp.com`). Upload the contents of `backend/` into that document root's `/api` directory. The API is served on the same host at `https://admin.notelibraryapp.com/api/v1`.

Do not overwrite server-only files when uploading an update: preserve `/api/config.local.php` (or `/api/.env`), `/api/storage`, `.well-known`, and `cgi-bin`. Keep database credentials and `APP_KEY` only in the server-side configuration; never put them in the frontend build or commit them. If composer dependencies are not already included in the uploaded backend, run `composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader` in `/api` using cPanel Terminal.

For a first setup, copy `backend/config.example.php` to `/api/config.local.php` on the server and replace placeholders with the cPanel MySQL values. Generate `APP_KEY` with `php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"`; never commit the resulting secret. Ensure the database and required schema migrations exist before expecting authentication or admin data to work.

The configuration file maps `DB_NAME` / `DB_USER` to the API's `DB_DATABASE` / `DB_USERNAME` environment names and only supplies values that are not already set in the environment. Restrict permissions on `config.local.php` (normally `0600`) and keep `/api` protected by its `.htaccess` rules.

## Local development

1. Copy `.env.example` to `.env` and set database credentials and a random `APP_KEY` of at least 32 characters.
2. Ensure the student backend has applied the shared schema migrations; this backend includes the same migration files and safely skips migrations already recorded in `schema_migrations`.
3. Run `php -S 127.0.0.1:8081 -t public public/index.php`.
4. Set the admin portal's `VITE_API_BASE_URL` to `http://127.0.0.1:8081/api/v1` (or use the production same-origin setting from `.env.production`).

The API uses its own `nl_admin_session` and `nl_admin_csrf` cookies plus local logs/cache. Keep `FRONTEND_ORIGINS` limited to exact trusted origins.
