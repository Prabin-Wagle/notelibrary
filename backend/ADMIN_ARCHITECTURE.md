# Note Library V2 API separation

The student and admin portals run independent PHP API applications:

```text
E:/note_std/backend       student API (local port 8080)
E:/note_admin/backend     admin API   (local port 8081)
```

Both APIs use the same MySQL database because admin workflows read and maintain student accounts, academic catalog, resources, quiz content, payments, and support tickets. The admin backend is the only API that registers `/api/v1/admin/*`; the student backend serves student routes only. Each backend has its own entry point, runtime logs, rate-limit cache, configuration, and session cookie. `MEDIA_STORAGE_PATH` must point to the same private upload directory in both environments so student resource pages can read files uploaded by admins.

The admin API project, routes, and setup instructions are documented in `E:/note_admin/backend/README.md`.
