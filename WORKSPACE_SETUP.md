# BB Workspace Quick Start (macOS)

This guide is for the workspace with:
- `BB_server`
- `BB_flutter`
- `BB_web`

## One-Click Buttons (VS Code Run Task)

Open this workspace file:
- `/Users/dwrwnlwy/projects/BB_server/BB_ALL.code-workspace`

Then run:
1. `Terminal` -> `Run Task...`
2. Choose one of these:
- `Start Full Dev Environment`
- `Deploy Web to GitHub Pages`

## What Each Button Does

### `Start Full Dev Environment`
Runs:
- Starts Docker Desktop (if not already running)
- Starts containers (only if needed):
  - `bb-db`
  - `pgadmin`
- Opens pgAdmin UI:
  - [http://localhost:8080/browser/](http://localhost:8080/browser/)
- Starts backend (`npm run dev`) only if port `3000` is not already in use
- Starts frontend (`flutter run -d chrome --web-port 7357`) only if not already running

It is safe to run multiple times (idempotent).

### `Deploy Web to GitHub Pages`
Runs `BB_flutter/deploy_web.sh`, which:
- Builds Flutter web
- Syncs build output into `BB_web`
- Commits changes in `BB_web`
- Pushes to GitHub Pages branch

## Notes

- Script location:
  - `/Users/dwrwnlwy/projects/BB_server/scripts/start_full_dev_environment.sh`
- Logs:
  - Backend: `/Users/dwrwnlwy/projects/BB_server/.logs/backend-dev.log`
  - Frontend: `/Users/dwrwnlwy/projects/BB_flutter/.logs/flutter-web.log`
- If a required container does not exist, the script stops with a clear error (it does not recreate containers).
