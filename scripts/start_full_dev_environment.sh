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
TERMINAL_TARGET="${TERMINAL_TARGET:-auto}" # auto | vscode | terminal
ALLOW_EXTERNAL_TERMINAL="${ALLOW_EXTERNAL_TERMINAL:-0}" # 0 = never open Terminal.app automatically

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

open_command_in_terminal_app() {
  local command="$1"
  local applescript_command
  if ! has_cmd osascript; then
    echo "[dev-start] ERROR: osascript is required on macOS to launch visible Terminal.app sessions."
    exit 1
  fi

  applescript_command="${command//\\/\\\\}"
  applescript_command="${applescript_command//\"/\\\"}"
  osascript \
    -e "tell application \"Terminal\"" \
    -e "activate" \
    -e "do script \"${applescript_command}\"" \
    -e "end tell" >/dev/null 2>&1
}

open_command_in_vscode_terminal() {
  local command="$1"
  local applescript_command
  if ! has_cmd osascript; then
    return 1
  fi

  applescript_command="${command//\\/\\\\}"
  applescript_command="${applescript_command//\"/\\\"}"
  osascript \
    -e "tell application \"Visual Studio Code\" to activate" \
    -e "tell application \"System Events\"" \
    -e "tell process \"Code\"" \
    -e "keystroke \"\`\" using {control down, shift down}" \
    -e "delay 0.2" \
    -e "keystroke \"${applescript_command}\"" \
    -e "key code 36" \
    -e "end tell" \
    -e "end tell" >/dev/null 2>&1
}

open_command_in_terminal() {
  local command="$1"
  local resolved_target="${TERMINAL_TARGET}"

  if [[ "${resolved_target}" == "auto" ]]; then
    if [[ "${TERM_PROGRAM:-}" == "vscode" || -n "${VSCODE_PID:-}" ]]; then
      resolved_target="vscode"
    else
      resolved_target="terminal"
    fi
  fi

  if [[ "${resolved_target}" == "vscode" ]]; then
    if open_command_in_vscode_terminal "${command}"; then
      return 0
    fi
    if [[ "${ALLOW_EXTERNAL_TERMINAL}" != "1" ]]; then
      echo "[dev-start] ERROR: Could not open VS Code integrated terminal automatically."
      echo "[dev-start] External Terminal.app fallback is disabled (ALLOW_EXTERNAL_TERMINAL=${ALLOW_EXTERNAL_TERMINAL})."
      echo "[dev-start] Run the matching VS Code task manually from Terminal -> Run Task..."
      return 1
    fi
    log "Could not open VS Code integrated terminal automatically. Falling back to Terminal.app."
  fi

  if [[ "${ALLOW_EXTERNAL_TERMINAL}" != "1" ]]; then
    echo "[dev-start] ERROR: External Terminal.app launch is disabled (ALLOW_EXTERNAL_TERMINAL=${ALLOW_EXTERNAL_TERMINAL})."
    echo "[dev-start] Use VS Code tasks to run backend/frontend in integrated terminals."
    return 1
  fi

  open_command_in_terminal_app "${command}"
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

  local backend_command
  backend_command="$(printf '%q ' "${runner_script}" "${mode}" "${env_file}" "${BACKEND_PORT}" "${BACKEND_META_FILE}" "${pid_file}" "${SERVER_DIR}")"

  local attempt=1
  while (( attempt <= BACKEND_START_MAX_ATTEMPTS )); do
    log "Opening visible backend terminal (db-mode=${mode}, ENV_FILE=$(basename "${env_file}"), attempt ${attempt}/${BACKEND_START_MAX_ATTEMPTS})..."
    if ! open_command_in_terminal "${backend_command}"; then
      echo "[dev-start] ERROR: Could not open backend command in terminal."
      return 1
    fi

    if wait_for_port "${BACKEND_PORT}" "Backend" "${BACKEND_START_TIMEOUT_SECONDS}"; then
      log "Backend is listening on ${BACKEND_PORT}."
      return 0
    fi

    if is_port_listening "${BACKEND_PORT}"; then
      log "Backend is listening on ${BACKEND_PORT}."
      return 0
    fi

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
    if [[ "${OPEN_FRONTEND_UI}" == "1" ]]; then
      open "http://localhost:${FRONTEND_PORT}" >/dev/null 2>&1 || true
    fi
    return
  fi

  if pid_is_alive "${pid_file}"; then
    log "Frontend process already running (pid from ${pid_file})."
    return
  fi

  if pgrep -f "flutter run -d chrome --web-port ${FRONTEND_PORT}" >/dev/null 2>&1; then
    log "Detected existing frontend launch command for port ${FRONTEND_PORT}. Skipping duplicate start."
    return
  fi

  log "Opening visible frontend terminal (api-mode=${api_mode}, APP_ENV=${app_env})..."
  local frontend_command
  frontend_command="$(printf '%q ' "${runner_script}" "${api_mode}" "${app_env}" "${FRONTEND_PORT}" "${FRONTEND_META_FILE}" "${pid_file}" "${FLUTTER_DIR}")"
  open_command_in_terminal "${frontend_command}"
  log "Frontend terminal opened. Flutter may take a little time to finish booting Chrome."
  if [[ "${OPEN_FRONTEND_UI}" == "1" ]]; then
    (
      wait_for_port "${FRONTEND_PORT}" "Frontend" 90 >/dev/null 2>&1 || true
      open "http://localhost:${FRONTEND_PORT}" >/dev/null 2>&1 || true
    ) &
  fi
}

