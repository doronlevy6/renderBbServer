#!/usr/bin/env bash

set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

ACTIVE_MODE_FILE="${SERVER_DIR}/.logs/active-mode.txt"
DB_CONTAINER="${DB_CONTAINER:-bb-db}"
PGADMIN_CONTAINER="${PGADMIN_CONTAINER:-pgadmin}"
BACKEND_PORT="${BACKEND_PORT:-9090}"
FRONTEND_PORT="${FRONTEND_PORT:-7357}"

read_mode_key() {
  local key="$1"
  if [[ ! -f "${ACTIVE_MODE_FILE}" ]]; then
    echo "unknown"
    return
  fi
  awk -F': ' -v k="${key}" '$1 == k {print $2}' "${ACTIVE_MODE_FILE}" | tail -n 1
}

is_port_listening() {
  local port="$1"
  lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
}

is_container_running() {
  local name="$1"
  if ! command -v docker >/dev/null 2>&1; then
    return 1
  fi
  if ! docker info >/dev/null 2>&1; then
    return 1
  fi
  if ! docker container inspect "${name}" >/dev/null 2>&1; then
    return 1
  fi
  [[ "$(docker inspect -f '{{.State.Running}}' "${name}")" == "true" ]]
}

state_word() {
  local ok="$1"
  if [[ "${ok}" == "1" ]]; then
    echo "UP"
  else
    echo "DOWN"
  fi
}

main() {
  local backend_up=0
  local frontend_up=0
  local db_up=0
  local pgadmin_up=0

  if is_port_listening "${BACKEND_PORT}"; then backend_up=1; fi
  if is_port_listening "${FRONTEND_PORT}"; then frontend_up=1; fi
  if is_container_running "${DB_CONTAINER}"; then db_up=1; fi
  if is_container_running "${PGADMIN_CONTAINER}"; then pgadmin_up=1; fi

  local status="mixed"
  if [[ "${backend_up}" == "1" && "${frontend_up}" == "1" && "${db_up}" == "1" && "${pgadmin_up}" == "1" ]]; then
    status="running"
  elif [[ "${backend_up}" == "0" && "${frontend_up}" == "0" && "${db_up}" == "1" && "${pgadmin_up}" == "1" ]]; then
    status="infra_only"
  elif [[ "${backend_up}" == "1" && "${frontend_up}" == "1" && "${db_up}" == "0" && "${pgadmin_up}" == "0" ]]; then
    status="app_only"
  elif [[ "${backend_up}" == "0" && "${frontend_up}" == "0" && "${db_up}" == "0" && "${pgadmin_up}" == "0" ]]; then
    status="stopped"
  fi

  local cfg_front_mode cfg_back_mode cfg_app_env cfg_env_file cfg_ts
  cfg_front_mode="$(read_mode_key "Frontend API Mode")"
  cfg_back_mode="$(read_mode_key "Backend DB Mode")"
  cfg_app_env="$(read_mode_key "Frontend APP_ENV")"
  cfg_env_file="$(read_mode_key "Backend ENV_FILE")"
  cfg_ts="$(read_mode_key "Timestamp")"

  echo "Overall Status: ${status}"
  echo "LIVE Frontend (port ${FRONTEND_PORT}): $(state_word "${frontend_up}")"
  echo "LIVE Backend (port ${BACKEND_PORT}): $(state_word "${backend_up}")"
  echo "LIVE DB Container (${DB_CONTAINER}): $(state_word "${db_up}")"
  echo "LIVE pgAdmin Container (${PGADMIN_CONTAINER}): $(state_word "${pgadmin_up}")"
  echo "Configured Frontend API Mode: ${cfg_front_mode}"
  echo "Configured Backend DB Mode: ${cfg_back_mode}"
  echo "Configured Frontend APP_ENV: ${cfg_app_env}"
  echo "Configured Backend ENV_FILE: ${cfg_env_file}"
  echo "Configured Timestamp: ${cfg_ts}"
  echo "Legend: LIVE=actual now, Configured=last requested mode"
}

main "$@"
