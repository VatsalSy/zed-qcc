#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 3 ]; then
  echo "Usage: $0 WORKSPACE_ROOT BASILISK_SRC QCC_BIN" >&2
  exit 2
fi

WORKSPACE_ROOT="$1"
BASILISK_SRC="$2"
QCC_BIN="$3"

if [[ -z "${QCC_BIN}" ]]; then
  QCC_BIN="qcc"
fi

BUILD_DIR="${WORKSPACE_ROOT}/build"
COMPILE_DB="${BUILD_DIR}/compile_commands.json"
mkdir -p "${BUILD_DIR}"

mapfile -t C_FILES < <(find "${WORKSPACE_ROOT}" -maxdepth 2 -name '*.c' -not -path '*/target/*' -not -path '*/build/*' -print 2>/dev/null)

{
  echo "["
  first=1
  for file_path in "${C_FILES[@]}"; do
    [[ -f "${file_path}" ]] || continue
    dir_path="$(dirname "${file_path}")"
    file_name="$(basename "${file_path}")"
    output_name="${file_name%.c}"
    command="${QCC_BIN} -Wall -O2 -disable-dimensions \"${file_path}\" -o \"${dir_path}/${output_name}\" -lm"
    if [[ -n "${BASILISK_SRC}" ]]; then
      command+=" -I\"${BASILISK_SRC}\""
    fi
    if [[ -n "${QCC_OPENMP_FLAG:-}" ]]; then
      command+=" ${QCC_OPENMP_FLAG}"
    fi
    if [[ -n "${QCC_MPI_DEFINE:-}" ]]; then
      command+=" ${QCC_MPI_DEFINE}"
    fi
    if [[ ${first} -eq 0 ]]; then
      echo ","
    fi
    printf '  {"directory": "%s", "file": "%s", "command": "%s"}' "${dir_path}" "${file_path}" "${command}"
    first=0
  done
  echo
  echo "]"
} > "${COMPILE_DB}.tmp"

mv "${COMPILE_DB}.tmp" "${COMPILE_DB}"
