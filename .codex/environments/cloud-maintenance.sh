#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$script_dir/lib/codex-env.sh"
codex_environment_init

if ! command -v bun >/dev/null 2>&1; then
  echo "bun is required for this repository" >&2
  exit 1
fi

echo "Using bun $(bun --version)"
bun install
