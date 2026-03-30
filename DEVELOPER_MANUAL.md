# מדריך תפעול יחיד (BB Workspace)

זה המסמך היחיד שצריך לתפעול היומי של:
- `BB_server`
- `BB_flutter`
- `BB_web`

## 1. מבנה הכפתורים

מעכשיו יש 3 סוגי כפתורים:

1. `Infra`
- Docker
- DB (`bb-db`)
- `pgadmin`
- פתיחת `pgAdmin UI`

2. `App`
- backend
- frontend

3. `Full`
- גם `Infra` וגם `App`

## 2. פתיחה והתחלה

1. פתח ב־VS Code:
- `/Users/dwrwnlwy/projects/BB_server/BB_ALL.code-workspace`
2. לחץ:
- `Terminal` -> `Run Task...`
3. בחר:
- `Start Full Dev Environment`

ברירת המחדל שעולה:
- Frontend: `LOCAL`
- Backend DB: `dev` (`.env.devdb`)

חשוב:
- `.env.devdb` הוא קובץ מקומי ולא מנוהל בגיט.
- אם חסר לך הקובץ, צור אותו מתוך:
  - `.env.devdb.example`

מה נפתח:
- Docker Desktop
- `bb-db`
- `pgadmin`
- טרמינל של `Prepare` בתוך VS Code
- טרמינל גלוי ל־backend בתוך VS Code
- טרמינל גלוי ל־frontend בתוך VS Code

הערה:
- ה־backend וה־frontend לא רצים "מאחורי הקלעים".
- כל אחד נפתח בטרמינל של VS Code עצמו, עם לוגים חיים כאילו הרצת ידנית.
- כך הכול נשאר בתוך העורך ולא בחלונות חיצוניים.

## 3. כפתורים עיקריים

כפתורי עבודה יומיומיים:
- `Start Infra Only (Docker + DB + pgAdmin)`
- `Stop Infra Only (DB + pgAdmin)`
- `Start App Only (FE Local API + BE Dev DB)`
- `Stop App Only (FE + BE)`
- `Start Full Dev Environment`
- `Stop Full Dev Environment`

מתי משתמשים במה:
- אם אתה רק רוצה DB ו־pgAdmin: `Start Infra Only`
- אם ה־DB כבר למעלה ורק הפרונט/בק נפלו: `Start App Only`
- אם אתה רוצה הכול בלחיצה אחת: `Start Full Dev Environment`
- אם אתה רוצה לעצור רק את האפליקציה: `Stop App Only`
- אם אתה רוצה לעצור רק את התשתית: `Stop Infra Only`
- אם אתה רוצה לכבות הכול: `Stop Full Dev Environment`

## 4. איך מזהים באיזה סביבה אתה עובד עכשיו

מקור האמת הוא:
1. `Run Task...` -> `Workspace: Show Active Modes`

תראה שם:
- `Status` (מצב חי אמיתי כרגע: `running` / `infra_only` / `app_only` / `stopped` / `mixed`)
- `Frontend Runtime` / `Backend Runtime`
- `DB Container` / `pgAdmin Container`
- `Configured ...` (הקונפיג האחרון שהוגדר להרצה)

אפשר לראות גם כאן:
- `/Users/dwrwnlwy/projects/BB_server/.logs/active-mode.txt`
- `/Users/dwrwnlwy/projects/BB_server/src/generated/runtimeMode.ts`
- `/Users/dwrwnlwy/projects/BB_flutter/lib/generated/runtime_mode.g.dart`
- באפליקציה במסך הבית: `FE: LOCAL` או `FE: PROD`

חשוב:
- בקבצי קוד יש לפעמים `PROD` בתור fallback.
- זה לא אומר שכרגע אתה על `PROD`.
- הערך בפועל נקבע מה־Task בזמן הרצה (`APP_ENV`, `ENV_FILE`).
- `Status` מייצג מה רץ כרגע בפועל.
- `Configured ...` מייצג מה הוגדר בפעם האחרונה (לא בהכרח רץ כרגע).

## 5. החלפת סביבות (בלחיצה)

