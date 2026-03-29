#!/usr/bin/env bash

set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-$(git -C "${SERVER_DIR}" branch --show-current)}"

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

  if [[ -z "${DEPLOY_BRANCH}" ]]; then
    echo "[server-deploy] ERROR: could not determine current branch."
    exit 1
  fi

  require_clean_worktree

  log "Building server before push..."
  (
    cd "${SERVER_DIR}"
    npm run build
  )

  log "Pushing branch '${DEPLOY_BRANCH}' to origin..."
  git -C "${SERVER_DIR}" push origin "${DEPLOY_BRANCH}"

  log "Push complete."
  log "Production DB selection is controlled by the hosted server environment variables, not by local .env.devdb/.env.proddb."
}

main "$@"
