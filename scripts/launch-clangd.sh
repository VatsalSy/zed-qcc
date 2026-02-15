#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXTENSION_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
WORKSPACE_ROOT="${ZED_WORKTREE:-${PWD}}"

# Determine BASILISK_SRC with priority: BASILISK_ROOT/src > BASILISK > default
if [[ -n "${BASILISK_ROOT:-}" ]]; then
  BASILISK_SRC="${BASILISK_ROOT}/src"
elif [[ -n "${BASILISK:-}" ]]; then
  BASILISK_SRC="${BASILISK}"
else
  BASILISK_SRC="${HOME}/basilisk/src"
fi

QCC_PATH="${QCC_PATH:-$(command -v qcc 2>/dev/null || true)}"

mkdir -p "${WORKSPACE_ROOT}/build"
"${EXTENSION_ROOT}/scripts/refresh-compile-commands.sh" "${WORKSPACE_ROOT}" "${BASILISK_SRC}" "${QCC_PATH}"

CLANGD_BIN="${CLANGD_PATH:-$(command -v clangd)}"
if [[ -z "${CLANGD_BIN}" ]]; then
  echo "clangd not found on PATH" >&2
  exit 1
fi

ARGS=(
  "--background-index"
  "--clang-tidy"
  "--header-insertion=never"
  "--compile-commands-dir=${WORKSPACE_ROOT}/build"
)
if [[ -n "${QCC_PATH}" ]]; then
  ARGS+=("--query-driver=${QCC_PATH}")
fi

exec "${CLANGD_BIN}" "${ARGS[@]}" "$@"
