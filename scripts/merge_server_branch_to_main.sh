#!/usr/bin/env bash

set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SOURCE_BRANCH="${SOURCE_BRANCH:-$(git -C "${SERVER_DIR}" branch --show-current)}"
TARGET_BRANCH="${TARGET_BRANCH:-main}"
NEXT_BRANCH_NAME="${NEXT_BRANCH_NAME:-work/$(date +%F-%H%M%S)}"
PROD_LOCK_REL="${PROD_LOCK_REL:-.env.production.lock}"
PROD_LOCK_FILE="${PROD_LOCK_FILE:-${SERVER_DIR}/${PROD_LOCK_REL}}"
REQUIRE_NEON_HOST="${REQUIRE_NEON_HOST:-1}"
ALLOW_PROD_LOCK_UPDATE="${ALLOW_PROD_LOCK_UPDATE:-0}"
AUTO_COMMIT_DIRTY="${AUTO_COMMIT_DIRTY:-1}"
AUTO_COMMIT_MESSAGE_PREFIX="${AUTO_COMMIT_MESSAGE_PREFIX:-chore: auto-commit before server deploy}"

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

auto_commit_if_dirty() {
  if [[ -z "$(git -C "${SERVER_DIR}" status --short)" ]]; then
    return
  fi

  if [[ "${AUTO_COMMIT_DIRTY}" != "1" ]]; then
    require_clean_worktree
    return
  fi

  local ts msg
  ts="$(date +"%Y-%m-%d %H:%M:%S %Z")"
  msg="${AUTO_COMMIT_MESSAGE_PREFIX} (${ts})"

  log "Dirty worktree detected. Creating auto-commit before deploy merge..."
  git -C "${SERVER_DIR}" add -A
  if ! git -C "${SERVER_DIR}" diff --cached --quiet; then
    git -C "${SERVER_DIR}" commit -m "${msg}"
    log "Auto-commit created."
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

  if [[ ! -f "${PROD_LOCK_FILE}" ]]; then
    echo "[server-merge] ERROR: missing ${PROD_LOCK_FILE}."
    echo "[server-merge] Create it before deploy so we can verify production DB target."
    exit 1
  fi

  local db_url pg_host target
  db_url="$(read_env_value "${PROD_LOCK_FILE}" "DATABASE_URL")"
  pg_host="$(read_env_value "${PROD_LOCK_FILE}" "PGHOST")"
  target="${db_url:-${pg_host}}"

  if [[ -z "${target}" ]]; then
    echo "[server-merge] ERROR: ${PROD_LOCK_FILE} must include DATABASE_URL or PGHOST."
    exit 1
  fi

  if [[ "${target}" != *"neon.tech"* ]]; then
    echo "[server-merge] ERROR: production DB target is not Neon: ${target}"
    echo "[server-merge] Refusing deploy to origin/${TARGET_BRANCH}."
    exit 1
  fi

  log "Production DB guard passed (Neon target: ${target})."
}

ensure_prod_lock_is_not_changed() {
  if [[ "${ALLOW_PROD_LOCK_UPDATE}" == "1" ]]; then
    log "Prod lock-change guard skipped (ALLOW_PROD_LOCK_UPDATE=1)."
    return
  fi

  if ! git -C "${SERVER_DIR}" show-ref --verify --quiet "refs/remotes/origin/${TARGET_BRANCH}"; then
    return
  fi

  if ! git -C "${SERVER_DIR}" diff --quiet "origin/${TARGET_BRANCH}" "${SOURCE_BRANCH}" -- "${PROD_LOCK_REL}"; then
    echo "[server-merge] ERROR: ${PROD_LOCK_REL} differs from origin/${TARGET_BRANCH}."
    echo "[server-merge] Refusing deploy so production DB routing remains stable."
    echo "[server-merge] If this is intentional, rerun with ALLOW_PROD_LOCK_UPDATE=1."
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

  auto_commit_if_dirty
  ensure_prod_db_target_is_neon

  log "Fetching latest refs from origin..."
  git -C "${SERVER_DIR}" fetch origin
  ensure_prod_lock_is_not_changed

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
  log "Production deploy guards enforced Neon target from ${PROD_LOCK_FILE}."
}

main "$@"
