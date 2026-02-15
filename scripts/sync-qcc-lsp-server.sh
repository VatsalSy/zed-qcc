#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEFAULT_SOURCE_REPO="${REPO_ROOT}/../qcc-lsp"
if [[ ! -d "${DEFAULT_SOURCE_REPO}/server/out" ]]; then
  DEFAULT_SOURCE_REPO="/Users/vatsal/1-github/1-LSPs/qcc-lsp"
fi
SOURCE_REPO="${1:-${DEFAULT_SOURCE_REPO}}"
SOURCE_OUT="${SOURCE_REPO}/server/out"
DEST_DIR="${REPO_ROOT}/lsp"

if [[ ! -d "${SOURCE_OUT}" ]]; then
  echo "qcc-lsp server out directory not found: ${SOURCE_OUT}" >&2
  exit 1
fi

mkdir -p "${DEST_DIR}"
find "${DEST_DIR}" -maxdepth 1 -type f -name '*.js' -delete
cp "${SOURCE_OUT}"/*.js "${DEST_DIR}/"

SOURCE_COMMIT="unknown"
if git -C "${SOURCE_REPO}" rev-parse --verify HEAD >/dev/null 2>&1; then
  SOURCE_COMMIT="$(git -C "${SOURCE_REPO}" rev-parse HEAD)"
fi

cat > "${DEST_DIR}/UPSTREAM.txt" <<EOF
source_repo = ${SOURCE_REPO}
source_commit = ${SOURCE_COMMIT}
source_subdir = server/out
sync_script = ${SCRIPT_DIR}/sync-qcc-lsp-server.sh
EOF

echo "Synced qcc-lsp server snapshot to ${DEST_DIR}" >&2
