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
- `Start Full Dev Environment` (default, recommended)
- `Workspace: FE Local API + BE Dev DB`
- `Workspace: FE Local API + BE Prod DB`
- `Workspace: FE Prod API + BE Dev DB`
- `Workspace: FE Prod API + BE Prod DB`
- `Deploy Web to GitHub Pages`
- `Refresh Dev DB From Prod`

## Environment Files (Backend DB Mode)

Backend mode uses `ENV_FILE`:
- Dev DB: `.env.devdb` (included)
- Prod DB: `.env.proddb` (you create locally)

Create prod template once:
1. Copy `.env.proddb.example` -> `.env.proddb`
2. Fill your real production DB credentials

## Task Matrix

- `Start Full Dev Environment` == `FE Local API + BE Dev DB`
- `Workspace: FE Local API + BE Dev DB`
  - Frontend points to local backend (`APP_ENV=LOCAL`)
  - Backend uses `.env.devdb`
  - Starts `bb-db` + `pgadmin`
- `Workspace: FE Local API + BE Prod DB`
  - Frontend points to local backend (`APP_ENV=LOCAL`)
  - Backend uses `.env.proddb`
  - Starts `pgadmin` (local DB container is skipped)
- `Workspace: FE Prod API + BE Dev DB`
  - Frontend points to production backend (`APP_ENV=PROD`)
  - Backend local process runs with `.env.devdb`
- `Workspace: FE Prod API + BE Prod DB`
  - Frontend points to production backend (`APP_ENV=PROD`)
  - Backend local process runs with `.env.proddb`
- `Workspace: Show Active Modes`
  - Prints the currently selected combination from:
    - `/Users/dwrwnlwy/projects/BB_server/.logs/active-mode.txt`

## Refresh Dev DB From Prod

Use `Refresh Dev DB From Prod` when you want the dev database to become an exact copy of production.

What it does:
- Starts Docker if needed
- Starts `bb-db` if needed
- Dumps the production database
- Drops the local dev database
- Recreates it
- Restores the production dump into dev
- Disconnects any local backend sessions that were using dev

What it does not do:
- It does not change production
- It does not sanitize data

Before it runs, it asks you to type:
- `REFRESH`

## What Startup Script Guarantees

- No duplicate backend/frontend processes
- Safe to run repeatedly (idempotent)
- If mode changed (example: `dev` -> `prod`), it restarts the managed process with the new mode
- Opens pgAdmin UI:
  - [http://localhost:8080/browser/](http://localhost:8080/browser/)
- Writes active mode summary file:
  - `/Users/dwrwnlwy/projects/BB_server/.logs/active-mode.txt`

## Deploy Button

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
  - Backend: `/Users/dwrwnlwy/projects/BB_server/.logs/backend-*.log`
  - Frontend: `/Users/dwrwnlwy/projects/BB_flutter/.logs/flutter-web-*.log`
- If a required container does not exist, the script stops with a clear error (it does not recreate containers).
- Backend default port in this project: `9090`.

## Visual Mode Indicator In App

On Home page app bar you now get:
- `FE: LOCAL` or `FE: PROD`
- Hover shows actual API base URL in tooltip.
