#!/usr/bin/env bash

codex_discover_source_tree_path() {
  local common_dir

  if ! common_dir="$(git -C "${CODEX_WORKTREE_PATH:-$PWD}" rev-parse --git-common-dir 2>/dev/null)"; then
    return 1
  fi

  if [[ "$common_dir" != /* ]]; then
    common_dir="${CODEX_WORKTREE_PATH:-$PWD}/$common_dir"
  fi

  if [[ "$(basename "$common_dir")" = ".git" ]]; then
    dirname "$common_dir"
    return 0
  fi

  return 1
}

codex_environment_init() {
  CODEX_WORKTREE_PATH="${CODEX_WORKTREE_PATH:-$PWD}"
  CODEX_SOURCE_TREE_PATH="${CODEX_SOURCE_TREE_PATH:-${SUPERSET_ROOT_PATH:-}}"

  if [ -z "$CODEX_SOURCE_TREE_PATH" ]; then
    CODEX_SOURCE_TREE_PATH="$(codex_discover_source_tree_path || true)"
  fi

  CODEX_SOURCE_TREE_PATH="${CODEX_SOURCE_TREE_PATH:-$CODEX_WORKTREE_PATH}"
  SUPERSET_ROOT_PATH="${SUPERSET_ROOT_PATH:-$CODEX_SOURCE_TREE_PATH}"
  SUPERSET_WORKSPACE_NAME="${SUPERSET_WORKSPACE_NAME:-${CODEX_WORKSPACE_NAME:-$(basename "$CODEX_WORKTREE_PATH")}}"

  export CODEX_WORKTREE_PATH CODEX_SOURCE_TREE_PATH SUPERSET_ROOT_PATH SUPERSET_WORKSPACE_NAME
  cd "$CODEX_WORKTREE_PATH"
}
