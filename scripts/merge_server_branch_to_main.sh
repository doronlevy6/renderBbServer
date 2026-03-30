#!/usr/bin/env bash

set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SOURCE_BRANCH="${SOURCE_BRANCH:-$(git -C "${SERVER_DIR}" branch --show-current)}"
TARGET_BRANCH="${TARGET_BRANCH:-main}"
NEXT_BRANCH_NAME="${NEXT_BRANCH_NAME:-work/$(date +%F-%H%M%S)}"
PROD_ENV_FILE="${PROD_ENV_FILE:-${SERVER_DIR}/.env.proddb}"
REQUIRE_NEON_HOST="${REQUIRE_NEON_HOST:-1}"

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

read_env_value() {
  local file="$1"
  local key="$2"
  awk -F'=' -v k="${key}" '
    $0 ~ /^[[:space:]]*#/ {next}
    $1 == k {
      val = substr($0, index($0, "=") + 1)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", val)
      gsub(/^'\''|'\''$/, "", val)
      gsub(/^"|"$/, "", val)
      print val
      exit
    }
  ' "${file}"
}

ensure_prod_db_target_is_neon() {
  if [[ "${REQUIRE_NEON_HOST}" != "1" ]]; then
    log "Neon guard skipped (REQUIRE_NEON_HOST=${REQUIRE_NEON_HOST})."
    return
  fi

  if [[ ! -f "${PROD_ENV_FILE}" ]]; then
    echo "[server-merge] ERROR: missing ${PROD_ENV_FILE}."
    echo "[server-merge] Create it before deploy so we can verify production DB target."
    exit 1
  fi

  local db_url pg_host target
  db_url="$(read_env_value "${PROD_ENV_FILE}" "DATABASE_URL")"
  pg_host="$(read_env_value "${PROD_ENV_FILE}" "PGHOST")"
  target="${db_url:-${pg_host}}"

  if [[ -z "${target}" ]]; then
    echo "[server-merge] ERROR: ${PROD_ENV_FILE} must include DATABASE_URL or PGHOST."
    exit 1
  fi

  if [[ "${target}" != *"neon.tech"* ]]; then
    echo "[server-merge] ERROR: production DB target is not Neon: ${target}"
    echo "[server-merge] Refusing deploy to origin/${TARGET_BRANCH}."
    exit 1
  fi

  log "Production DB guard passed (Neon target: ${target})."
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
  ensure_prod_db_target_is_neon

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
  log "Production deploy guard enforced Neon DB target from ${PROD_ENV_FILE} before push."
}

main "$@"
