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

Run:
- `Workspace: Show Active Modes`

This prints the current combination:
- Frontend API mode
- Backend DB mode

Inside the app, the Home page shows a small mode badge in local work.

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

## 5. Switch Modes

Available tasks:
- `Workspace: FE Local API + BE Dev DB`
- `Workspace: FE Local API + BE Prod DB`
- `Workspace: FE Prod API + BE Dev DB`
- `Workspace: FE Prod API + BE Prod DB`

Use these when you want to mix:
- local frontend vs production frontend
- dev DB vs production DB

## 6. Logout Behavior

Normal `Logout`:
- clears session data
- keeps local cache only if needed for workflow

`Reset Local Data (Debug)`:
- clears everything local
- token
- cache
- offline queue

## 7. Deploy Web

To build and publish to GitHub Pages:
- run `Deploy Web to GitHub Pages`

That build is release mode and hides the local environment badge.

## 8. Good Defaults

If you are not sure what to do:
1. Use `Start Full Dev Environment`
2. Login with your normal user
3. Use pgAdmin only if you need to inspect `users` or roles
4. Use `Reset Local Data (Debug)` only when you want a clean local state

