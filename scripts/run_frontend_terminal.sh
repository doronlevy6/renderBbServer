#!/usr/bin/env bash

set -euo pipefail

API_MODE="${1:?api mode is required}"
APP_ENV="${2:?app env is required}"
PORT="${3:?port is required}"
META_FILE="${4:?meta file is required}"
PID_FILE="${5:?pid file is required}"
FLUTTER_DIR="${6:?flutter dir is required}"
OPEN_FRONTEND_UI="${OPEN_FRONTEND_UI:-1}"
FRONTEND_DEVICE="${FRONTEND_DEVICE:-web-server}"
LOG_FILE="$(dirname "${META_FILE}")/frontend-runtime.log"

is_port_listening() {
  lsof -nP -iTCP:"${PORT}" -sTCP:LISTEN >/dev/null 2>&1
}

pid_is_alive() {
  if [[ ! -f "${PID_FILE}" ]]; then
    return 1
  fi
  local pid
  pid="$(cat "${PID_FILE}" 2>/dev/null || true)"
  [[ -n "${pid}" ]] && kill -0 "${pid}" >/dev/null 2>&1
}

if pid_is_alive || is_port_listening; then
  echo "Frontend already running on port ${PORT}. Skipping duplicate start."
  if [[ "${OPEN_FRONTEND_UI}" == "1" ]]; then
    open "http://localhost:${PORT}" >/dev/null 2>&1 || true
  fi
  exit 0
fi

mkdir -p "$(dirname "${META_FILE}")"

cat > "${META_FILE}" <<EOF
PID=$$
API_MODE=${API_MODE}
APP_ENV=${APP_ENV}
DEVICE=${FRONTEND_DEVICE}
PORT=${PORT}
STARTED_AT=$(date +"%Y-%m-%d %H:%M:%S %Z")
EOF

echo "$$" > "${PID_FILE}"

# Stable background-safe logging (avoids process-substitution teardown issues).
exec >> "${LOG_FILE}" 2>&1

printf '\033]1;BB Frontend (%s)\007' "${API_MODE}"
clear >/dev/null 2>&1 || true
echo "=== BB Frontend (${API_MODE}) ==="
echo "APP_ENV=${APP_ENV}"
echo "Port=${PORT}"
echo "Device=${FRONTEND_DEVICE}"
echo "Log=${LOG_FILE}"
echo "StartedAt=$(date +"%Y-%m-%d %H:%M:%S %Z")"
echo

# Open the app only after the web server port is truly listening.
if [[ "${OPEN_FRONTEND_UI}" == "1" ]]; then
  (
    for _ in $(seq 1 120); do
      if lsof -nP -iTCP:"${PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
        open "http://localhost:${PORT}" >/dev/null 2>&1 || true
        exit 0
      fi
      sleep 1
    done
  ) &
fi

cd "${FLUTTER_DIR}"
exec flutter run -d "${FRONTEND_DEVICE}" --web-port "${PORT}" --dart-define=APP_ENV="${APP_ENV}"
