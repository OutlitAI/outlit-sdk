#!/usr/bin/env bash
set -euo pipefail

root_path="${1:-${CODEX_SOURCE_TREE_PATH:-${SUPERSET_ROOT_PATH:-}}}"

if [ -z "$root_path" ]; then
  common_dir="$(git rev-parse --git-common-dir)"

  if [[ "$common_dir" != /* ]]; then
    common_dir="$(pwd)/$common_dir"
  fi

  root_path="$(dirname "$common_dir")"
fi

if [ ! -d "$root_path" ]; then
  echo "Root path does not exist: $root_path" >&2
  exit 1
fi

manifest="$(mktemp)"
archive="$(mktemp)"

cleanup() {
  rm -f "$manifest" "$archive"
}
trap cleanup EXIT

find "$root_path" \
  -type f \
  \( \
    -path "$root_path/.env" \
    -o -path "$root_path/.env.local" \
    -o -path "$root_path/.env.development.local" \
    -o -path "$root_path/.env.staging.local" \
  \) \
  ! -path "*/node_modules/*" \
  ! -path "*/.git/*" \
  -print | while IFS= read -r file; do
    printf '%s\n' "${file#$root_path/}"
  done >"$manifest"

if [ -f "$root_path/ralph.yml" ]; then
  printf '%s\n' "ralph.yml" >>"$manifest"
fi

if [ ! -s "$manifest" ]; then
  echo "No cloud env files found under $root_path" >&2
  exit 0
fi

tar -czf "$archive" -C "$root_path" -T "$manifest"
base64 <"$archive" | tr -d '\n'
printf '\n'
