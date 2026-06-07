#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PROJECTS_DIR="$(cd "${SERVER_DIR}/.." && pwd)"
FLUTTER_DIR="${FLUTTER_DIR:-${PROJECTS_DIR}/BB_flutter}"
WEB_DIR="${WEB_DIR:-${PROJECTS_DIR}/BB_web}"

FLUTTER_REPO_URL="${FLUTTER_REPO_URL:-https://github.com/doronlevy6/bbflutter.git}"
WEB_REPO_URL="${WEB_REPO_URL:-https://github.com/doronlevy6/doronlevy6.github.io.git}"

DB_CONTAINER="${DB_CONTAINER:-bb-db}"
DB_VOLUME="${DB_VOLUME:-bb-data}"
DB_IMAGE="${DB_IMAGE:-postgres:15}"
DB_PORT="${DB_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-0000}"
POSTGRES_DB="${POSTGRES_DB:-bb-db}"

PGADMIN_CONTAINER="${PGADMIN_CONTAINER:-pgadmin}"
PGADMIN_VOLUME="${PGADMIN_VOLUME:-pgadmin-data}"
PGADMIN_IMAGE="${PGADMIN_IMAGE:-dpage/pgadmin4}"
PGADMIN_PORT="${PGADMIN_PORT:-8080}"
PGADMIN_DEFAULT_EMAIL="${PGADMIN_DEFAULT_EMAIL:-admin@admin.com}"
PGADMIN_DEFAULT_PASSWORD="${PGADMIN_DEFAULT_PASSWORD:-admin}"

log() {
  echo "[bootstrap] $1"
}

require_command() {
  local command_name="$1"
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "[bootstrap] ERROR: missing command: ${command_name}"
    exit 1
  fi
}

ensure_repo() {
  local directory="$1"
  local url="$2"
  local label="$3"

  if [[ -d "${directory}/.git" ]]; then
    log "${label} repository already exists: ${directory}"
    return
  fi

  if [[ -e "${directory}" ]]; then
    echo "[bootstrap] ERROR: ${directory} exists but is not a Git repository."
    exit 1
  fi

  log "Cloning ${label} repository..."
  git clone "${url}" "${directory}"
}

ensure_docker_running() {
  if docker info >/dev/null 2>&1; then
    return
  fi

  if [[ "$(uname -s)" == "Darwin" ]]; then
    log "Opening Docker Desktop..."
    open -a Docker
  else
    echo "[bootstrap] ERROR: Docker is not running."
    exit 1
  fi

  local waited=0
  while ! docker info >/dev/null 2>&1; do
    sleep 2
    waited=$((waited + 2))
    if (( waited >= 180 )); then
      echo "[bootstrap] ERROR: Docker did not become ready within 180 seconds."
      exit 1
    fi
  done
}

ensure_container() {
  local name="$1"
  shift

  if docker container inspect "${name}" >/dev/null 2>&1; then
    if [[ "$(docker inspect -f '{{.State.Running}}' "${name}")" != "true" ]]; then
      log "Starting existing container: ${name}"
      docker start "${name}" >/dev/null
    else
      log "Container is already running: ${name}"
    fi
    return
  fi

  log "Creating container: ${name}"
  docker run -d --name "${name}" "$@" >/dev/null
}

copy_if_missing() {
  local source_file="$1"
  local target_file="$2"

  if [[ -f "${target_file}" ]]; then
    log "Keeping existing file: ${target_file}"
    return
  fi

  cp "${source_file}" "${target_file}"
  chmod 600 "${target_file}"
  log "Created: ${target_file}"
}

main() {
  require_command git
  require_command node
  require_command npm
  require_command flutter
  require_command docker
  require_command lsof
  require_command rsync

  local node_major
  node_major="$(node -p 'process.versions.node.split(".")[0]')"
  if [[ "${node_major}" != "20" ]]; then
    log "Warning: the server declares Node 20.x; current major version is ${node_major}."
  fi

  ensure_repo "${FLUTTER_DIR}" "${FLUTTER_REPO_URL}" "BB_flutter"
  ensure_repo "${WEB_DIR}" "${WEB_REPO_URL}" "BB_web"

  copy_if_missing "${SERVER_DIR}/.env.devdb.example" "${SERVER_DIR}/.env.devdb"
  copy_if_missing "${SERVER_DIR}/.env.production.lock" "${SERVER_DIR}/.env.proddb"

  ensure_docker_running
  docker volume create "${DB_VOLUME}" >/dev/null
  docker volume create "${PGADMIN_VOLUME}" >/dev/null

  ensure_container "${DB_CONTAINER}" \
    -e POSTGRES_USER="${POSTGRES_USER}" \
    -e POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
    -e POSTGRES_DB="${POSTGRES_DB}" \
    -p "${DB_PORT}:5432" \
    -v "${DB_VOLUME}:/var/lib/postgresql/data" \
    "${DB_IMAGE}"

  ensure_container "${PGADMIN_CONTAINER}" \
    -e PGADMIN_DEFAULT_EMAIL="${PGADMIN_DEFAULT_EMAIL}" \
    -e PGADMIN_DEFAULT_PASSWORD="${PGADMIN_DEFAULT_PASSWORD}" \
    -p "${PGADMIN_PORT}:80" \
    -v "${PGADMIN_VOLUME}:/var/lib/pgadmin" \
    "${PGADMIN_IMAGE}"

  log "Installing server dependencies..."
  (
    cd "${SERVER_DIR}"
    npm install
  )

  log "Installing Flutter dependencies..."
  (
    cd "${FLUTTER_DIR}"
    flutter pub get
  )

  cat <<EOF

Bootstrap completed.

Next local step:
  ${SERVER_DIR}/scripts/start_full_dev_environment.sh

To copy production data into the local database:
  ${SERVER_DIR}/scripts/refresh_dev_db_from_prod.sh

Workspace:
  ${SERVER_DIR}/BB_ALL.code-workspace

Full instructions:
  ${SERVER_DIR}/NEW_MACHINE_SETUP.md
EOF
}

main "$@"