משימות זמינות:
- `Workspace: FE Local API + BE Dev DB`
- `Workspace: FE Local API + BE Prod DB`
- `Workspace: FE Prod API + BE Dev DB`
- `Workspace: FE Prod API + BE Prod DB`

לאחר כל החלפה:
1. הרץ `Workspace: Show Active Modes`
2. ודא שהמצב הוא מה שהתכוונת

## 6. הרמה נפרדת של פרונט או בק

אם רק צד אחד נסגר, לא צריך להוריד את כל הסביבה.

כפתורים זמינים:
- `Start Frontend Only (Local API)`
- `Start Frontend Only (Prod API)`
- `Start Backend Only (Dev DB)`
- `Start Backend Only (Prod DB)`

הערה:
- הכפתורים האלה לא אמורים ליצור כפילויות.
- אם אותו תהליך כבר רץ, הם ידלגו על פתיחה נוספת.

## 7. עצירה מלאה או חלקית

כדי לעצור הכל:
- `Run Task...` -> `Stop Full Dev Environment`

זה עוצר:
- frontend
- backend
- `pgadmin`
- `bb-db`

הערה:
- הטרמינלים הגלויים עצמם יכולים להישאר פתוחים כטאבים, אבל התהליכים בתוכם ייעצרו.
- אם תרצה, אפשר פשוט לסגור גם את הטאבים אחרי העצירה.

כדי לעצור רק את האפליקציה:
- `Run Task...` -> `Stop App Only (FE + BE)`

כדי לעצור רק את התשתית:
- `Run Task...` -> `Stop Infra Only (DB + pgAdmin)`

## 8. pgAdmin והתחברות אדמין

כתובת:
- `http://localhost:8080/browser/`

פרטי כניסה:
- Email: `admin@admin.com`
- Password: `admin`

הערה:
- אי אפשר auto-login דרך URL ב־pgAdmin.
- אפשר `Remember me` בדפדפן.

כניסה כאדמין באפליקציה:
- אין מסך אדמין נפרד.
- נכנסים עם משתמש רגיל.
- אם בטבלת `users` ה־`role` שלו הוא `admin`, תקבל מסכי אדמין.

## 9. סנכרון DB של dev שיהיה כמו prod

כדי להעתיק את פרודקשן ל־dev:
- `Run Task...` -> `Refresh Dev DB From Prod`
- הקלד `REFRESH` לאישור

מה זה עושה:
- dump ל־prod
- מחיקה ובנייה מחדש של DB מקומי
- restore מלא ל־dev

מה זה לא עושה:
- לא משנה את production DB

### 9.1 איך לראות את הנתונים ב־pgAdmin אחרי סנכרון (קליק־אחרי־קליק)

לפעמים אחרי סנכרון צריך רענון/חיבור מחדש ב־pgAdmin כי ה־DB המקומי נבנה מחדש.

1. ב־VS Code לחץ `Run Task...` ואז `Start Infra Only (Docker + DB + pgAdmin)`.
2. בדפדפן פתח `http://localhost:8080/browser/` והתחבר.
3. בצד שמאל ב־pgAdmin פתח `Servers`.
4. קליק ימני על השרת שלך ואז `Disconnect Server`.
5. שוב קליק ימני על אותו שרת ואז `Connect Server`.
6. פתח `Databases`.
7. לחץ על `bb-db` (לא על `postgres`).
8. פתח `Schemas` ואז `public` ואז `Tables`.
9. קליק ימני על `Tables` ואז `Refresh`.
10. כדי לראות נתונים בטבלה: קליק ימני על `users` ואז `View/Edit Data` ואז `All Rows`.

בדיקת אימות מהירה (מומלץ):
1. קליק ימני על `bb-db` ואז `Query Tool`.
2. הרץ:
```sql
SELECT current_database();
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```
3. ודא ש־`current_database()` מחזיר `bb-db`.

### 9.2 אם עדיין ריק ב־pgAdmin: ליצור חיבור חדש נקי (מומלץ)

אם אתה עדיין רואה "ריק", בדרך כלל השרת השמור ב־pgAdmin מצביע ליעד לא נכון.

