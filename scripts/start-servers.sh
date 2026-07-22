#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required to start the MedShift development servers." >&2
  exit 1
fi

pids=()

cleanup() {
  local status=$?

  if ((${#pids[@]} > 0)); then
    echo
    echo "Stopping MedShift development servers..."

    for pid in "${pids[@]}"; do
      if kill -0 "$pid" >/dev/null 2>&1; then
        kill "$pid" >/dev/null 2>&1 || true
      fi
    done

    wait >/dev/null 2>&1 || true
  fi

  exit "$status"
}

trap cleanup INT TERM EXIT

echo "Starting MedShift API server at http://localhost:4000"
pnpm api:dev &
pids+=("$!")

echo "Starting MedShift web server at http://localhost:3000"
pnpm web:dev &
pids+=("$!")

echo
echo "Both development servers are starting. Press Ctrl+C to stop them."

wait "${pids[@]}"
