#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
FLUTTER_DIR="${SERVER_DIR}/../BB_flutter"

run_step() {
  local title="$1"
  local cmd="$2"
  echo
  echo "=== ${title} ==="
  echo "${cmd}"
  echo
  (
    cd "${SERVER_DIR}"
    eval "${cmd}"
  )
  echo
  echo "Done: ${title}"
}

print_menu() {
  cat <<'EOF'

================= BB Workspace Control Panel =================
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
12) One-Time: Promote Prod DB Lock to main
13) Advanced: One-Time Force Replace main
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
          "FRONTEND_API_MODE=local BACKEND_DB_MODE=dev START_APP_PROCESSES=1 OPEN_PGADMIN_UI=1 ./scripts/start_full_dev_environment.sh"
        ;;
      2)
        run_step \
          "Start Infra Only" \
          "OPEN_PGADMIN_UI=1 FRONTEND_API_MODE=local BACKEND_DB_MODE=dev START_APP_PROCESSES=0 ./scripts/start_full_dev_environment.sh"
        ;;
      3)
        run_step \
          "Start App Only" \
          "FRONTEND_API_MODE=local BACKEND_DB_MODE=dev START_PGADMIN_CONTAINER=0 START_APP_PROCESSES=1 ./scripts/start_full_dev_environment.sh"
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
          "One-Time: Promote Prod DB Lock to main" \
          "ALLOW_PROD_LOCK_UPDATE=1 ./scripts/merge_server_branch_to_main.sh"
        ;;
      13)
        run_step \
          "Advanced: One-Time Force Replace main" \
          "./scripts/deploy_server.sh"
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
