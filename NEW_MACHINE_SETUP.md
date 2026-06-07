# הקמת סביבת העבודה במחשב חדש

מסמך זה הוא מקור האמת למעבר של סביבת העבודה למחשב חדש.

## מה נשמר במאגרים

- קוד השרת.
- קוד היישומון.
- תוצרי האתר המפורסם.
- סקריפטים להפעלה ולעצירה.
- חיבור למסד הנתונים המרוחק.
- הגדרות הפריסה של השרת ושל האתר.
- סכמת מסד הנתונים.

נתוני מסד הנתונים המקומי אינם נשמרים במאגר. אפשר ליצור מסד ריק או להעתיק אליו את נתוני סביבת הייצור.

## דרישות מוקדמות

יש להתקין:

```text
Git
Node.js 20
Flutter
Docker Desktop
Visual Studio Code
```

יש להתחבר לחשבון המתאים.

```text
GitHub
```

החשבון חייב להיות מורשה לדחיפה לשלושת המאגרים.

```text
renderBbServer
bbflutter
doronlevy6.github.io
```

החיבור נדרש לצורך הורדת מאגרים, דחיפת שינויים ופריסה.

## הורדה והקמה ראשונית

צור תיקיית פרויקטים והורד את מאגר השרת:

```bash
mkdir -p ~/projects
cd ~/projects
git clone https://github.com/doronlevy6/renderBbServer.git BB_server
cd BB_server
chmod +x scripts/*.sh
./scripts/bootstrap_new_machine.sh
```

סקריפט ההקמה:

- מוריד את שני המאגרים הנוספים אם הם חסרים.
- יוצר קובצי הגדרות מקומיים.
- יוצר נפחים קבועים למסד הנתונים ולכלי הניהול.
- יוצר ומפעיל את המכולות.
- מתקין את חבילות השרת והיישומון.
- אינו מוחק נתונים קיימים.

בסיום יהיו שלושה מאגרים סמוכים:

```text
~/projects/BB_server
~/projects/BB_flutter
~/projects/BB_web
```

## הרצה מקומית

פתח את סביבת העבודה:

```text
~/projects/BB_server/BB_ALL.code-workspace
```

מתוך תפריט המשימות בחר:

```text
Workspace Control Panel (Menu)
```

להרצה מלאה בחר:

```text
Start Full Dev
```

כתובות מקומיות:

```text
Frontend
http://localhost:7357

Backend
http://localhost:9090

pgAdmin
http://localhost:8080/browser/
```

פרטי כלי ניהול מסד הנתונים:

```text
Email
admin@admin.com

Password
admin
```

פרטי מסד הנתונים המקומי:

```text
Host
host.docker.internal

Port
5432

Database
bb-db

Username
postgres

Password
0000
```

## העתקת נתוני סביבת הייצור למסד המקומי

להעתקת הנתונים בחר בתפריט:

```text
Refresh Dev DB From Prod
```

או הרץ:

```bash
./scripts/refresh_dev_db_from_prod.sh
```

יש להקליד את מילת האישור שמופיעה במסך. הפעולה מחליפה רק את מסד הנתונים המקומי ואינה משנה את סביבת הייצור.

## עבודה מקומית מול סביבת הייצור

התפריט מאפשר לבחור בנפרד את יעד היישומון ואת יעד השרת:

```text
Workspace: FE Local API + BE Dev DB
Workspace: FE Local API + BE Prod DB
Workspace: FE Prod API + BE Dev DB
Workspace: FE Prod API + BE Prod DB
```

לפני כל פעולה בדוק את המצב:

```text
Workspace: Show Active Modes
```

## פריסת השרת

פריסת השרת מתבצעת באמצעות:

```text
Deploy Server to Production (main)
```

הפעולה:

- בונה את השרת.
- בודקת שהחיבור של סביבת הייצור מצביע למסד הנתונים המרוחק הנכון.
- ממזגת את ענף העבודה לענף הראשי.
- דוחפת את הענף הראשי.
- מפעילה את הפריסה המקושרת למאגר.

## פריסת האתר

פריסת האתר מתבצעת באמצעות:

```text
Deploy Web to GitHub Pages
```

הפעולה:

- ממזגת את ענף העבודה של היישומון לענף הייצור.
- בונה גרסת אתר לסביבת הייצור.
- מעתיקה את התוצרים למאגר האתר.
- יוצרת שמירה ודוחפת אותה.

## בדיקת תקינות

לאחר ההקמה הרץ:

```bash
./scripts/show_active_modes.sh
```

המצב התקין להרצה מלאה צריך להציג שהיישומון, השרת, מסד הנתונים וכלי הניהול פעילים.

## קבצים חשובים

```text
DEVELOPER_MANUAL.md
NEW_MACHINE_SETUP.md
.env.production.lock
.env.devdb
.env.proddb
scripts/bootstrap_new_machine.sh
scripts/start_full_dev_environment.sh
scripts/refresh_dev_db_from_prod.sh
```

הקבצים המקומיים הבאים אינם נדחפים:

```text
.env
.env.devdb
.env.proddb
.logs
```

## הערת אבטחה

קובץ החיבור של סביבת הייצור נמצא כרגע במאגר פרטי ונדרש לפעולות הקיימות. אין לשתף אותו, לצלם אותו או להעביר אותו מחוץ לחשבון המורשה.
