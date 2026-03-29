#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PROJECTS_DIR="$(cd "${SERVER_DIR}/.." && pwd)"
FLUTTER_DIR="${FLUTTER_DIR:-${PROJECTS_DIR}/BB_flutter}"

DB_CONTAINER="${DB_CONTAINER:-bb-db}"
PGADMIN_CONTAINER="${PGADMIN_CONTAINER:-pgadmin}"
PGADMIN_URL="${PGADMIN_URL:-http://localhost:8080/browser/}"
BACKEND_PORT="${BACKEND_PORT:-9090}"
FRONTEND_PORT="${FRONTEND_PORT:-7357}"

LOG_DIR_SERVER="${SERVER_DIR}/.logs"
LOG_DIR_FLUTTER="${FLUTTER_DIR}/.logs"
BACKEND_META_FILE="${LOG_DIR_SERVER}/backend.meta"
FRONTEND_META_FILE="${LOG_DIR_FLUTTER}/frontend.meta"

FRONTEND_API_MODE="${FRONTEND_API_MODE:-local}" # local | prod
BACKEND_DB_MODE="${BACKEND_DB_MODE:-dev}" # dev | prod

log() {
  echo "[dev-start] $1"
}

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

is_port_listening() {
  local port="$1"
  lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
}

pid_is_alive() {
  local pid_file="$1"
  if [[ -f "${pid_file}" ]]; then
    local pid
    pid="$(cat "${pid_file}" 2>/dev/null || true)"
    if [[ -n "${pid}" ]] && kill -0 "${pid}" >/dev/null 2>&1; then
      return 0
    fi
  fi
  return 1
}

read_meta_value() {
  local file="$1"
  local key="$2"
  if [[ ! -f "${file}" ]]; then
    return 0
  fi
  awk -F'=' -v k="${key}" '$1 == k {print substr($0, index($0, "=") + 1)}' "${file}" | tail -n 1
}

ensure_valid_modes() {
  case "${FRONTEND_API_MODE}" in
    local | prod) ;;
    *)
      echo "[dev-start] ERROR: FRONTEND_API_MODE must be 'local' or 'prod' (got: ${FRONTEND_API_MODE})"
      exit 1
      ;;
  esac

  case "${BACKEND_DB_MODE}" in
    dev | prod) ;;
    *)
      echo "[dev-start] ERROR: BACKEND_DB_MODE must be 'dev' or 'prod' (got: ${BACKEND_DB_MODE})"
      exit 1
      ;;
  esac
}

ensure_backend_env_file() {
  local mode="$1"
  local file
  if [[ "${mode}" == "dev" ]]; then
    file="${SERVER_DIR}/.env.devdb"
  else
    file="${SERVER_DIR}/.env.proddb"
  fi

  if [[ ! -f "${file}" ]]; then
    echo "[dev-start] ERROR: Missing backend env file: ${file}"
    if [[ "${mode}" == "prod" ]]; then
      echo "[dev-start] Create it from ${SERVER_DIR}/.env.proddb.example before using prod DB mode."
    fi
    exit 1
  fi
  echo "${file}"
}

ensure_docker_running() {
  if docker info >/dev/null 2>&1; then
    log "Docker is already running."
    return
  fi

  log "Docker is not running. Opening Docker Desktop..."
  open -a Docker

  local max_wait=180
  local waited=0
  while ! docker info >/dev/null 2>&1; do
    sleep 2
    waited=$((waited + 2))
    if (( waited >= max_wait )); then
      echo "[dev-start] ERROR: Docker did not become ready within ${max_wait} seconds."
      exit 1
    fi
  done

  log "Docker is ready."
}

ensure_container_running() {
  local name="$1"

  if ! docker container inspect "${name}" >/dev/null 2>&1; then
    echo "[dev-start] ERROR: Container '${name}' does not exist."
    echo "[dev-start] This script will not create containers automatically."
    exit 1
  fi

  local running
  running="$(docker inspect -f '{{.State.Running}}' "${name}")"
  if [[ "${running}" == "true" ]]; then
    log "Container '${name}' is already running."
  else
    log "Starting container '${name}'..."
    docker start "${name}" >/dev/null
    log "Container '${name}' started."
  fi
}

restart_existing_backend_if_mode_changed() {
  local requested_mode="$1"
  local existing_pid
  local existing_mode
  existing_pid="$(read_meta_value "${BACKEND_META_FILE}" "PID")"
  existing_mode="$(read_meta_value "${BACKEND_META_FILE}" "MODE")"

  if [[ -n "${existing_pid}" ]] && kill -0 "${existing_pid}" >/dev/null 2>&1; then
    if [[ "${existing_mode}" != "${requested_mode}" ]]; then
      log "Backend is running in mode '${existing_mode}', restarting to '${requested_mode}'."
      kill "${existing_pid}" >/dev/null 2>&1 || true
      sleep 1
    fi
  fi
}

