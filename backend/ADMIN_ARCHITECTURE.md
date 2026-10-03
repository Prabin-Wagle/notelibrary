# Note Library V2 Admin API

This backend is the only service that registers `/api/v1/admin/*`. The student API is maintained separately in `E:/note_std/backend` and runs on port 8080 in local development; this service runs on port 8081.

## Boundaries

- The admin portal at `E:/note_admin/project` sends API calls to this service. Its local default is `http://127.0.0.1:8081/api/v1`.
- Both APIs use one MySQL database because administrators manage student accounts, catalog, resources, quizzes, payments, and support tickets.
- Admin and student sessions use separate cookie names and route authorization; admin sessions are limited to the `/api/v1/admin` path.
- The admin API uses its own CSRF cookie (`nl_admin_csrf`) so it cannot collide with the student API's CSRF cookie.
- Configure `MEDIA_STORAGE_PATH` to the shared resource upload directory in both services.
- Every admin route except login requires an admin session and role. Mutations require the admin CSRF token and an exact allowed frontend origin.

Run with `php -S 127.0.0.1:8081 -t public public/index.php`. See `README.md` for configuration and migrations.
