#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PROJECTS_DIR="$(cd "${SERVER_DIR}/.." && pwd)"
FLUTTER_DIR="${FLUTTER_DIR:-${PROJECTS_DIR}/BB_flutter}"

DB_CONTAINER="${DB_CONTAINER:-bb-db}"
PGADMIN_CONTAINER="${PGADMIN_CONTAINER:-pgadmin}"
PGADMIN_URL="${PGADMIN_URL:-http://localhost:8080/browser/}"
BACKEND_PORT="${BACKEND_PORT:-3000}"
FRONTEND_PORT="${FRONTEND_PORT:-7357}"

LOG_DIR_SERVER="${SERVER_DIR}/.logs"
LOG_DIR_FLUTTER="${FLUTTER_DIR}/.logs"

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

start_backend_if_needed() {
  local pid_file="${LOG_DIR_SERVER}/backend-dev.pid"
  mkdir -p "${LOG_DIR_SERVER}"

  if is_port_listening "${BACKEND_PORT}"; then
    log "Backend already listening on port ${BACKEND_PORT}."
    return
  fi

  if pid_is_alive "${pid_file}"; then
    log "Backend process already running (pid from ${pid_file})."
    return
  fi

  log "Starting backend (npm run dev)..."
  (
    cd "${SERVER_DIR}"
    nohup npm run dev > "${LOG_DIR_SERVER}/backend-dev.log" 2>&1 &
    echo $! > "${pid_file}"
  )
  log "Backend start command sent."
}

start_frontend_if_needed() {
  local pid_file="${LOG_DIR_FLUTTER}/flutter-web.pid"
  mkdir -p "${LOG_DIR_FLUTTER}"

  if is_port_listening "${FRONTEND_PORT}"; then
    log "Frontend already listening on port ${FRONTEND_PORT}."
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

  log "Starting frontend (flutter run -d chrome --web-port ${FRONTEND_PORT})..."
  (
    cd "${FLUTTER_DIR}"
    nohup flutter run -d chrome --web-port "${FRONTEND_PORT}" > "${LOG_DIR_FLUTTER}/flutter-web.log" 2>&1 &
    echo $! > "${pid_file}"
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

  ensure_docker_running
  ensure_container_running "${DB_CONTAINER}"
  ensure_container_running "${PGADMIN_CONTAINER}"
  open_pgadmin_ui
  start_backend_if_needed
  start_frontend_if_needed

  log "Done. Safe to run this script again (idempotent)."
}

main "$@"