start_backend_if_needed() {
  local mode="$1"
  local env_file="$2"
  local pid_file="${LOG_DIR_SERVER}/backend-${mode}.pid"
  mkdir -p "${LOG_DIR_SERVER}"

  restart_existing_backend_if_mode_changed "${mode}"

  if is_port_listening "${BACKEND_PORT}"; then
    local existing_mode
    existing_mode="$(read_meta_value "${BACKEND_META_FILE}" "MODE")"
    if [[ -n "${existing_mode}" ]]; then
      log "Backend already listening on ${BACKEND_PORT} (mode=${existing_mode})."
    else
      log "Backend already listening on ${BACKEND_PORT} (unknown mode)."
    fi
    return
  fi

  if pid_is_alive "${pid_file}"; then
    log "Backend process already running (pid from ${pid_file})."
    return
  fi

  log "Starting backend (npm run dev, db-mode=${mode}, ENV_FILE=$(basename "${env_file}"))..."
  (
    cd "${SERVER_DIR}"
    ENV_FILE="${env_file}" nohup npm run dev > "${LOG_DIR_SERVER}/backend-${mode}.log" 2>&1 &
    local pid=$!
    echo "${pid}" > "${pid_file}"
    {
      echo "PID=${pid}"
      echo "MODE=${mode}"
      echo "ENV_FILE=${env_file}"
    } > "${BACKEND_META_FILE}"
  )
  log "Backend start command sent."
}

restart_existing_frontend_if_mode_changed() {
  local requested_mode="$1"
  local existing_pid
  local existing_mode
  existing_pid="$(read_meta_value "${FRONTEND_META_FILE}" "PID")"
  existing_mode="$(read_meta_value "${FRONTEND_META_FILE}" "API_MODE")"

  if [[ -n "${existing_pid}" ]] && kill -0 "${existing_pid}" >/dev/null 2>&1; then
    if [[ "${existing_mode}" != "${requested_mode}" ]]; then
      log "Frontend is running with api-mode '${existing_mode}', restarting to '${requested_mode}'."
      kill "${existing_pid}" >/dev/null 2>&1 || true
      sleep 1
    fi
  fi
}

start_frontend_if_needed() {
  local api_mode="$1"
  local pid_file="${LOG_DIR_FLUTTER}/flutter-web-${api_mode}.pid"
  local app_env
  if [[ "${api_mode}" == "local" ]]; then
    app_env="LOCAL"
  else
    app_env="PROD"
  fi

  mkdir -p "${LOG_DIR_FLUTTER}"

  restart_existing_frontend_if_mode_changed "${api_mode}"

  if is_port_listening "${FRONTEND_PORT}"; then
    local existing_mode
    existing_mode="$(read_meta_value "${FRONTEND_META_FILE}" "API_MODE")"
    if [[ -n "${existing_mode}" ]]; then
      log "Frontend already listening on ${FRONTEND_PORT} (api-mode=${existing_mode})."
    else
      log "Frontend already listening on ${FRONTEND_PORT} (unknown mode)."
    fi
    return
  fi

  if pid_is_alive "${pid_file}"; then
    log "Frontend process already running (pid from ${pid_file})."
    return
  fi

  if pgrep -f "flutter run -d chrome" >/dev/null 2>&1; then
    log "Detected existing 'flutter run -d chrome' process. Skipping duplicate start."
    return
  fi

  log "Starting frontend (api-mode=${api_mode}, APP_ENV=${app_env})..."
  (
    cd "${FLUTTER_DIR}"
    nohup flutter run -d chrome --web-port "${FRONTEND_PORT}" --dart-define="APP_ENV=${app_env}" > "${LOG_DIR_FLUTTER}/flutter-web-${api_mode}.log" 2>&1 &
    local pid=$!
    echo "${pid}" > "${pid_file}"
    {
      echo "PID=${pid}"
      echo "API_MODE=${api_mode}"
      echo "APP_ENV=${app_env}"
    } > "${FRONTEND_META_FILE}"
  )
  log "Frontend start command sent."
}

open_pgadmin_ui() {
  log "Opening pgAdmin UI: ${PGADMIN_URL}"
  open "${PGADMIN_URL}" >/dev/null 2>&1 || true
}

main() {
  if ! has_cmd docker; then
    echo "[dev-start] ERROR: docker command not found."
    exit 1
  fi
  if ! has_cmd npm; then
    echo "[dev-start] ERROR: npm command not found."
    exit 1
  fi
  if ! has_cmd flutter; then
    echo "[dev-start] ERROR: flutter command not found."
    exit 1
  fi
  if ! has_cmd lsof; then
    echo "[dev-start] ERROR: lsof command not found."
    exit 1
  fi

  ensure_valid_modes

  ensure_docker_running
  if [[ "${BACKEND_DB_MODE}" == "dev" ]]; then
    ensure_container_running "${DB_CONTAINER}"
  else
    log "Skipping local DB container start (backend db-mode=prod)."
  fi
  ensure_container_running "${PGADMIN_CONTAINER}"
  open_pgadmin_ui
  local backend_env_file
  backend_env_file="$(ensure_backend_env_file "${BACKEND_DB_MODE}")"
  start_backend_if_needed "${BACKEND_DB_MODE}" "${backend_env_file}"
  start_frontend_if_needed "${FRONTEND_API_MODE}"

  log "Done. Safe to run this script again (idempotent)."
  log "Active combination: frontend-api=${FRONTEND_API_MODE}, backend-db=${BACKEND_DB_MODE}"
}

main "$@"
