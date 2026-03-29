# מדריך תפעול יחיד (BB Workspace)

זה המסמך היחיד שצריך לתפעול היומי של:
- `BB_server`
- `BB_flutter`
- `BB_web`

## 1. פתיחה והתחלה

1. פתח ב־VS Code:
- `/Users/dwrwnlwy/projects/BB_server/BB_ALL.code-workspace`
2. לחץ:
- `Terminal` -> `Run Task...`
3. בחר:
- `Start Full Dev Environment`

ברירת המחדל שעולה:
- Frontend: `LOCAL`
- Backend DB: `dev` (`.env.devdb`)

מה נפתח:
- Docker Desktop
- `bb-db`
- `pgadmin`
- backend
- frontend

## 2. איך מזהים באיזה סביבה אתה עובד עכשיו

מקור האמת הוא:
1. `Run Task...` -> `Workspace: Show Active Modes`

תראה שם:
- `Frontend API Mode`
- `Backend DB Mode`
- `Frontend APP_ENV`
- `Backend ENV_FILE`

אפשר לראות גם כאן:
- `/Users/dwrwnlwy/projects/BB_server/.logs/active-mode.txt`
- `/Users/dwrwnlwy/projects/BB_server/src/generated/runtimeMode.ts`
- `/Users/dwrwnlwy/projects/BB_flutter/lib/generated/runtime_mode.g.dart`
- באפליקציה במסך הבית: `FE: LOCAL` או `FE: PROD`

חשוב:
- בקבצי קוד יש לפעמים `PROD` בתור fallback.
- זה לא אומר שכרגע אתה על `PROD`.
- הערך בפועל נקבע מה־Task בזמן הרצה (`APP_ENV`, `ENV_FILE`).

## 3. החלפת סביבות (בלחיצה)

משימות זמינות:
- `Workspace: FE Local API + BE Dev DB`
- `Workspace: FE Local API + BE Prod DB`
- `Workspace: FE Prod API + BE Dev DB`
- `Workspace: FE Prod API + BE Prod DB`

לאחר כל החלפה:
1. הרץ `Workspace: Show Active Modes`
2. ודא שהמצב הוא מה שהתכוונת

## 4. עצירה מלאה (בלחיצה)

כדי לעצור הכל:
- `Run Task...` -> `Stop Full Dev Environment`

זה עוצר:
- frontend
- backend
- `pgadmin`
- `bb-db`

## 5. pgAdmin והתחברות אדמין

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

## 6. סנכרון DB של dev שיהיה כמו prod

כדי להעתיק את פרודקשן ל־dev:
- `Run Task...` -> `Refresh Dev DB From Prod`
- הקלד `REFRESH` לאישור

מה זה עושה:
- dump ל־prod
- מחיקה ובנייה מחדש של DB מקומי
- restore מלא ל־dev

מה זה לא עושה:
- לא משנה את production DB

## 7. Deploy לפרונט (GitHub Pages)

משימה:
- `Deploy Web to GitHub Pages`

התנהגות קבועה:
- build ב־`release`
- `APP_ENV=PROD`
- `DEPLOY_TARGET=github_pages`

משמעות:
- האתר ב־GitHub Pages תמיד עובד מול שרת הפרודקשן.

## 8. Deploy לשרת (קוד)

משימה:
- `Deploy Server Branch to Origin`

מה היא עושה:
- `npm run build`
- דחיפה של הענף הנוכחי ל־`origin`

חשוב:
- ה־DB של הפרודקשן המארח לא נקבע מ־`.env.devdb`/`.env.proddb` המקומיים.
- הוא נקבע מה־Environment Variables שמוגדרים בשרת המארח (Render).

## 9. מדיניות ענפים לפרודקשן (כיום)

נכון להיום:
- ענף הפרודקשן הוא `main`.
- `main` הוחלף לתוכן של `financial2` (ללא merge).
- נוצר ענף גיבוי:
- `backup/main-before-replace-2026-03-29`

כלומר:
- `main` ו־`financial2` מסונכרנים כרגע.
- יש נקודת חזרה אם צריך.

## 10. סדר עבודה מומלץ קצר

1. `Start Full Dev Environment`
2. `Workspace: Show Active Modes`
3. עבודה רגילה
4. אם צריך, החלפת סביבה עם אחד מ־`Workspace: FE ...`
5. לפני deploy: בדיקת מצב שוב עם `Show Active Modes`
6. Deploy פרונט/שרת לפי הצורך
7. `Stop Full Dev Environment`
