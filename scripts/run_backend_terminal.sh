#!/usr/bin/env bash

set -euo pipefail

MODE="${1:?mode is required}"
ENV_FILE="${2:?env file is required}"
PORT="${3:?port is required}"
META_FILE="${4:?meta file is required}"
PID_FILE="${5:?pid file is required}"
SERVER_DIR="${6:?server dir is required}"

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
  echo "Backend already running on port ${PORT}. Skipping duplicate start."
  exit 0
fi

mkdir -p "$(dirname "${META_FILE}")"

cat > "${META_FILE}" <<EOF
PID=$$
MODE=${MODE}
ENV_FILE=${ENV_FILE}
PORT=${PORT}
STARTED_AT=$(date +"%Y-%m-%d %H:%M:%S %Z")
EOF

echo "$$" > "${PID_FILE}"

printf '\033]1;BB Backend (%s)\007' "${MODE}"
clear >/dev/null 2>&1 || true
echo "=== BB Backend (${MODE}) ==="
echo "ENV_FILE=${ENV_FILE}"
echo "Port=${PORT}"
echo

cd "${SERVER_DIR}"
exec env ENV_FILE="${ENV_FILE}" npm run dev
