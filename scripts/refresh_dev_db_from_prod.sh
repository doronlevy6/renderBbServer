#!/usr/bin/env bash

set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEV_ENV_FILE="${DEV_ENV_FILE:-${SERVER_DIR}/.env.devdb}"
PROD_ENV_FILE="${PROD_ENV_FILE:-${SERVER_DIR}/.env.proddb}"
DB_CONTAINER="${DB_CONTAINER:-bb-db}"
DUMP_FILE="${SERVER_DIR}/.logs/prod-db.dump"
PG_CLIENT_IMAGE="${PG_CLIENT_IMAGE:-postgres:15}"

log() {
  echo "[db-refresh] $1"
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

docker_host_for_client() {
  local host="$1"
  if [[ "${host}" == "localhost" || "${host}" == "127.0.0.1" ]]; then
    echo "host.docker.internal"
    return
  fi
  echo "${host}"
}

main() {
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
  local prod_host_for_docker
  local dev_host_for_docker
  prod_host_for_docker="$(docker_host_for_client "${prod_host}")"
  dev_host_for_docker="$(docker_host_for_client "${dev_host}")"

  log "About to refresh dev DB '${dev_db}' from prod DB '${prod_db}'."
  log "This will replace the DEV database completely. Production is untouched."
  log "Any local backend sessions connected to DEV will be disconnected during the refresh."

  read -r -p "Type REFRESH to continue: " confirm
  if [[ "${confirm}" != "REFRESH" ]]; then
    log "Cancelled."
    exit 0
  fi

  log "Dumping production database..."
  docker run --rm \
    -v "${SERVER_DIR}/.logs:/work" \
    -e PGPASSWORD="${prod_password}" \
    -e PGSSLMODE="$( [[ "${prod_ssl}" != "false" ]] && echo "require" || echo "disable" )" \
    "${PG_CLIENT_IMAGE}" \
    pg_dump \
      --host="${prod_host_for_docker}" \
      --username="${prod_user}" \
      --dbname="${prod_db}" \
      --no-owner \
      --no-acl \
      --format=custom \
      --verbose \
      --file="/work/$(basename "${DUMP_FILE}")"

  log "Dropping and recreating DEV database..."
  docker run --rm \
    -i \
    -e PGPASSWORD="${dev_password}" \
    -e PGSSLMODE="$( [[ "${dev_ssl}" != "false" ]] && echo "require" || echo "disable" )" \
    "${PG_CLIENT_IMAGE}" \
    psql \
      --host="${dev_host_for_docker}" \
      --username="${dev_user}" \
      --dbname="postgres" \
      --set=ON_ERROR_STOP=1 \
      <<SQL
DROP DATABASE IF EXISTS "${dev_db}" WITH (FORCE);
CREATE DATABASE "${dev_db}" OWNER "${dev_user}";
SQL

  log "Restoring dump into DEV database..."
  docker run --rm \
    -v "${SERVER_DIR}/.logs:/work" \
    -e PGPASSWORD="${dev_password}" \
    -e PGSSLMODE="$( [[ "${dev_ssl}" != "false" ]] && echo "require" || echo "disable" )" \
    "${PG_CLIENT_IMAGE}" \
    pg_restore \
      --host="${dev_host_for_docker}" \
      --username="${dev_user}" \
      --dbname="${dev_db}" \
      --no-owner \
      --no-acl \
      --verbose \
      "/work/$(basename "${DUMP_FILE}")"

  log "Dev database refreshed from prod successfully."
}

main "$@"
