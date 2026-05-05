#!/usr/bin/env bash
set -uo pipefail

GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

declare -a COPIED_FILES=()

success() { echo -e "${GREEN}OK${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
info() { echo -e "${BLUE}>${NC} $1"; }

discover_root_path() {
  local worktree_path="$1"
  local common_dir

  if ! common_dir="$(git -C "$worktree_path" rev-parse --git-common-dir 2>/dev/null)"; then
    return 1
  fi

  if [[ "$common_dir" != /* ]]; then
    common_dir="$worktree_path/$common_dir"
  fi

  if [[ "$(basename "$common_dir")" = ".git" ]]; then
    dirname "$common_dir"
    return 0
  fi

  return 1
}

step_validate_paths() {
  WORKTREE_PATH="${CODEX_WORKTREE_PATH:-$(pwd)}"
  SUPERSET_ROOT_PATH="${SUPERSET_ROOT_PATH:-${CODEX_SOURCE_TREE_PATH:-}}"

  if [ -z "$SUPERSET_ROOT_PATH" ]; then
    SUPERSET_ROOT_PATH="$(discover_root_path "$WORKTREE_PATH" || true)"
  fi

  SUPERSET_WORKSPACE_NAME="${SUPERSET_WORKSPACE_NAME:-${CODEX_WORKSPACE_NAME:-$(basename "$WORKTREE_PATH")}}"
  export SUPERSET_ROOT_PATH SUPERSET_WORKSPACE_NAME

  if [ -z "$SUPERSET_ROOT_PATH" ] || [ ! -d "$SUPERSET_ROOT_PATH" ]; then
    warn "Root path unavailable; skipping env copy"
    return 2
  fi

  if [ "$SUPERSET_ROOT_PATH" = "$WORKTREE_PATH" ]; then
    warn "Running in root repo (not a worktree) - skipping env copy"
    return 2
  fi

  success "Root: $SUPERSET_ROOT_PATH"
  success "Worktree: $WORKTREE_PATH"
  return 0
}

step_copy_env_files() {
  info "Copying environment files..."

  local root_path="$SUPERSET_ROOT_PATH"
  local worktree_path="${CODEX_WORKTREE_PATH:-$(pwd)}"
  local copied_files=0

  while IFS= read -r -d '' file; do
    local rel_path="${file#$root_path/}"
    local target_path="$worktree_path/$rel_path"
    local target_dir
    target_dir="$(dirname "$target_path")"

    mkdir -p "$target_dir"

    if cp "$file" "$target_path" 2>/dev/null; then
      COPIED_FILES+=("$rel_path")
      copied_files=$((copied_files + 1))
    fi
  done < <(find "$root_path" \
    -type f \
    \( \
      -path "$root_path/.env" \
      -o -path "$root_path/.env.local" \
      -o -path "$root_path/.env.development.local" \
      -o -path "$root_path/.env.staging.local" \
    \) \
    -not -path "*/node_modules/*" \
    -not -path "*/.git/*" \
    -not -path "*/.superset/*" \
    -print0 2>/dev/null)

  if [ $copied_files -eq 0 ]; then
    info "No environment files found to copy"
  else
    success "Copied $copied_files environment file(s)"
  fi
}

step_copy_ralph_yml() {
  local source_file="$SUPERSET_ROOT_PATH/ralph.yml"
  local target_file="${CODEX_WORKTREE_PATH:-$(pwd)}/ralph.yml"

  if [ -f "$source_file" ] && cp "$source_file" "$target_file" 2>/dev/null; then
    COPIED_FILES+=("ralph.yml")
    success "Copied ralph.yml"
  fi
}

print_summary() {
  echo ""
  if [ ${#COPIED_FILES[@]} -eq 0 ]; then
    echo "No files needed copying"
    return
  fi

  echo "Copied ${#COPIED_FILES[@]} file(s):"
  for file in "${COPIED_FILES[@]}"; do
    echo "  - $file"
  done
}

main() {
  echo "Setting up outlit-sdk workspace..."
  step_validate_paths
  local validate_result=$?

  if [ $validate_result -eq 0 ]; then
    step_copy_env_files
    step_copy_ralph_yml
  fi

  print_summary
  echo ""
  echo -e "${GREEN}Ready.${NC} Run 'bun install' if needed."
}

main "$@"
