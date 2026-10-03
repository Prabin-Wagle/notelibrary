# Note Library V2 Student API

This directory contains only the student PHP 8.2, Slim 4, PDO, and MariaDB REST API. The admin API is a separate backend at `E:/note_admin/backend`. Both APIs use the same database and resource upload directory; admin endpoints and admin session configuration are not registered here.

## Local setup

Requirements:

- XAMPP Apache, PHP 8.2+, and MariaDB/MySQL
- PHP extensions: PDO, pdo_mysql, mbstring, openssl, fileinfo, zip
- Composer (a project-local `../composer.phar` is available in this workspace)

Install dependencies:

```powershell
C:\xampp\php\php.exe -d extension=zip ..\composer.phar install --no-dev
```

Copy `.env.example` to `.env`, set a private `APP_KEY`, and configure a dedicated database account. Point `MEDIA_STORAGE_PATH` to the shared resource upload directory. Never commit `.env`.

Create the schema and starter catalog:

```powershell
C:\xampp\php\php.exe bin\migrate.php
C:\xampp\php\php.exe bin\seed.php
```

Run the API directly during development:

```powershell
C:\xampp\php\php.exe -S 127.0.0.1:8080 -t public
```

Health check:

```text
GET http://127.0.0.1:8080/api/v1/health
```

## React request flow

The React application must send cookies:

```ts
fetch(`${API_URL}/auth/me`, {
  credentials: 'include',
});
```

Before a state-changing request, call `GET /api/v1/auth/csrf`, then send the returned value in `X-CSRF-Token`. Keep `credentials: 'include'` enabled.

```ts
const csrfResponse = await fetch(`${API_URL}/auth/csrf`, {
  credentials: 'include',
});
const { data } = await csrfResponse.json();

await fetch(`${API_URL}/profile/preferences`, {
  method: 'PATCH',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': data.csrf_token,
  },
  body: JSON.stringify({ theme: 'dark' }),
});
```

## Student endpoints

Public foundation and authentication:

- `GET /api/v1/health`
- `GET /api/v1/auth/csrf`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/email-verification/request`
- `POST /api/v1/auth/email-verification/confirm`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`

Authenticated student data:

- `GET/PATCH /api/v1/profile`
- `PATCH /api/v1/profile/preferences`
- `GET/POST /api/v1/profile/enrollments`
- `PATCH /api/v1/profile/enrollments/{id}/primary`
- `DELETE /api/v1/profile/enrollments/{id}`
- `GET /api/v1/academic/programs`
- `GET /api/v1/academic/programs/{code}/levels`
- `GET /api/v1/academic/levels/{id}/subjects`
- `GET /api/v1/academic/subjects/{id}/units`
- `GET /api/v1/resources`
- `GET /api/v1/resources/{slug}`
- `GET/POST/DELETE /api/v1/bookmarks...`
- `GET /api/v1/history`
- `POST /api/v1/resources/{id}/progress`
- `GET /api/v1/quizzes`
- `GET /api/v1/quizzes/{id}`
- `POST /api/v1/quizzes/{id}/attempts`
- `PATCH /api/v1/quiz-attempts/{attemptId}/answers/{questionId}`
- `POST /api/v1/quiz-attempts/{attemptId}/submit`
- `GET /api/v1/quiz-attempts/{attemptId}/result`

Admin routes are not registered by this application. They live in the separate `E:/note_admin/backend` service.

## Security model

- Opaque, random session credentials are stored in an HttpOnly cookie.
- Only the SHA-256 hash of a session credential is stored in MariaDB.
- State-changing requests require a signed double-submit CSRF token and an allowed `Origin`.
- CORS uses an explicit frontend allowlist and credentials; wildcard origins are rejected.
- Authentication endpoints are rate-limited.
- Academic content endpoints require authentication.
- Password-reset and email-verification secrets are hashed, expiring, attempt-limited, and single-use.
- PDO uses native prepared statements.
- Error responses include a request ID but do not expose SQL or stack traces in production.

API responses intentionally use ordinary JSON. Scrambling browser responses does not prevent scraping because the browser must possess the decoding logic. Protection comes from authentication, object-level authorization, rate limits, pagination, monitoring, and careful content delivery.

## Apache / cPanel

Point the API domain document root directly to `backend/public`. Keep `.env`, `src`, `database`, `storage`, and `vendor` outside the public document root when the host permits it. The included `public/.htaccess` sends application routes through `public/index.php` and disables directory listing.

Production environment changes:

- `APP_ENV=production`
- `APP_DEBUG=false`
- `APP_URL=https://api.notelibraryapp.com`
- `FRONTEND_ORIGINS=https://student.notelibraryapp.com`
- `SESSION_COOKIE=__Host-nl_session`
- `SESSION_SECURE=true`
- A fresh random production `APP_KEY`
- Production-only database credentials

If cPanel mounts the public entry point below a path instead of a dedicated subdomain, set `API_BASE_PATH` to that path. The preferred production deployment is a dedicated `api.notelibraryapp.com` document root with an empty `API_BASE_PATH`.
