#!/usr/bin/env bash
set -Eeuo pipefail

# This deployment target is intentionally fixed. Never derive it from a workflow
# input or a branch name: the student portal and api subdomain are out of scope.
readonly account_home="/home/notelibr"
readonly deploy_path="${account_home}/admin.notelibraryapp.com"
readonly backup_dir="${account_home}/admin-predeploy-backups"

release_source="${1:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)}"
release_id="${2:-manual-$(date -u +%Y%m%dT%H%M%SZ)}"

if [[ ! "${release_id}" =~ ^[A-Za-z0-9._-]{1,80}$ ]]; then
    echo "Invalid release identifier; refusing deployment." >&2
    exit 1
fi
if [[ ! -d "${release_source}" ]]; then
    echo "Release source directory does not exist; refusing deployment." >&2
    exit 1
fi
release_source="$(cd -- "${release_source}" && pwd -P)"
case "${release_source}/" in
    "${deploy_path}/"*)
        echo "Release source must not be inside the live document root." >&2
        exit 1
        ;;
esac

if [[ ! -d "${deploy_path}" || -L "${deploy_path}" ]]; then
    echo "Expected admin document root is missing or is a symlink; refusing deployment." >&2
    exit 1
fi
if [[ "$(cd -- "${deploy_path}" && pwd -P)" != "${deploy_path}" ]]; then
    echo "Admin document root resolved to an unexpected path; refusing deployment." >&2
    exit 1
fi
if [[ ! -f "${release_source}/dist/index.html" \
    || ! -f "${release_source}/backend/public/index.php" \
    || ! -f "${release_source}/backend/vendor/autoload.php" \
    || ! -f "${release_source}/backend/.htaccess" ]]; then
    echo "Release is missing the built frontend or PHP API dependencies; refusing deployment." >&2
    exit 1
fi

# Serialize cPanel and GitHub Actions deployments on the hosting account.
exec 9>"${account_home}/.admin-notelibraryapp-deploy.lock"
if ! flock -w 900 9; then
    echo "Another admin deployment still holds the lock; refusing to overlap it." >&2
    exit 1
fi

readonly stage_path="${account_home}/.admin.notelibraryapp.com-stage-${release_id}"
readonly previous_path="${account_home}/.admin.notelibraryapp.com-previous-${release_id}"
readonly failed_path="${account_home}/.admin.notelibraryapp.com-failed-${release_id}"
readonly timestamp="$(date -u +%Y%m%dT%H%M%SZ)-$$"
readonly backup_file="${backup_dir}/admin.notelibraryapp.com-${timestamp}-${release_id}.tar.gz"

if [[ -e "${stage_path}" || -L "${stage_path}" \
    || -e "${previous_path}" || -L "${previous_path}" \
    || -e "${failed_path}" || -L "${failed_path}" ]]; then
    echo "A stage, rollback, or failed-release path for this release already exists; refusing deployment." >&2
    exit 1
fi

cleanup() {
    local result=$?
    trap - EXIT
    if [[ -d "${stage_path}" && ! -L "${stage_path}" ]]; then
        rm -rf -- "${stage_path}"
    fi
    exit "${result}"
}
trap cleanup EXIT

# Assemble the complete replacement away from the live path. Keep cPanel's
# certificate/CGI directories and private API runtime data from the current site.
mkdir -m 755 -- "${stage_path}"
cp -a -- "${release_source}/dist/." "${stage_path}/"
mkdir -m 755 -- "${stage_path}/api"
cp -a -- "${release_source}/backend/." "${stage_path}/api/"

for preserved_dir in .well-known cgi-bin; do
    current="${deploy_path}/${preserved_dir}"
    if [[ -e "${current}" || -L "${current}" ]]; then
        if [[ ! -d "${current}" || -L "${current}" ]]; then
            echo "${current} is not a regular directory; refusing deployment." >&2
            exit 1
        fi
        rm -rf -- "${stage_path:?}/${preserved_dir}"
        cp -a -- "${current}" "${stage_path}/"
    fi
done

current_api="${deploy_path}/api"
if [[ -L "${current_api}" ]]; then
    echo "The existing API path is a symlink; refusing deployment." >&2
    exit 1
fi
if [[ -d "${current_api}" ]]; then
    for runtime_item in .env config.local.php storage; do
        current="${current_api}/${runtime_item}"
        if [[ -e "${current}" || -L "${current}" ]]; then
            if [[ -L "${current}" ]]; then
                echo "${current} is a symlink; refusing to copy private runtime data." >&2
                exit 1
            fi
            rm -rf -- "${stage_path:?}/api/${runtime_item}"
            cp -a -- "${current}" "${stage_path}/api/"
        fi
    done
fi

if [[ ! -f "${stage_path}/index.html" \
    || ! -f "${stage_path}/api/public/index.php" \
    || ! -f "${stage_path}/api/vendor/autoload.php" \
    || ! -f "${stage_path}/api/.htaccess" ]]; then
    echo "Staged release validation failed; the live site has not been changed." >&2
    exit 1
fi

# Snapshot the whole current document root outside public_html before any swap.
if [[ -L "${backup_dir}" ]]; then
    echo "Private backup path is a symlink; refusing deployment." >&2
    exit 1
fi
install -d -m 700 -- "${backup_dir}"
chmod 700 -- "${backup_dir}"
tar -czf "${backup_file}" -C "${deploy_path}" .
chmod 600 -- "${backup_file}"
tar -tzf "${backup_file}" >/dev/null

# Swap the staged release into place and restore the previous tree if the rename
# or the post-swap file checks fail. Both paths are fixed children of account_home.
mv -- "${deploy_path}" "${previous_path}"
if ! mv -- "${stage_path}" "${deploy_path}"; then
    mv -- "${previous_path}" "${deploy_path}"
    echo "Could not activate the staged release; previous site restored." >&2
    exit 1
fi

if [[ ! -f "${deploy_path}/index.html" \
    || ! -f "${deploy_path}/api/public/index.php" \
    || ! -f "${deploy_path}/api/vendor/autoload.php" ]]; then
    mv -- "${deploy_path}" "${failed_path}"
    if mv -- "${previous_path}" "${deploy_path}"; then
        echo "Post-deploy validation failed; previous site restored. Failed files kept at ${failed_path}." >&2
    else
        echo "Post-deploy validation failed and rollback needs manual recovery from ${backup_file}." >&2
    fi
    exit 1
fi

rm -rf -- "${previous_path}"
echo "Admin frontend and same-origin API deployed to ${deploy_path} (API: /api)."
echo "Private pre-deployment snapshot: ${backup_file}"
