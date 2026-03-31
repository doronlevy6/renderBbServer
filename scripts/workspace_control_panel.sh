#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
FLUTTER_DIR="${SERVER_DIR}/../BB_flutter"
BACKEND_PORT="${BACKEND_PORT:-9090}"
FRONTEND_PORT="${FRONTEND_PORT:-7357}"

run_step() {
  local title="$1"
  local cmd="$2"
  echo
  echo "=== ${title} ==="
  echo "${cmd}"
  echo
  if (
    cd "${SERVER_DIR}"
    eval "${cmd}"
  ); then
    echo
    echo "Done: ${title}"
    return 0
  else
    local exit_code=$?
    echo
    echo "Failed: ${title} (exit=${exit_code})"
    echo "You can retry this action from the menu."
    return 0
  fi
}

trigger_vscode_task() {
  local encoded_json="$1"
  local url="vscode://command/workbench.action.tasks.runTask?${encoded_json}"
  open "${url}" >/dev/null 2>&1 || true
  echo
  echo "Requested VS Code task."
  echo "If it does not start within a few seconds, run it manually from: Terminal -> Run Task..."
}

is_port_listening() {
  local port="$1"
  lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
}

wait_for_app_ports() {
  local timeout_seconds="${1:-12}"
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

start_app_background_fallback() {
  local backend_log="${SERVER_DIR}/.logs/backend-menu-fallback.log"
  local frontend_log="${FLUTTER_DIR}/.logs/frontend-menu-fallback.log"
  mkdir -p "${SERVER_DIR}/.logs" "${FLUTTER_DIR}/.logs"

  (
    cd "${SERVER_DIR}"
    ./scripts/run_backend_terminal.sh dev "${SERVER_DIR}/.env.devdb" "${BACKEND_PORT}" "${SERVER_DIR}/.logs/backend.meta" "${SERVER_DIR}/.logs/backend-dev.pid" "${SERVER_DIR}" > "${backend_log}" 2>&1 &
  )
  (
    cd "${SERVER_DIR}"
    ./scripts/run_frontend_terminal.sh local LOCAL "${FRONTEND_PORT}" "${FLUTTER_DIR}/.logs/frontend.meta" "${FLUTTER_DIR}/.logs/flutter-web-local.pid" "${FLUTTER_DIR}" > "${frontend_log}" 2>&1 &
  )
  echo "Fallback app launch started in background."
  echo "Backend log: ${backend_log}"
  echo "Frontend log: ${frontend_log}"
}

start_app_via_tasks_with_fallback() {
  local primary_encoded="$1"
  trigger_vscode_task "${primary_encoded}"
  if wait_for_app_ports 12; then
    echo "App processes are UP (backend/frontend)."
    return 0
  fi

  echo
  echo "Primary task trigger did not start both app ports yet. Retrying with backend/frontend task triggers..."
  trigger_vscode_task "%5B%22_Backend%3A%20Dev%20DB%22%5D"
  trigger_vscode_task "%5B%22_Frontend%3A%20Local%20API%22%5D"

  if wait_for_app_ports 15; then
    echo "App processes are UP after fallback trigger."
    return 0
  fi

  echo
  echo "App tasks did not auto-start from this menu session."
  echo "Starting app with script fallback (background)..."
  start_app_background_fallback
  if wait_for_app_ports 20; then
    echo "App processes are UP after script fallback."
    return 0
  fi
  echo "Fallback launch did not bring both ports UP."
  echo "Please run manually: Terminal -> Run Task -> Start Full Dev Environment"
  return 0
}

print_menu() {
  cat <<'EOF'

================= BB Workspace Control Panel =================
 App processes run in VS Code integrated terminals only.
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
          "Start Infra Only" \
          "OPEN_PGADMIN_UI=1 FRONTEND_API_MODE=local BACKEND_DB_MODE=dev START_APP_PROCESSES=0 ./scripts/start_full_dev_environment.sh"
        echo
        echo "=== Start Full Dev Environment (VS Code Task) ==="
        start_app_via_tasks_with_fallback "%5B%22Start%20Full%20Dev%20Environment%22%5D"
        ;;
      2)
        run_step \
          "Start Infra Only" \
          "OPEN_PGADMIN_UI=1 FRONTEND_API_MODE=local BACKEND_DB_MODE=dev START_APP_PROCESSES=0 ./scripts/start_full_dev_environment.sh"
        ;;
      3)
        echo
        echo "=== Start App Only (VS Code Task) ==="
        start_app_via_tasks_with_fallback "%5B%22Start%20App%20Only%20(FE%20Local%20API%20%2B%20BE%20Dev%20DB)%22%5D"
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
