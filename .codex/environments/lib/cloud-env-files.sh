#!/usr/bin/env bash

cloud_decode_base64() {
  if base64 --decode >/dev/null 2>&1 <<<""; then
    base64 --decode
    return
  fi

  base64 -D
}

cloud_materialize_env_files() {
  local bundle="${OUTLIT_ENV_FILES_TGZ_BASE64:-${CODEX_ENV_FILES_TGZ_BASE64:-}}"

  if [ -z "$bundle" ]; then
    echo "No env file bundle configured; skipping env file materialization"
    return 0
  fi

  local archive
  archive="$(mktemp)"

  printf '%s' "$bundle" | cloud_decode_base64 >"$archive"

  local entry
  while IFS= read -r entry; do
    case "$entry" in
      /* | ../* | */../* | *"/.." | "..")
        echo "Unsafe path in env bundle: $entry" >&2
        rm -f "$archive"
        return 1
        ;;
    esac
  done < <(tar -tzf "$archive")

  tar -xzf "$archive" -C "$CODEX_WORKTREE_PATH"
  rm -f "$archive"
  printf '%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >"$CODEX_WORKTREE_PATH/.codex/environments/.cloud-env-bundle-materialized"

  echo "Materialized env files from OUTLIT_ENV_FILES_TGZ_BASE64"
}
