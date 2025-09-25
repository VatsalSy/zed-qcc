#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: qcc-build.sh <source.c> <output>" >&2
  exit 1
fi

SOURCE="$1"
OUTPUT="$2"
BASILISK_SRC="${BASILISK:-${HOME}/basilisk/src}"
QCC_BIN="${QCC_PATH:-$(command -v qcc)}"

if [[ -z "${QCC_BIN}" ]]; then
  echo "qcc compiler not found" >&2
  exit 1
fi

CMD=("${QCC_BIN}" -Wall -O2 -disable-dimensions "${SOURCE}" -o "${OUTPUT}" -lm)
if [[ -n "${QCC_OPENMP_FLAG:-}" ]]; then
  CMD+=(${QCC_OPENMP_FLAG})
fi
if [[ -n "${QCC_MPI_DEFINE:-}" ]]; then
  CMD+=(${QCC_MPI_DEFINE})
fi
if [[ -n "${BASILISK_SRC}" ]]; then
  CMD+=(-I"${BASILISK_SRC}")
fi

exec "${CMD[@]}"
