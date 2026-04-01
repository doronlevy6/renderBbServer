#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PROJECTS_DIR="$(cd "${SERVER_DIR}/.." && pwd)"
FLUTTER_DIR="${FLUTTER_DIR:-${PROJECTS_DIR}/BB_flutter}"

DB_CONTAINER="${DB_CONTAINER:-bb-db}"
PGADMIN_CONTAINER="${PGADMIN_CONTAINER:-pgadmin}"
PGADMIN_URL="${PGADMIN_URL:-http://localhost:8080/browser/}"
OPEN_PGADMIN_UI="${OPEN_PGADMIN_UI:-0}"
START_APP_PROCESSES="${START_APP_PROCESSES:-0}"
START_PGADMIN_CONTAINER="${START_PGADMIN_CONTAINER:-1}"
BACKEND_PORT="${BACKEND_PORT:-9090}"
FRONTEND_PORT="${FRONTEND_PORT:-7357}"
OPEN_FRONTEND_UI="${OPEN_FRONTEND_UI:-1}"
BACKEND_START_TIMEOUT_SECONDS="${BACKEND_START_TIMEOUT_SECONDS:-35}"
BACKEND_START_MAX_ATTEMPTS="${BACKEND_START_MAX_ATTEMPTS:-2}"
FRONTEND_START_TIMEOUT_SECONDS="${FRONTEND_START_TIMEOUT_SECONDS:-90}"
FRONTEND_START_MAX_ATTEMPTS="${FRONTEND_START_MAX_ATTEMPTS:-2}"
DB_READY_TIMEOUT_SECONDS="${DB_READY_TIMEOUT_SECONDS:-60}"
APP_START_ASYNC="${APP_START_ASYNC:-0}"

LOG_DIR_SERVER="${SERVER_DIR}/.logs"
LOG_DIR_FLUTTER="${FLUTTER_DIR}/.logs"
BACKEND_META_FILE="${LOG_DIR_SERVER}/backend.meta"
FRONTEND_META_FILE="${LOG_DIR_FLUTTER}/frontend.meta"
ACTIVE_MODE_FILE="${LOG_DIR_SERVER}/active-mode.txt"
SERVER_RUNTIME_MODE_FILE="${SERVER_DIR}/src/generated/runtimeMode.ts"
FLUTTER_RUNTIME_MODE_FILE="${FLUTTER_DIR}/lib/generated/runtime_mode.g.dart"

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

pid_for_listening_port() {
  local port="$1"
  lsof -nP -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null | head -n 1
}

command_for_pid() {
  local pid="$1"
  ps -p "${pid}" -o command= 2>/dev/null || true
}

wait_for_port() {
  local port="$1"
  local label="$2"
  local max_wait="${3:-20}"
  local waited=0

  while ! is_port_listening "${port}"; do
    sleep 1
    waited=$((waited + 1))
    if (( waited >= max_wait )); then
      echo "[dev-start] ERROR: ${label} did not start listening on port ${port} within ${max_wait} seconds."
      return 1
    fi
  done

  return 0
}

kill_listening_process_if_matches() {
  local port="$1"
  local label="$2"
  local regex="$3"
  local pid
  pid="$(pid_for_listening_port "${port}")"
  if [[ -z "${pid}" ]]; then
    return 0
  fi

  local cmd
  cmd="$(ps -p "${pid}" -o command= 2>/dev/null || true)"
  if [[ "${cmd}" =~ ${regex} ]]; then
    log "Stopping ${label} on port ${port} to switch modes."
    kill "${pid}" >/dev/null 2>&1 || true
    sleep 1
  fi
}

assert_port_owner_matches() {
  local port="$1"
  local label="$2"
  local regex="$3"
  local pid
  pid="$(pid_for_listening_port "${port}")"
  if [[ -z "${pid}" ]]; then
    return 0
  fi

  local cmd
  cmd="$(command_for_pid "${pid}")"
  if [[ -z "${cmd}" ]]; then
    return 0
  fi

  if [[ ! "${cmd}" =~ ${regex} ]]; then
    echo "[dev-start] ERROR: Port ${port} for ${label} is busy by an unexpected process."
    echo "[dev-start] PID=${pid} CMD=${cmd}"
    echo "[dev-start] Stop that process (or choose another port) and run again."
    return 1
  fi
}

