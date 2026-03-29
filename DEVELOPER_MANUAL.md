# Developer Manual

This is the simple way to work on the BB workspace:

## 1. Open The Workspace

Open:
- `/Users/dwrwnlwy/projects/BB_server/BB_ALL.code-workspace`

## 2. Start The Right Environment

In VS Code:
- `Terminal` -> `Run Task...`

Recommended default:
- `Start Full Dev Environment`

That starts:
- Docker Desktop
- `bb-db`
- `pgadmin`
- backend
- frontend

Default mode:
- Frontend: local API
- Backend: dev DB

## 3. See What You Are Running

To identify the current environment in one click:
1. In VS Code open `Terminal` -> `Run Task...`
2. Click `Workspace: Show Active Modes`

This prints the current combination:
- Frontend API mode
- Backend DB mode
- Frontend APP_ENV
- Backend ENV file

You can also see it here:
- Inside the app Home page: `FE: LOCAL` or `FE: PROD`
- `/Users/dwrwnlwy/projects/BB_server/.logs/active-mode.txt`
The startup task also writes mode snapshot code files:
- `/Users/dwrwnlwy/projects/BB_server/src/generated/runtimeMode.ts`
- `/Users/dwrwnlwy/projects/BB_flutter/lib/generated/runtime_mode.g.dart`

Important:
- In some source files you still see `PROD` as fallback text.
- That does not mean you are running on prod.
- The real environment comes from the task runtime values (`APP_ENV`, `ENV_FILE`).
- To know the truth, always check `Workspace: Show Active Modes`.

## 4. Login

There is no separate admin login screen.

You just log in with a normal username/password.

If that user has `role = admin` in the database, the app shows admin pages.

If you do not know which user is admin:
- Open pgAdmin
- Check table `users`
- Look at the `role` column

Useful query:

```sql
SELECT username, role, team_id
FROM users;
```

## 5. pgAdmin Login Notes

pgAdmin opens to:
- `http://localhost:8080/browser/`

Login credentials:
- Email: `admin@admin.com`
- Password: `admin`

Important:
- pgAdmin does not support automatic login via URL with username/password.
- To avoid typing every time, log in once and use `Remember me` in the browser.
- Full auto-login requires changing pgAdmin server mode and recreating the container.

## 6. Switch Modes

Available tasks:
- `Workspace: FE Local API + BE Dev DB`
- `Workspace: FE Local API + BE Prod DB`
- `Workspace: FE Prod API + BE Dev DB`
- `Workspace: FE Prod API + BE Prod DB`

Use these when you want to mix:
- local frontend vs production frontend
- dev DB vs production DB

## 7. Stop Everything (One Click)

When you want to stop working:
- run `Stop Full Dev Environment`

That stops:
- frontend
- backend
- `pgadmin`
- `bb-db`

## 8. Logout Behavior

Normal `Logout`:
- clears session data
- keeps local cache only if needed for workflow

`Reset Local Data (Debug)`:
- clears everything local
- token
- cache
- offline queue

## 9. Deploy Web

To build and publish to GitHub Pages:
- run `Deploy Web to GitHub Pages`

That build is always:
- release mode
- `APP_ENV=PROD`
- `DEPLOY_TARGET=github_pages`

So GitHub Pages always works against the production server.

## 10. Deploy Server

To push the server branch to GitHub:
- run `Deploy Server Branch to Origin`

That task:
- runs `npm run build`
- pushes the current branch to `origin`

Important:
- The production database for the hosted server is not taken from your local `.env.devdb` or `.env.proddb`
- It is taken from the environment variables configured on the hosted server

## 11. Refresh Dev DB From Prod

If you want the dev database to look exactly like production:
- run `Refresh Dev DB From Prod`

It will:
- dump production
- drop the local dev database
- recreate it
- restore the production dump into dev
- disconnect any local backend sessions that were connected to dev

Production is not changed.

## 12. Good Defaults

If you are not sure what to do:
1. Use `Start Full Dev Environment`
2. Login with your normal user
3. Use pgAdmin only if you need to inspect `users` or roles
4. Use `Reset Local Data (Debug)` only when you want a clean local state
