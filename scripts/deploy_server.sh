#!/usr/bin/env bash

set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SOURCE_BRANCH="${SOURCE_BRANCH:-$(git -C "${SERVER_DIR}" branch --show-current)}"
TARGET_BRANCH="${TARGET_BRANCH:-main}"

log() {
  echo "[server-deploy] $1"
}

require_clean_worktree() {
  if [[ -n "$(git -C "${SERVER_DIR}" status --short)" ]]; then
    echo "[server-deploy] ERROR: working tree is not clean."
    echo "[server-deploy] Commit or stash your changes before deploying the server."
    exit 1
  fi
}

main() {
  if ! command -v git >/dev/null 2>&1; then
    echo "[server-deploy] ERROR: git command not found."
    exit 1
  fi

  if ! command -v npm >/dev/null 2>&1; then
    echo "[server-deploy] ERROR: npm command not found."
    exit 1
  fi

  if [[ -z "${SOURCE_BRANCH}" ]]; then
    echo "[server-deploy] ERROR: could not determine current branch."
    exit 1
  fi

  require_clean_worktree

  log "Fetching latest refs from origin..."
  git -C "${SERVER_DIR}" fetch origin

  local backup_branch=""
  if git -C "${SERVER_DIR}" show-ref --verify --quiet "refs/remotes/origin/${TARGET_BRANCH}"; then
    backup_branch="backup/${TARGET_BRANCH}-before-production-deploy-$(date +%F-%H%M%S)"
    log "Creating backup branch '${backup_branch}' from origin/${TARGET_BRANCH}..."
    git -C "${SERVER_DIR}" branch -f "${backup_branch}" "origin/${TARGET_BRANCH}"
    git -C "${SERVER_DIR}" push origin "${backup_branch}"
  fi

  log "Building server before push..."
  (
    cd "${SERVER_DIR}"
    npm run build
  )

  if [[ "${SOURCE_BRANCH}" != "${TARGET_BRANCH}" ]]; then
    log "Updating local '${TARGET_BRANCH}' to match '${SOURCE_BRANCH}'..."
    git -C "${SERVER_DIR}" branch -f "${TARGET_BRANCH}" HEAD
  fi

  log "Pushing current HEAD to origin/${TARGET_BRANCH}..."
  git -C "${SERVER_DIR}" push --force-with-lease origin HEAD:"${TARGET_BRANCH}"

  log "Push complete."
  log "Current branch '${SOURCE_BRANCH}' is now the content of '${TARGET_BRANCH}'."
  log "Production DB selection is controlled by the hosted server environment variables, not by local .env.devdb/.env.proddb."
}

main "$@"
