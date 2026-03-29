#!/usr/bin/env bash

set -euo pipefail

MODE="${1:?mode is required}"
ENV_FILE="${2:?env file is required}"
PORT="${3:?port is required}"
META_FILE="${4:?meta file is required}"
PID_FILE="${5:?pid file is required}"
SERVER_DIR="${6:?server dir is required}"

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
clear
echo "=== BB Backend (${MODE}) ==="
echo "ENV_FILE=${ENV_FILE}"
echo "Port=${PORT}"
echo

cd "${SERVER_DIR}"
exec env ENV_FILE="${ENV_FILE}" npm run dev