1. בצד שמאל ב־pgAdmin: קליק ימני על השרת הישן -> `Delete/Drop Server`.
2. קליק ימני על `Servers` -> `Register` -> `Server...`.
3. בלשונית `General`:
- Name: `bb-local`
4. בלשונית `Connection`:
- Host name/address: `host.docker.internal`
- Port: `5432`
- Maintenance database: `bb-db`
- Username: `postgres`
- Password: `0000`
- סמן `Save Password`
5. לחץ `Save`.
6. פתח:
- `Servers` -> `bb-local` -> `Databases` -> `bb-db` -> `Schemas` -> `public` -> `Tables`
7. קליק ימני על `users` -> `View/Edit Data` -> `All Rows`.

בדיקת אימות אחת אחרונה:
1. קליק ימני על `bb-db` -> `Query Tool`
2. הרץ:
```sql
SELECT current_database(), current_user;
SELECT * FROM (
  SELECT 'users' AS t, count(*) AS c FROM users
  UNION ALL SELECT 'teams', count(*) FROM teams
  UNION ALL SELECT 'payments', count(*) FROM payments
  UNION ALL SELECT 'games', count(*) FROM games
  UNION ALL SELECT 'player_rankings', count(*) FROM player_rankings
  UNION ALL SELECT 'game_teams', count(*) FROM game_teams
) s
ORDER BY t;
```
3. התוצאה התקינה כרגע אצלך:
- `users = 39`
- `teams = 14`
- `player_rankings = 344`
- `game_teams = 286`
- `games = 0`
- `payments = 0`

## 10. Deploy לפרונט (GitHub Pages)

משימה:
- `Deploy Web to GitHub Pages`

התנהגות קבועה:
- build ב־`release`
- `APP_ENV=PROD`
- `DEPLOY_TARGET=github_pages`

משמעות:
- האתר ב־GitHub Pages תמיד עובד מול שרת הפרודקשן.

## 11. Deploy לשרת (קוד)

משימת deploy הרגילה:
- `Deploy Server to Production (main)`

מה היא עושה:
- `npm run build`
- יצירת גיבוי ל־`main` הנוכחי
- merge של הענף הנוכחי לתוך `main`
- דחיפה ל־`origin/main`
- יצירת ענף עבודה חדש אוטומטית מתוך `main`
- בדיקת בטיחות לפני deploy: יעד DB בפרוד חייב להיראות כמו `neon.tech` (נקרא מתוך `.env.proddb`)

משימה מתקדמת בלבד (נדירה):
- `Advanced: One-Time Force Replace Production main`
- מיועדת למצב חד־פעמי בלבד שבו מחליפים את `main` בכוח.

חשוב:
- ה־DB של הפרודקשן המארח לא נקבע מ־`.env.devdb`/`.env.proddb` המקומיים.
- הוא נקבע מה־Environment Variables שמוגדרים בשרת המארח (Render).
- דחיפה ל־origin לא משנה את משתני הסביבה של Render.
- אם אתה רוצה לעקוף זמנית את בדיקת Neon (לא מומלץ), אפשר להריץ את הסקריפט עם `REQUIRE_NEON_HOST=0`.

## 12. מדיניות ענפים לפרודקשן (כיום)

נכון להיום:
- ענף הפרודקשן הוא `main`.
- כרגע הענף המעודכן לעבודה הוא `setup-ops`.
- אחרי שתבדוק אותו, נריץ פעם אחת את משימת ה־replace.
- אחר כך נעבוד רק עם משימת ה־merge הרגילה.

## 13. סדר עבודה מומלץ קצר

1. `Start Infra Only (Docker + DB + pgAdmin)` או `Start Full Dev Environment`
2. `Workspace: Show Active Modes`
3. עבודה רגילה
4. אם צריך, `Start App Only (FE Local API + BE Dev DB)` או אחד מ־`Workspace: FE ...`
5. לפני deploy: בדיקת מצב שוב עם `Show Active Modes`
6. Deploy שרת: `Deploy Server to Production (main)`
7. רק במקרה חריג: `Advanced: One-Time Force Replace Production main`
8. `Deploy Web to GitHub Pages` לפי הצורך
9. `Stop App Only (FE + BE)` או `Stop Full Dev Environment`
