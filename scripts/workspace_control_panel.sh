#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
FLUTTER_DIR="${SERVER_DIR}/../BB_flutter"
BACKEND_PORT="${BACKEND_PORT:-9090}"
FRONTEND_PORT="${FRONTEND_PORT:-7357}"
PANEL_VERSION="$(git -C "${SERVER_DIR}" rev-parse --short HEAD 2>/dev/null || echo unknown)"
ACTION_LOG="${SERVER_DIR}/.logs/workspace-actions.log"

log_action() {
  local message="$1"
  mkdir -p "$(dirname "${ACTION_LOG}")"
  printf '[%s] %s\n' "$(date +"%Y-%m-%d %H:%M:%S %Z")" "${message}" >> "${ACTION_LOG}"
}

run_step() {
  local title="$1"
  local cmd="$2"
  echo
  echo "=== ${title} ==="
  echo "${cmd}"
  echo
  log_action "START | ${title} | ${cmd}"
  if (
    cd "${SERVER_DIR}"
    eval "${cmd}"
  ); then
    echo
    echo "Done: ${title}"
    log_action "DONE  | ${title}"
    echo
    echo "=== Refreshed Status ==="
    bash ./scripts/show_active_modes.sh | tee -a "${ACTION_LOG}"
    return 0
  else
    local exit_code=$?
    echo
    echo "Failed: ${title} (exit=${exit_code})"
    echo "You can retry this action from the menu."
    log_action "FAIL  | ${title} | exit=${exit_code}"
    echo
    echo "=== Refreshed Status ==="
    bash ./scripts/show_active_modes.sh | tee -a "${ACTION_LOG}"
    return 0
  fi
}

is_port_listening() {
  local port="$1"
  lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
}

wait_for_app_ports() {
  local timeout_seconds="${1:-20}"
  local waited=0
  while (( waited < timeout_seconds )); do
    if is_port_listening "${BACKEND_PORT}" && is_port_listening "${FRONTEND_PORT}"; then
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
  done
  return 1
}

start_frontend_direct() {
  local frontend_log="${FLUTTER_DIR}/.logs/frontend-menu.log"

  mkdir -p "${FLUTTER_DIR}/.logs"

  (
    cd "${SERVER_DIR}"
    ./scripts/run_frontend_terminal.sh local LOCAL "${FRONTEND_PORT}" "${FLUTTER_DIR}/.logs/frontend.meta" "${FLUTTER_DIR}/.logs/flutter-web-local.pid" "${FLUTTER_DIR}" > "${frontend_log}" 2>&1 &
  )

  echo
  echo "Frontend launch sent."
  echo "Frontend log: ${frontend_log}"
  log_action "FRONTEND_DIRECT | local | log=${frontend_log}"
  echo
  echo "=== Refreshed Status ==="
  bash ./scripts/show_active_modes.sh | tee -a "${ACTION_LOG}"
}

print_menu() {
  cat <<EOF

================= BB Workspace Control Panel =================
 App processes open in VS Code integrated terminals with clear titles.
 Version: ${PANEL_VERSION}
 1) Start Full Dev (FE local + BE dev + infra)
 2) Start Infra Only (Docker + DB + pgAdmin + open UI)
 3) Start App Only (FE local + BE dev)
 4) Stop App Only
 5) Stop Infra Only
 6) Stop Full
 7) Show Active Modes
 8) Open pgAdmin UI
 9) Refresh Dev DB From Prod
10) Deploy Web to GitHub Pages
11) Deploy Server to Production (main)
12) Start Frontend Only (Local API)
 0) Exit
==============================================================
EOF
}

main() {
  while true; do
    print_menu
    read -r -p "Select action: " choice

    case "${choice}" in
      1)
        run_step \
          "Start Full Dev Environment" \
          "OPEN_PGADMIN_UI=1 FRONTEND_API_MODE=local BACKEND_DB_MODE=dev START_APP_PROCESSES=1 ./scripts/start_full_dev_environment.sh"
        ;;
      2)
        run_step \
          "Start Infra Only" \
          "OPEN_PGADMIN_UI=1 FRONTEND_API_MODE=local BACKEND_DB_MODE=dev START_APP_PROCESSES=0 ./scripts/start_full_dev_environment.sh"
        ;;
      3)
        run_step \
          "Start App Only" \
          "OPEN_PGADMIN_UI=0 START_PGADMIN_CONTAINER=0 FRONTEND_API_MODE=local BACKEND_DB_MODE=dev START_APP_PROCESSES=1 ./scripts/start_full_dev_environment.sh"
        ;;
      4)
        run_step \
          "Stop App Only" \
          "STOP_INFRA_CONTAINERS=0 ./scripts/stop_full_dev_environment.sh"
        ;;
      5)
        run_step \
          "Stop Infra Only" \
          "STOP_APP_PROCESSES=0 ./scripts/stop_full_dev_environment.sh"
        ;;
      6)
        run_step \
          "Stop Full Dev Environment" \
          "./scripts/stop_full_dev_environment.sh"
        ;;
      7)
        run_step \
          "Show Active Modes" \
          "bash ./scripts/show_active_modes.sh"
        ;;
      8)
        run_step \
          "Open pgAdmin UI" \
          "OPEN_PGADMIN_UI=1 START_APP_PROCESSES=0 ./scripts/start_full_dev_environment.sh"
        ;;
      9)
        run_step \
          "Refresh Dev DB From Prod" \
          "./scripts/refresh_dev_db_from_prod.sh"
        ;;
      10)
        echo
        echo "=== Deploy Web to GitHub Pages ==="
        (
          cd "${FLUTTER_DIR}"
          ./deploy_web.sh
        )
        echo
        echo "Done: Deploy Web to GitHub Pages"
        ;;
      11)
        run_step \
          "Deploy Server to Production (main)" \
          "./scripts/merge_server_branch_to_main.sh"
        ;;
      12)
        run_step \
          "Prepare FE Local API + BE Dev DB" \
          "FRONTEND_API_MODE=local BACKEND_DB_MODE=dev START_PGADMIN_CONTAINER=0 START_APP_PROCESSES=0 ./scripts/start_full_dev_environment.sh"
        start_frontend_direct
        ;;
      0)
        echo "Bye."
        exit 0
        ;;
      *)
        echo "Invalid option. Try again."
        ;;
    esac
  done
}

main "$@"