run_command_detached() {
  local command="$1"
  local label="$2"
  local fallback_log="$3"
  mkdir -p "$(dirname "${fallback_log}")"
  nohup /bin/zsh -lc "${command}" >> "${fallback_log}" 2>&1 &
  log "Started ${label} in background fallback mode. Log: ${fallback_log}"
}

open_command_in_terminal() {
  local command="$1"
  local label="${2:-process}"
  local fallback_log="${3:-${LOG_DIR_SERVER}/process-fallback.log}"
  run_command_detached "${command}" "${label}" "${fallback_log}"
  return 0
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

remove_stale_pid_file() {
  local pid_file="$1"
  if [[ ! -f "${pid_file}" ]]; then
    return 0
  fi
  local pid
  pid="$(cat "${pid_file}" 2>/dev/null || true)"
  if [[ -z "${pid}" ]] || ! kill -0 "${pid}" >/dev/null 2>&1; then
    rm -f "${pid_file}"
  fi
}

kill_pid_from_file_if_alive() {
  local pid_file="$1"
  if [[ ! -f "${pid_file}" ]]; then
    return 0
  fi
  local pid
  pid="$(cat "${pid_file}" 2>/dev/null || true)"
  if [[ -n "${pid}" ]] && kill -0 "${pid}" >/dev/null 2>&1; then
    kill "${pid}" >/dev/null 2>&1 || true
    sleep 1
    if kill -0 "${pid}" >/dev/null 2>&1; then
      kill -9 "${pid}" >/dev/null 2>&1 || true
    fi
  fi
  rm -f "${pid_file}"
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
  local example_file
  if [[ "${mode}" == "dev" ]]; then
    file="${SERVER_DIR}/.env.devdb"
    example_file="${SERVER_DIR}/.env.devdb.example"
  else
    file="${SERVER_DIR}/.env.proddb"
    example_file="${SERVER_DIR}/.env.proddb.example"
  fi

  if [[ ! -f "${file}" ]]; then
    if [[ "${mode}" == "dev" && -f "${example_file}" ]]; then
      cp "${example_file}" "${file}"
      log "Created missing dev env file from example: ${file}"
    else
      echo "[dev-start] ERROR: Missing backend env file: ${file}"
      if [[ -f "${example_file}" ]]; then
        echo "[dev-start] Create it from ${example_file} before using ${mode} DB mode."
      fi
      exit 1
    fi
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

wait_for_local_db_ready() {
  local max_wait="${1:-60}"
  local waited=0

  while true; do
    if docker exec "${DB_CONTAINER}" pg_isready -U postgres -d bb-db >/dev/null 2>&1; then
      log "Local DB is ready."
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
    if (( waited >= max_wait )); then
      echo "[dev-start] ERROR: Local DB did not become ready within ${max_wait} seconds."
      return 1
    fi
  done
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
  elif [[ -n "${existing_mode}" ]] && [[ "${existing_mode}" != "${requested_mode}" ]]; then
    kill_listening_process_if_matches "${BACKEND_PORT}" "backend" "(node|ts-node|tsx|npm)"
  fi
}

start_backend_if_needed() {
  local mode="$1"
  local env_file="$2"
  local pid_file="${LOG_DIR_SERVER}/backend-${mode}.pid"
  local runner_script="${SCRIPT_DIR}/run_backend_terminal.sh"
  mkdir -p "${LOG_DIR_SERVER}"
  remove_stale_pid_file "${pid_file}"

  restart_existing_backend_if_mode_changed "${mode}"

  if is_port_listening "${BACKEND_PORT}"; then
    assert_port_owner_matches "${BACKEND_PORT}" "backend" "(node|ts-node|tsx|npm).*(server|ts-node-dev|src/server\\.ts)" || return 1
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
    log "Backend process already running (pid from ${pid_file}), waiting for port..."
    if wait_for_port "${BACKEND_PORT}" "Backend" "${BACKEND_START_TIMEOUT_SECONDS}"; then
      log "Backend is listening on ${BACKEND_PORT}."
      return 0
    fi
    log "Backend pid exists but port is still down. Restarting backend process."
    kill_pid_from_file_if_alive "${pid_file}"
    kill_listening_process_if_matches "${BACKEND_PORT}" "backend" "(node|ts-node|tsx|npm)"
    rm -f "${BACKEND_META_FILE}"
  fi

  local backend_command
  backend_command="$(printf '%q ' "${runner_script}" "${mode}" "${env_file}" "${BACKEND_PORT}" "${BACKEND_META_FILE}" "${pid_file}" "${SERVER_DIR}")"

  local attempt=1
  while (( attempt <= BACKEND_START_MAX_ATTEMPTS )); do
    log "Starting backend process (db-mode=${mode}, ENV_FILE=$(basename "${env_file}"), attempt ${attempt}/${BACKEND_START_MAX_ATTEMPTS})..."
    if ! open_command_in_terminal "${backend_command}" "backend" "${LOG_DIR_SERVER}/backend-menu-fallback.log"; then
      echo "[dev-start] ERROR: Could not start backend command."
      return 1
    fi

    if [[ "${APP_START_ASYNC}" == "1" ]]; then
      log "Backend launch command sent (async mode)."
      return 0
    fi

    if wait_for_port "${BACKEND_PORT}" "Backend" "${BACKEND_START_TIMEOUT_SECONDS}"; then
      log "Backend is listening on ${BACKEND_PORT}."
      return 0
    fi

    if is_port_listening "${BACKEND_PORT}"; then
      log "Backend is listening on ${BACKEND_PORT}."
      return 0
    fi

    kill_pid_from_file_if_alive "${pid_file}"
    kill_listening_process_if_matches "${BACKEND_PORT}" "backend" "(node|ts-node|tsx|npm)"
    rm -f "${BACKEND_META_FILE}"
    log "Backend was not ready after attempt ${attempt}. Retrying..."
    attempt=$((attempt + 1))
  done

  echo "[dev-start] ERROR: Backend did not start listening on port ${BACKEND_PORT} after ${BACKEND_START_MAX_ATTEMPTS} attempts."
  return 1
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
  elif [[ -n "${existing_mode}" ]] && [[ "${existing_mode}" != "${requested_mode}" ]]; then
    kill_listening_process_if_matches "${FRONTEND_PORT}" "frontend" "(flutter|dart)"
  fi
}

start_frontend_if_needed() {
  local api_mode="$1"
  local pid_file="${LOG_DIR_FLUTTER}/flutter-web-${api_mode}.pid"
  local runner_script="${SCRIPT_DIR}/run_frontend_terminal.sh"
  local meta_file="${LOG_DIR_FLUTTER}/frontend.meta"
  local app_env
  if [[ "${api_mode}" == "local" ]]; then
    app_env="LOCAL"
  else
    app_env="PROD"
  fi

  mkdir -p "${LOG_DIR_FLUTTER}"
  remove_stale_pid_file "${pid_file}"

  restart_existing_frontend_if_mode_changed "${api_mode}"

  if is_port_listening "${FRONTEND_PORT}"; then
    assert_port_owner_matches "${FRONTEND_PORT}" "frontend" "(flutter|dart).*(flutter_tools\\.snapshot|flutter run|web-server|chrome)" || return 1
    local existing_mode
    existing_mode="$(read_meta_value "${FRONTEND_META_FILE}" "API_MODE")"
    if [[ -n "${existing_mode}" ]]; then
      log "Frontend already listening on ${FRONTEND_PORT} (api-mode=${existing_mode})."
    else
      log "Frontend already listening on ${FRONTEND_PORT} (unknown mode)."
    fi
    if [[ "${OPEN_FRONTEND_UI}" == "1" ]]; then
      open "http://localhost:${FRONTEND_PORT}" >/dev/null 2>&1 || true
    fi
    return
  fi

  if pid_is_alive "${pid_file}"; then
    log "Frontend process already running (pid from ${pid_file}), waiting for port..."
    if wait_for_port "${FRONTEND_PORT}" "Frontend" "${FRONTEND_START_TIMEOUT_SECONDS}"; then
      log "Frontend is listening on ${FRONTEND_PORT}."
      if [[ "${OPEN_FRONTEND_UI}" == "1" ]]; then
        open "http://localhost:${FRONTEND_PORT}" >/dev/null 2>&1 || true
      fi
      return 0
    fi
    log "Frontend pid exists but port is still down. Restarting frontend process."
    kill_pid_from_file_if_alive "${pid_file}"
    kill_listening_process_if_matches "${FRONTEND_PORT}" "frontend" "(flutter|dart)"
    rm -f "${meta_file}"
  fi

  if pgrep -f "flutter run .*--web-port ${FRONTEND_PORT}" >/dev/null 2>&1; then
    log "Detected existing frontend launch command for port ${FRONTEND_PORT}. Skipping duplicate start."
    if wait_for_port "${FRONTEND_PORT}" "Frontend" "${FRONTEND_START_TIMEOUT_SECONDS}"; then
      log "Frontend is listening on ${FRONTEND_PORT}."
      return 0
    fi
    log "Detected stale Flutter process without listener. Restarting frontend."
    kill_listening_process_if_matches "${FRONTEND_PORT}" "frontend" "(flutter|dart)"
  fi

  log "Starting frontend process (api-mode=${api_mode}, APP_ENV=${app_env})..."
  local frontend_command
  frontend_command="$(printf '%q ' "${runner_script}" "${api_mode}" "${app_env}" "${FRONTEND_PORT}" "${FRONTEND_META_FILE}" "${pid_file}" "${FLUTTER_DIR}")"
  local attempt=1
  while (( attempt <= FRONTEND_START_MAX_ATTEMPTS )); do
    open_command_in_terminal "${frontend_command}" "frontend" "${LOG_DIR_FLUTTER}/frontend-menu-fallback.log"
    log "Frontend process launch sent (attempt ${attempt}/${FRONTEND_START_MAX_ATTEMPTS})."

    if wait_for_port "${FRONTEND_PORT}" "Frontend" "${FRONTEND_START_TIMEOUT_SECONDS}"; then
      log "Frontend is listening on ${FRONTEND_PORT}."
      if [[ "${OPEN_FRONTEND_UI}" == "1" ]]; then
        open "http://localhost:${FRONTEND_PORT}" >/dev/null 2>&1 || true
      fi
      return 0
    fi

    log "Frontend did not open port ${FRONTEND_PORT} on attempt ${attempt}."
    if [[ -f "${LOG_DIR_FLUTTER}/frontend-runtime.log" ]]; then
      log "Last frontend log lines:"
      tail -n 20 "${LOG_DIR_FLUTTER}/frontend-runtime.log" | sed 's/^/[frontend-log] /'
    fi
    kill_pid_from_file_if_alive "${pid_file}"
    kill_listening_process_if_matches "${FRONTEND_PORT}" "frontend" "(flutter|dart)"
    rm -f "${meta_file}"
    attempt=$((attempt + 1))
  done

  echo "[dev-start] ERROR: Frontend did not start listening on port ${FRONTEND_PORT} after ${FRONTEND_START_MAX_ATTEMPTS} attempts."
  return 1
}

open_pgadmin_ui() {
  if [[ "${OPEN_PGADMIN_UI}" != "1" ]]; then
    log "Skipping pgAdmin browser auto-open."
    return
  fi

  log "Opening pgAdmin UI: ${PGADMIN_URL}"
  open "${PGADMIN_URL}" >/dev/null 2>&1 || true
}

write_active_mode_file() {
  local service_status="$1"
  local backend_env_file="$2"
  local frontend_app_env="LOCAL"
  if [[ "${FRONTEND_API_MODE}" == "prod" ]]; then
    frontend_app_env="PROD"
  fi
  mkdir -p "${LOG_DIR_SERVER}"
  cat > "${ACTIVE_MODE_FILE}" <<EOF
Status: ${service_status}
Frontend API Mode: ${FRONTEND_API_MODE}
Backend DB Mode: ${BACKEND_DB_MODE}
Frontend APP_ENV: ${frontend_app_env}
Backend ENV_FILE: $(basename "${backend_env_file}")
Frontend Port: ${FRONTEND_PORT}
Backend Port: ${BACKEND_PORT}
Timestamp: $(date +"%Y-%m-%d %H:%M:%S %Z")
EOF
  log "Wrote active mode file: ${ACTIVE_MODE_FILE}"
}

write_generated_mode_code_files() {
  local service_status="$1"
  local backend_env_file="$2"
  local backend_env_name
  local frontend_app_env="LOCAL"
  local generated_at_iso
  backend_env_name="$(basename "${backend_env_file}")"
  if [[ "${FRONTEND_API_MODE}" == "prod" ]]; then
    frontend_app_env="PROD"
  fi
  generated_at_iso="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

  mkdir -p "$(dirname "${SERVER_RUNTIME_MODE_FILE}")"
  cat > "${SERVER_RUNTIME_MODE_FILE}" <<EOF
// AUTO-GENERATED BY scripts/start_full_dev_environment.sh
// Do not edit manually.
export const runtimeMode = {
  serviceStatus: '${service_status}',
  frontendApiMode: '${FRONTEND_API_MODE}',
  backendDbMode: '${BACKEND_DB_MODE}',
  frontendAppEnv: '${frontend_app_env}',
  backendEnvFile: '${backend_env_name}',
  frontendPort: ${FRONTEND_PORT},
  backendPort: ${BACKEND_PORT},
  generatedAt: '${generated_at_iso}',
} as const;
EOF
  log "Wrote server runtime mode file: ${SERVER_RUNTIME_MODE_FILE}"

  mkdir -p "$(dirname "${FLUTTER_RUNTIME_MODE_FILE}")"
  cat > "${FLUTTER_RUNTIME_MODE_FILE}" <<EOF
// AUTO-GENERATED BY /Users/dwrwnlwy/projects/BB_server/scripts/start_full_dev_environment.sh
// Do not edit manually.
const String kRuntimeServiceStatus = '${service_status}';
const String kRuntimeFrontendApiMode = '${FRONTEND_API_MODE}';
const String kRuntimeBackendDbMode = '${BACKEND_DB_MODE}';
const String kRuntimeFrontendAppEnv = '${frontend_app_env}';
const String kRuntimeBackendEnvFile = '${backend_env_name}';
const int kRuntimeFrontendPort = ${FRONTEND_PORT};
const int kRuntimeBackendPort = ${BACKEND_PORT};
const String kRuntimeGeneratedAt = '${generated_at_iso}';
EOF
  log "Wrote flutter runtime mode file: ${FLUTTER_RUNTIME_MODE_FILE}"
}

main() {
  if [[ ! -d "${FLUTTER_DIR}" ]]; then
    echo "[dev-start] ERROR: Flutter directory not found: ${FLUTTER_DIR}"
    echo "[dev-start] Set FLUTTER_DIR to your BB_flutter absolute path and retry."
    exit 1
  fi

  if ! has_cmd docker; then
    echo "[dev-start] ERROR: docker command not found."
    exit 1
  fi
  if ! has_cmd lsof; then
    echo "[dev-start] ERROR: lsof command not found."
    exit 1
  fi
  if [[ "${START_APP_PROCESSES}" == "1" ]]; then
    if ! has_cmd npm; then
      echo "[dev-start] ERROR: npm command not found."
      exit 1
    fi
    if ! has_cmd flutter; then
      echo "[dev-start] ERROR: flutter command not found."
      exit 1
    fi
  fi

  ensure_valid_modes

  ensure_docker_running
  if [[ "${BACKEND_DB_MODE}" == "dev" ]]; then
    ensure_container_running "${DB_CONTAINER}"
    wait_for_local_db_ready "${DB_READY_TIMEOUT_SECONDS}"
  else
    log "Skipping local DB container start (backend db-mode=prod)."
  fi
  if [[ "${START_PGADMIN_CONTAINER}" == "1" ]]; then
    ensure_container_running "${PGADMIN_CONTAINER}"
    open_pgadmin_ui
  else
    log "Skipping pgAdmin container/UI because START_PGADMIN_CONTAINER=${START_PGADMIN_CONTAINER}."
  fi
  local backend_env_file
  backend_env_file="$(ensure_backend_env_file "${BACKEND_DB_MODE}")"

  if [[ "${START_APP_PROCESSES}" == "1" ]]; then
    write_active_mode_file "starting" "${backend_env_file}"
    write_generated_mode_code_files "starting" "${backend_env_file}"
    start_backend_if_needed "${BACKEND_DB_MODE}" "${backend_env_file}"
    start_frontend_if_needed "${FRONTEND_API_MODE}"
    write_active_mode_file "running" "${backend_env_file}"
    write_generated_mode_code_files "running" "${backend_env_file}"
  else
    write_active_mode_file "infra_only" "${backend_env_file}"
    write_generated_mode_code_files "infra_only" "${backend_env_file}"
    log "Skipping backend/frontend launch because START_APP_PROCESSES=${START_APP_PROCESSES}."
  fi

  log "Done. Safe to run this script again (idempotent)."
  log "Active combination: frontend-api=${FRONTEND_API_MODE}, backend-db=${BACKEND_DB_MODE}"
}

main "$@"
