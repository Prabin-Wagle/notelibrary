# Note Library — Student Portal

This branch contains the student React/Vite application at the repository root and the student PHP API in `backend/`.

## Build locally

- Install Node.js 20+ and PHP 8.2+ with Composer.
- Run `npm ci`, then `npm run build`.
- Configure the frontend API origin as `VITE_API_BASE_URL` for the target environment.
- Install the API with `composer install --no-dev` in `backend/`.

See `backend/README.md` and `backend/.env.example` for API setup. Put real API/database secrets in a server-side `.env`; never commit it.

## cPanel deployment

The source is ready to clone from the `student` branch in cPanel Git Version Control. The repository does not include a deployment hook yet because the student website/API document roots and production API URL have not been provided. Configure those paths first, then add a top-level `.cpanel.yml` for this branch.