open_pgadmin_ui() {
  if [[ "${OPEN_PGADMIN_UI}" != "1" ]]; then
    log "Skipping pgAdmin browser auto-open."
    return
  fi

  local check_url="${PGADMIN_URL}"
  local max_wait=40
  local waited=0

  if has_cmd curl; then
    while ! curl -s -o /dev/null -I --max-time 2 "${check_url}"; do
      sleep 1
      waited=$((waited + 1))
      if (( waited >= max_wait )); then
        log "pgAdmin HTTP check timed out after ${max_wait}s. Opening URL anyway."
        break
      fi
    done
  fi

  log "Opening pgAdmin UI: ${PGADMIN_URL}"
  open "${PGADMIN_URL}" >/dev/null 2>&1 || true
}

write_active_mode_file() {
  local backend_env_file="$1"
  local frontend_app_env="LOCAL"
  if [[ "${FRONTEND_API_MODE}" == "prod" ]]; then
    frontend_app_env="PROD"
  fi
  mkdir -p "${LOG_DIR_SERVER}"
  cat > "${ACTIVE_MODE_FILE}" <<EOF
Status: running
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
  local backend_env_file="$1"
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
  serviceStatus: 'running',
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
const String kRuntimeServiceStatus = 'running';
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
  if [[ "${START_PGADMIN_CONTAINER}" == "1" ]]; then
    ensure_container_running "${PGADMIN_CONTAINER}"
    open_pgadmin_ui
  else
    log "Skipping pgAdmin container/UI because START_PGADMIN_CONTAINER=${START_PGADMIN_CONTAINER}."
  fi
  local backend_env_file
  backend_env_file="$(ensure_backend_env_file "${BACKEND_DB_MODE}")"
  write_active_mode_file "${backend_env_file}"
  write_generated_mode_code_files "${backend_env_file}"

  if [[ "${START_APP_PROCESSES}" == "1" ]]; then
    start_backend_if_needed "${BACKEND_DB_MODE}" "${backend_env_file}"
    start_frontend_if_needed "${FRONTEND_API_MODE}"
  else
    log "Skipping backend/frontend launch because START_APP_PROCESSES=${START_APP_PROCESSES}."
  fi

  log "Done. Safe to run this script again (idempotent)."
  log "Active combination: frontend-api=${FRONTEND_API_MODE}, backend-db=${BACKEND_DB_MODE}"
}

main "$@"
