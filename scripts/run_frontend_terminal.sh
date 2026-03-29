#!/usr/bin/env bash

set -euo pipefail

API_MODE="${1:?api mode is required}"
APP_ENV="${2:?app env is required}"
PORT="${3:?port is required}"
META_FILE="${4:?meta file is required}"
PID_FILE="${5:?pid file is required}"
FLUTTER_DIR="${6:?flutter dir is required}"

mkdir -p "$(dirname "${META_FILE}")"

cat > "${META_FILE}" <<EOF
PID=$$
API_MODE=${API_MODE}
APP_ENV=${APP_ENV}
PORT=${PORT}
STARTED_AT=$(date +"%Y-%m-%d %H:%M:%S %Z")
EOF

echo "$$" > "${PID_FILE}"

printf '\033]1;BB Frontend (%s)\007' "${API_MODE}"
clear
echo "=== BB Frontend (${API_MODE}) ==="
echo "APP_ENV=${APP_ENV}"
echo "Port=${PORT}"
echo

cd "${FLUTTER_DIR}"
exec flutter run -d chrome --web-port "${PORT}" --dart-define=APP_ENV="${APP_ENV}"
