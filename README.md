# Note Library

This repository keeps the student and administrator portals on separate deployment branches:

- `student` — student React app and student PHP API (`backend/`)
- `admin` — admin React app and admin PHP API (`backend/`)

The `main` branch is the repository landing page. Deploy each portal from its own branch in cPanel Git Version Control. Before deploying, add a top-level `.cpanel.yml` configured with the exact cPanel document root and backend location for that branch. Do not commit `.env` or production database credentials.
