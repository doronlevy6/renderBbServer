#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
FLUTTER_DIR="${SERVER_DIR}/../BB_flutter"

BACKEND_RUNTIME_LOG="${SERVER_DIR}/.logs/backend-runtime.log"
FRONTEND_RUNTIME_LOG="${FLUTTER_DIR}/.logs/frontend-runtime.log"
ACTION_LOG="${SERVER_DIR}/.logs/workspace-actions.log"
ACTIVE_MODE_FILE="${SERVER_DIR}/.logs/active-mode.txt"

print_tail_if_exists() {
  local title="$1"
  local file="$2"
  echo
  echo "=== ${title} ==="
  if [[ -f "${file}" ]]; then
    tail -n 120 "${file}"
  else
    echo "Missing file: ${file}"
  fi
}

print_filtered() {
  local title="$1"
  local file="$2"
  local pattern="$3"
  echo
  echo "=== ${title} ==="
  if [[ -f "${file}" ]]; then
    rg -n "${pattern}" "${file}" | tail -n 60 || true
  else
    echo "Missing file: ${file}"
  fi
}

print_tail_if_exists() {
  local title="$1"
  local file="$2"
  local lines="${3:-80}"
  echo
  echo "=== ${title} ==="
  if [[ -f "${file}" ]]; then
    tail -n "${lines}" "${file}"
  else
    echo "Missing file: ${file}"
  fi
}

echo "=== Active Modes ==="
bash "${SCRIPT_DIR}/show_active_modes.sh" || true

print_tail_if_exists "Last Configured Modes (active-mode.txt)" "${ACTIVE_MODE_FILE}" 40
print_tail_if_exists "Last Workspace Actions" "${ACTION_LOG}" 60
print_filtered "Backend Payment Events (runtime)" "${BACKEND_RUNTIME_LOG}" "\\[payments:add\\]|trace_id|Error adding payment"
print_filtered "Frontend Payment Events (runtime)" "${FRONTEND_RUNTIME_LOG}" "\\[payment:add\\]|\\[api:POST\\]|trace_id|Payment"
