#!/usr/bin/env bash

set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEV_ENV_FILE="${DEV_ENV_FILE:-${SERVER_DIR}/.env.devdb}"
PROD_ENV_FILE="${PROD_ENV_FILE:-${SERVER_DIR}/.env.proddb}"
DB_CONTAINER="${DB_CONTAINER:-bb-db}"
DUMP_FILE="${SERVER_DIR}/.logs/prod-db.dump"

log() {
  echo "[db-refresh] $1"
}

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

require_file() {
  local file="$1"
  if [[ ! -f "${file}" ]]; then
    echo "[db-refresh] ERROR: missing file: ${file}"
    exit 1
  fi
}

ensure_docker_running() {
  if docker info >/dev/null 2>&1; then
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
      echo "[db-refresh] ERROR: Docker did not become ready within ${max_wait} seconds."
      exit 1
    fi
  done
}

ensure_container_running() {
  local name="$1"
  if ! docker container inspect "${name}" >/dev/null 2>&1; then
    echo "[db-refresh] ERROR: container '${name}' does not exist."
    exit 1
  fi

  local running
  running="$(docker inspect -f '{{.State.Running}}' "${name}")"
  if [[ "${running}" != "true" ]]; then
    log "Starting container '${name}'..."
    docker start "${name}" >/dev/null
  fi
}

load_env() {
  local file="$1"
  # shellcheck disable=SC1090
  source "${file}"
}

main() {
  if ! has_cmd pg_dump || ! has_cmd pg_restore || ! has_cmd psql; then
    echo "[db-refresh] ERROR: pg_dump, pg_restore and psql must be installed."
    exit 1
  fi

  require_file "${DEV_ENV_FILE}"
  require_file "${PROD_ENV_FILE}"
  mkdir -p "${SERVER_DIR}/.logs"

  ensure_docker_running
  ensure_container_running "${DB_CONTAINER}"

  load_env "${PROD_ENV_FILE}"
  local prod_host="${PGHOST}"
  local prod_db="${PGDATABASE}"
  local prod_user="${PGUSER}"
  local prod_password="${PGPASSWORD}"
  local prod_ssl="${SSL_FALSE:-true}"

  load_env "${DEV_ENV_FILE}"
  local dev_host="${PGHOST}"
  local dev_db="${PGDATABASE}"
  local dev_user="${PGUSER}"
  local dev_password="${PGPASSWORD}"
  local dev_ssl="${SSL_FALSE:-false}"

  log "About to refresh dev DB '${dev_db}' from prod DB '${prod_db}'."
  log "This will replace the DEV database completely. Production is untouched."
  log "Any local backend sessions connected to DEV will be disconnected during the refresh."

  read -r -p "Type REFRESH to continue: " confirm
  if [[ "${confirm}" != "REFRESH" ]]; then
    log "Cancelled."
    exit 0
  fi

  export PGPASSWORD="${prod_password}"
  if [[ "${prod_ssl}" != "false" ]]; then
    export PGSSLMODE=require
  else
    unset PGSSLMODE || true
  fi

  log "Dumping production database..."
  pg_dump \
    --host="${prod_host}" \
    --username="${prod_user}" \
    --dbname="${prod_db}" \
    --no-owner \
    --no-acl \
    --format=custom \
    --verbose \
    --file="${DUMP_FILE}"

  export PGPASSWORD="${dev_password}"
  if [[ "${dev_ssl}" != "false" ]]; then
    export PGSSLMODE=require
  else
    unset PGSSLMODE || true
  fi

  log "Dropping and recreating DEV database..."
  psql \
    --host="${dev_host}" \
    --username="${dev_user}" \
    --dbname="postgres" \
    --set=ON_ERROR_STOP=1 \
    <<SQL
DROP DATABASE IF EXISTS "${dev_db}" WITH (FORCE);
CREATE DATABASE "${dev_db}" OWNER "${dev_user}";
SQL

  log "Restoring dump into DEV database..."
  pg_restore \
    --host="${dev_host}" \
    --username="${dev_user}" \
    --dbname="${dev_db}" \
    --no-owner \
    --no-acl \
    --verbose \
    "${DUMP_FILE}"

  log "Dev database refreshed from prod successfully."
}

main "$@"
