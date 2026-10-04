# Admin portal automatic deployment

The `admin` branch is the only production trigger. Every push to `admin` runs the frontend and PHP checks, builds the Vite app, installs production PHP dependencies, packages the release, and deploys it over SSH to:

`/home/notelibr/admin.notelibraryapp.com`

The PHP API is deployed under that same document root at `/api`; the deployment does not use `api.notelibraryapp.com` and does not touch the student site. Pull requests build and validate, but do not deploy. A manually started workflow can deploy only when run from `admin`.

## One-time GitHub setup

In GitHub, open **Settings → Environments** and create `admin-production`. Add these environment variables:

- `ADMIN_CPANEL_HOST` — the SSH hostname supplied by the hosting provider.
- `ADMIN_CPANEL_PORT` — the cPanel SSH port (usually `22`, but confirm with the host).
- `ADMIN_CPANEL_USER` — the cPanel account username (`notelibr` for this hosting account).
- `ADMIN_CPANEL_KNOWN_HOSTS` — verified SSH `known_hosts` line(s) for the host. Use `host ...` for port 22 or `[host]:port ...` for a nonstandard port. Verify the fingerprint with the hosting provider before saving it; do not trust an unverified `ssh-keyscan` result.

Add this environment secret:

- `ADMIN_CPANEL_SSH_KEY` — a dedicated SSH private key for GitHub Actions. In cPanel **SSH Access → Manage SSH Keys**, authorize its public key. Do not paste the private key into the repository, workflow, or chat.

The GitHub Actions runner must be able to reach the cPanel SSH host. If the host firewall only allows allowlisted IPs, allow GitHub-hosted runner access or use a self-hosted runner on an approved network.

The manual workflow has an `accept_unverified_host_key` option that defaults to **false**. Only enable it for an explicitly approved one-time test: it accepts the first SSH host key and pins it only for that runner job, which still leaves a man-in-the-middle risk on the first connection. Push-triggered deployments never use this option and always require the provider-verified `ADMIN_CPANEL_KNOWN_HOSTS` value.

## First run and ongoing flow

1. Commit this workflow and deployment script to the `admin` branch and push it to GitHub.
2. Open **Actions → Build and deploy admin portal**. Confirm the build completes and the deploy job succeeds. GitHub also runs the build-only checks on pull requests targeting `admin`.
3. Each later push to `admin` repeats the checks and deployment automatically. Type-check, PHP syntax, dependency install, and production build failures prevent deployment. The existing repository currently has many unrelated ESLint errors, so lint is reported as a non-blocking baseline until those are cleaned up.

Before switching the live site, the server script creates and verifies a timestamped, permission-restricted archive under `/home/notelibr/admin-predeploy-backups/`. It stages and validates the new frontend and API first, preserves `.well-known`, `cgi-bin`, `/api/.env`, `/api/config.local.php`, and `/api/storage`, and rolls back the document root if activation checks fail. Backups are retained; remove old snapshots manually only after verifying the retention policy and recovery needs.

The deployment script has a fixed production path for `admin.notelibraryapp.com`. Do not change it to the student domain or a separate API host. The API runtime configuration must be created once on the server at `/home/notelibr/admin.notelibraryapp.com/api/config.local.php` (or `.env`) and is deliberately excluded from GitHub releases.

## cPanel Git Version Control

The repository keeps a top-level `.cpanel.yml` for cPanel's manual **Deploy HEAD Commit** option. That invokes the same guarded script and therefore writes only to the admin domain. Automatic deployments from GitHub are handled by the GitHub Actions workflow above; clicking **Update from Remote** in cPanel alone does not run on every GitHub push.
