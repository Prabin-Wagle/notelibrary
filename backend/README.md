# Note Library Admin API

This is the standalone API for `E:/note_admin/project`. It serves only the admin API under `/api/v1/admin/*`; the student API remains in `E:/note_std/backend`.

Both APIs use the same MySQL database because administrators manage student accounts, catalog data, resources, payments, and support tickets. Configure the same `DB_*` values in each backend, with the admin session settings scoped here. Use a long random `APP_KEY` for deployments. Point `MEDIA_STORAGE_PATH` in both backends at the same private upload directory. Do not copy a real `.env` into source control.

## Local development

1. Copy `.env.example` to `.env` and set the database credentials and a random `APP_KEY` of at least 32 characters.
2. Ensure the student backend has applied the shared schema migrations; this backend includes the same migration files and safely skips migrations already recorded in `schema_migrations`.
3. Run `php -S 127.0.0.1:8081 -t public public/index.php`.
4. Set the admin portal's `VITE_API_BASE_URL` to `http://127.0.0.1:8081/api/v1` (the portal default does this when unset).

The admin backend has its own session cookie (`nl_admin_session`), CSRF cookie (`nl_admin_csrf`), logs, rate-limit cache, and media storage. Keep `FRONTEND_ORIGINS` limited to the exact admin portal origins.
