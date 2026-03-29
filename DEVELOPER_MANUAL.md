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
6. בפעם הראשונה: `One-Time: Replace Production main with Current Branch`
7. אחרי זה: `Merge Current Server Branch into main and Start New Branch`
8. `Deploy Web to GitHub Pages` לפי הצורך
9. `Stop App Only (FE + BE)` או `Stop Full Dev Environment`
