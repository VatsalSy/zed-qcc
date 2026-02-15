#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEFAULT_SOURCE_REPO="${REPO_ROOT}/../qcc-lsp"
if [[ -d "${DEFAULT_SOURCE_REPO}/server/out" ]]; then
  SOURCE_REPO="${1:-${DEFAULT_SOURCE_REPO}}"
elif [[ $# -ge 1 ]]; then
  SOURCE_REPO="$1"
else
  cat >&2 <<EOF
Error: qcc-lsp source repository not found at default location:
  ${DEFAULT_SOURCE_REPO}

Run this script with a qcc-lsp checkout path containing 'server/out', for example:
  ${0} /path/to/qcc-lsp
EOF
  exit 1
fi
SOURCE_OUT="${SOURCE_REPO}/server/out"
DEST_DIR="${REPO_ROOT}/lsp"

if [[ ! -d "${SOURCE_OUT}" ]]; then
  echo "qcc-lsp server out directory not found: ${SOURCE_OUT}" >&2
  exit 1
fi

mkdir -p "${DEST_DIR}"
find "${DEST_DIR}" -maxdepth 1 -type f -name '*.js' -delete
shopt -s nullglob
js_files=("${SOURCE_OUT}"/*.js)
shopt -u nullglob
if [[ ${#js_files[@]} -eq 0 ]]; then
  echo "No .js files found in ${SOURCE_OUT}" >&2
  exit 1
fi
cp "${js_files[@]}" "${DEST_DIR}/"

SOURCE_COMMIT="unknown"
if git -C "${SOURCE_REPO}" rev-parse --verify HEAD >/dev/null 2>&1; then
  SOURCE_COMMIT="$(git -C "${SOURCE_REPO}" rev-parse HEAD)"
fi

SOURCE_REPO_ID="unknown"
if git -C "${SOURCE_REPO}" config --get remote.origin.url >/dev/null 2>&1; then
  SOURCE_REPO_ID="$(git -C "${SOURCE_REPO}" config --get remote.origin.url)"
elif [[ -n "${SOURCE_REPO}" ]]; then
  SOURCE_REPO_ID="$(basename "${SOURCE_REPO}")"
fi

cat > "${DEST_DIR}/UPSTREAM.txt" <<EOF
source_repo = ${SOURCE_REPO_ID}
source_commit = ${SOURCE_COMMIT}
source_subdir = server/out
sync_script = scripts/sync-qcc-lsp-server.sh
EOF

echo "Synced qcc-lsp server snapshot to ${DEST_DIR}" >&2
