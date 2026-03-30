#!/usr/bin/env bash

set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SOURCE_BRANCH="${SOURCE_BRANCH:-$(git -C "${SERVER_DIR}" branch --show-current)}"
TARGET_BRANCH="${TARGET_BRANCH:-main}"
NEXT_BRANCH_NAME="${NEXT_BRANCH_NAME:-work/$(date +%F-%H%M%S)}"

log() {
  echo "[server-merge] $1"
}

require_clean_worktree() {
  if [[ -n "$(git -C "${SERVER_DIR}" status --short)" ]]; then
    echo "[server-merge] ERROR: working tree is not clean."
    echo "[server-merge] Commit or stash your changes before merging to main."
    exit 1
  fi
}

main() {
  if ! command -v git >/dev/null 2>&1; then
    echo "[server-merge] ERROR: git command not found."
    exit 1
  fi

  if ! command -v npm >/dev/null 2>&1; then
    echo "[server-merge] ERROR: npm command not found."
    exit 1
  fi

  if [[ -z "${SOURCE_BRANCH}" ]]; then
    echo "[server-merge] ERROR: could not determine current branch."
    exit 1
  fi

  if [[ "${SOURCE_BRANCH}" == "${TARGET_BRANCH}" ]]; then
    echo "[server-merge] ERROR: current branch is already '${TARGET_BRANCH}'."
    echo "[server-merge] Switch to a feature branch before using the merge workflow."
    exit 1
  fi

  require_clean_worktree

  log "Fetching latest refs from origin..."
  git -C "${SERVER_DIR}" fetch origin

  local backup_branch=""
  if git -C "${SERVER_DIR}" show-ref --verify --quiet "refs/remotes/origin/${TARGET_BRANCH}"; then
    backup_branch="backup/${TARGET_BRANCH}-before-merge-deploy-$(date +%F-%H%M%S)"
    log "Creating backup branch '${backup_branch}' from origin/${TARGET_BRANCH}..."
    git -C "${SERVER_DIR}" branch -f "${backup_branch}" "origin/${TARGET_BRANCH}"
    git -C "${SERVER_DIR}" push origin "${backup_branch}"
  fi

  log "Building server before merge..."
  (
    cd "${SERVER_DIR}"
    npm run build
  )

  log "Resetting local '${TARGET_BRANCH}' to origin/${TARGET_BRANCH}..."
  git -C "${SERVER_DIR}" branch -f "${TARGET_BRANCH}" "origin/${TARGET_BRANCH}"

  log "Switching to '${TARGET_BRANCH}'..."
  git -C "${SERVER_DIR}" switch "${TARGET_BRANCH}"

  log "Merging '${SOURCE_BRANCH}' into '${TARGET_BRANCH}'..."
  git -C "${SERVER_DIR}" merge --no-ff --no-edit "${SOURCE_BRANCH}"

  log "Pushing '${TARGET_BRANCH}' to origin..."
  git -C "${SERVER_DIR}" push origin "${TARGET_BRANCH}"

  log "Creating next work branch '${NEXT_BRANCH_NAME}' from '${TARGET_BRANCH}'..."
  git -C "${SERVER_DIR}" switch -c "${NEXT_BRANCH_NAME}"
  git -C "${SERVER_DIR}" push -u origin "${NEXT_BRANCH_NAME}"

  log "Merge workflow complete."
  log "Current branch is now '${NEXT_BRANCH_NAME}'."
  log "Production DB selection is controlled by hosted environment variables, not by local .env files."
}

main "$@"
