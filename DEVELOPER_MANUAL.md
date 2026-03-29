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

משימה חד־פעמית לניקוי היסטוריה ישנה:
- `One-Time: Replace Production main with Current Branch`

מה היא עושה:
- `npm run build`
- יצירת גיבוי ל־`main` הנוכחי
- החלפת `main` בתוכן של הענף הנוכחי
- דחיפה ל־`origin/main`

משימת העבודה הרגילה אחרי שננקה פעם אחת את `main`:
- `Merge Current Server Branch into main and Start New Branch`

מה היא עושה:
- `npm run build`
- יצירת גיבוי ל־`main` הנוכחי
- merge של הענף הנוכחי לתוך `main`
- דחיפה ל־`origin/main`
- יצירת ענף עבודה חדש אוטומטית מתוך `main`

חשוב:
- ה־DB של הפרודקשן המארח לא נקבע מ־`.env.devdb`/`.env.proddb` המקומיים.
- הוא נקבע מה־Environment Variables שמוגדרים בשרת המארח (Render).

## 9. מדיניות ענפים לפרודקשן (כיום)

נכון להיום:
- ענף הפרודקשן הוא `main`.
- כרגע הענף המעודכן לעבודה הוא `setup-ops`.
- אחרי שתבדוק אותו, נריץ פעם אחת את משימת ה־replace.
- אחר כך נעבוד רק עם משימת ה־merge הרגילה.

## 10. סדר עבודה מומלץ קצר

1. `Start Full Dev Environment`
2. `Workspace: Show Active Modes`
3. עבודה רגילה
4. אם צריך, החלפת סביבה עם אחד מ־`Workspace: FE ...`
5. לפני deploy: בדיקת מצב שוב עם `Show Active Modes`
6. בפעם הראשונה: `One-Time: Replace Production main with Current Branch`
7. אחרי זה: `Merge Current Server Branch into main and Start New Branch`
8. `Deploy Web to GitHub Pages` לפי הצורך
9. `Stop Full Dev Environment`
