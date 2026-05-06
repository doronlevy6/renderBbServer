#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PROJECTS_DIR="$(cd "${SERVER_DIR}/.." && pwd)"
FLUTTER_DIR="${FLUTTER_DIR:-${PROJECTS_DIR}/BB_flutter}"

FRONTEND_PORT="${FRONTEND_PORT:-7357}"
BACKEND_DB_MODE_DEFAULT="${BACKEND_DB_MODE_DEFAULT:-dev}"
FRONTEND_API_MODE_DEFAULT="${FRONTEND_API_MODE_DEFAULT:-local}"

LOG_DIR_SERVER="${SERVER_DIR}/.logs"
LOG_DIR_FLUTTER="${FLUTTER_DIR}/.logs"
FRONTEND_META_FILE="${LOG_DIR_FLUTTER}/frontend.meta"
BACKEND_META_FILE="${LOG_DIR_SERVER}/backend.meta"

log() {
  echo "[frontend-restart] $1"
}

read_meta_value() {
  local file="$1"
  local key="$2"
  if [[ ! -f "${file}" ]]; then
    return 0
  fi
  awk -F'=' -v k="${key}" '$1 == k {print substr($0, index($0, "=") + 1)}' "${file}" | tail -n 1
}

kill_pid_if_alive() {
  local pid="$1"
  local label="$2"
  if [[ -z "${pid}" ]]; then
    return 0
  fi
  if kill -0 "${pid}" >/dev/null 2>&1; then
    log "Stopping ${label} (pid=${pid})..."
    kill "${pid}" >/dev/null 2>&1 || true
    sleep 1
    if kill -0 "${pid}" >/dev/null 2>&1; then
      kill -9 "${pid}" >/dev/null 2>&1 || true
    fi
  fi
}

stop_pid_file_if_exists() {
  local pid_file="$1"
  local label="$2"
  if [[ -f "${pid_file}" ]]; then
    local pid
    pid="$(cat "${pid_file}" 2>/dev/null || true)"
    kill_pid_if_alive "${pid}" "${label}"
    rm -f "${pid_file}"
  fi
}

kill_frontend_listener_if_flutter() {
  local pid
  pid="$(lsof -nP -tiTCP:"${FRONTEND_PORT}" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
  if [[ -z "${pid}" ]]; then
    return 0
  fi
  local cmd
  cmd="$(ps -p "${pid}" -o command= 2>/dev/null || true)"
  if [[ "${cmd}" =~ (flutter|dart) ]]; then
    kill_pid_if_alive "${pid}" "frontend-port-${FRONTEND_PORT}"
  else
    log "Port ${FRONTEND_PORT} is used by another process. Skipping kill: ${cmd}"
  fi
}

read_frontend_mode() {
  local mode
  mode="$(read_meta_value "${FRONTEND_META_FILE}" "API_MODE")"
  if [[ -z "${mode}" ]]; then
    mode="${FRONTEND_API_MODE_DEFAULT}"
  fi
  case "${mode}" in
    local|prod) echo "${mode}" ;;
    *) echo "${FRONTEND_API_MODE_DEFAULT}" ;;
  esac
}

read_backend_mode() {
  local mode
  mode="$(read_meta_value "${BACKEND_META_FILE}" "MODE")"
  if [[ -z "${mode}" ]]; then
    mode="${BACKEND_DB_MODE_DEFAULT}"
  fi
  case "${mode}" in
    dev|prod) echo "${mode}" ;;
    *) echo "${BACKEND_DB_MODE_DEFAULT}" ;;
  esac
}

main() {
  mkdir -p "${LOG_DIR_SERVER}" "${LOG_DIR_FLUTTER}"

  local frontend_mode backend_mode
  frontend_mode="$(read_frontend_mode)"
  backend_mode="$(read_backend_mode)"

  log "Restarting frontend only (frontend-api=${frontend_mode}, backend-db=${backend_mode})."

  kill_pid_if_alive "$(read_meta_value "${FRONTEND_META_FILE}" "PID")" "frontend-meta"
  stop_pid_file_if_exists "${LOG_DIR_FLUTTER}/flutter-web-local.pid" "frontend-local"
  stop_pid_file_if_exists "${LOG_DIR_FLUTTER}/flutter-web-prod.pid" "frontend-prod"
  kill_frontend_listener_if_flutter
  rm -f "${FRONTEND_META_FILE}"

  OPEN_PGADMIN_UI=0 \
  START_PGADMIN_CONTAINER=0 \
  FRONTEND_API_MODE="${frontend_mode}" \
  BACKEND_DB_MODE="${backend_mode}" \
  START_APP_PROCESSES=1 \
  ./scripts/start_full_dev_environment.sh

  log "Done."
}

main "$@"
