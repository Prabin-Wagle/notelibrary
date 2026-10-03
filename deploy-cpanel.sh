#!/usr/bin/env bash
set -euo pipefail

readonly deploy_path="/home/notelibr/admin.notelibraryapp.com"
readonly api_path="${deploy_path}/api"
readonly required_backup="/home/notelibr/admin-predeploy-backups/admin.notelibraryapp.com-20261003.zip"

if [[ "${deploy_path}" != "/home/notelibr/admin.notelibraryapp.com" || ! -d "${deploy_path}" ]]; then
    echo "Unexpected or missing admin document root; refusing deployment." >&2
    exit 1
fi
if [[ ! -f "${required_backup}" ]]; then
    echo "Private pre-deployment ZIP is missing; refusing to replace the live site." >&2
    exit 1
fi
if [[ ! -f dist/index.html || ! -f backend/public/index.php || ! -f backend/vendor/autoload.php ]]; then
    echo "Build or PHP dependencies are missing from this commit." >&2
    exit 1
fi

mkdir -p "${api_path}"

# Replace the site files, retaining cPanel's certificate and CGI directories plus API runtime data.
shopt -s dotglob nullglob
for item in "${deploy_path}"/*; do
    case "${item}" in
        "${deploy_path}/.well-known"|"${deploy_path}/cgi-bin"|"${api_path}") continue ;;
    esac
    rm -rf -- "${item}"
done

# Replace API code while keeping private credentials and runtime uploads/logs/cache.
for item in "${api_path}"/*; do
    case "${item}" in
        "${api_path}/.env"|"${api_path}/config.local.php"|"${api_path}/storage") continue ;;
    esac
    rm -rf -- "${item}"
done

cp -R -- dist/. "${deploy_path}/"
cp -R -- backend/. "${api_path}/"

echo "Admin frontend and same-origin API deployed to ${deploy_path} (API: /api)."
