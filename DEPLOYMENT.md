# cPanel deployment setup

1. In cPanel → Git Version Control, clone this repository twice if you need both portals deployed separately; choose the `student` branch for this copy.
2. Obtain the exact website and API document roots from cPanel Domains. Do not point a public web root at secrets or the entire repository.
3. Configure the PHP runtime/extensions and a private `.env` outside public document roots; run Composer without development packages.
4. Add a branch-specific top-level `.cpanel.yml` that copies only the explicit build output and public API entrypoint to the confirmed paths.
5. If using pull deployment, use Update from Remote and then Deploy HEAD Commit. Push deployment requires pushing to the cPanel-managed remote.

The deploy hook is intentionally omitted until the account paths are confirmed.