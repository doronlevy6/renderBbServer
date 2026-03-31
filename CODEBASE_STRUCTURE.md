# מפת מבנה הקוד (BB Workspace)

המסמך נותן תמונה פרקטית של המבנה בין:
- `BB_server` (שרת)
- `BB_flutter` (פרונט)
- `BB_web` (תוצר build ל-GitHub Pages)

## 1) עץ תיקיות מקוצר

```text
BB_server/
├─ .vscode/
│  └─ tasks.json                      # כל ה-Run Task ב-VS Code
├─ scripts/
│  ├─ workspace_control_panel.sh      # תפריט שליטה מרכזי
│  ├─ start_full_dev_environment.sh   # הרמה של dev env
│  ├─ stop_full_dev_environment.sh    # הורדה של dev env
│  ├─ run_backend_terminal.sh         # הרצת backend
│  ├─ run_frontend_terminal.sh        # הרצת flutter web
│  ├─ show_active_modes.sh            # מצב ריצה נוכחי
│  ├─ refresh_dev_db_from_prod.sh     # סנכרון DB dev מ-prod
│  └─ merge_server_branch_to_main.sh  # deploy שרת ל-main
├─ src/
│  ├─ server.ts                       # נקודת כניסה לשרת
│  ├─ dbInit.ts                       # יצירה/ווידוא סכמות DB
│  ├─ models/
│  │  └─ userModel.ts                 # חיבור pool ל-PostgreSQL
│  ├─ controllers/
│  │  ├─ userController.ts
│  │  ├─ verifyToken.ts
│  │  ├─ financeController.ts         # composition בלבד
│  │  └─ finance/
│  │     ├─ paymentRoutes.ts          # add/delete payment + email
│  │     ├─ gameRoutes.ts             # record game + game sessions
│  │     ├─ reportRoutes.ts           # financial reads/summaries
│  │     └─ settingsRoutes.ts         # team/user financial settings
│  ├─ services/
│  │  ├─ emailService.ts
│  │  ├─ userService.ts
│  │  ├─ teamService.ts
│  │  └─ balancedTeamsService.ts
│  └─ socket/
│     └─ socket.ts
└─ dist/                              # תוצר TypeScript build

BB_flutter/lib/
├─ main.dart                          # bootstrap + auth check + preload
├─ services/
│  ├─ api_service.dart                # שכבת API
│  └─ offline_service.dart            # cache + queue + sync
├─ features/
│  ├─ player_management/
│  │  └─ player_management_page.dart
│  └─ draw/
│     └─ draw_page.dart
├─ pages/
│  ├─ player_management_page.dart     # bridge export ל-feature
│  ├─ draw_page.dart                  # bridge export ל-feature
│  ├─ login_page.dart
│  ├─ home_page.dart
│  ├─ financial_summary_page.dart
│  └─ ...
├─ widgets/
│  ├─ icon_button_with_label.dart     # שם תקין
│  └─ icon_butten_with_label.dart     # bridge export לתאימות
├─ models/
│  └─ player.dart
├─ model/
│  └─ player.dart                     # bridge export לתאימות
├─ managers/
│  ├─ environment_manager.dart
│  └─ asset_manager.dart
└─ config/
   └─ theme.dart
```

## 2) מה עושה כל שכבה

### שרת (BB_server)
- `controllers/`:
  מקבל HTTP requests ומחזיר response.
- `controllers/finance/`:
  פוצל לפי פיצ'רים כדי למנוע קובץ ענק אחד.
- `services/`:
  לוגיקה עסקית/אינטגרציות (למשל מייל).
- `models/`:
  גישה למסד נתונים.
- `scripts/`:
  תפעול סביבת עבודה, deploy, sync DB.

### פרונט (BB_flutter)
- `services/api_service.dart`:
  gateway לכל קריאות השרת.
- `services/offline_service.dart`:
  ניהול cache, תור פעולות offline, וסנכרון.
- `features/`:
  אזור מומלץ לקבצים לפי פונקציונליות.
- `pages/`:
  כרגע חלק מהעמודים יושבים כאן, חלק עוברים ל-`features`.

## 3) קבצי Bridge (תאימות לאחור)

קבצי bridge קיימים כדי לא לשבור imports בזמן ריפקטור:
- `lib/pages/player_management_page.dart`
- `lib/pages/draw_page.dart`
- `lib/widgets/icon_butten_with_label.dart`
- `lib/model/player.dart`

רעיון העבודה:
1. מעבירים קוד אמיתי למיקום לוגי חדש.
2. משאירים bridge export.
3. מעדכנים imports בהדרגה.
4. בסוף מוחקים bridge כשאין שימוש.

## 4) איפה מנהלים Tasks

- הגדרות משימות VS Code:
  - `BB_server/.vscode/tasks.json`
- כל משימה שם מפעילה script מתוך:
  - `BB_server/scripts/`

## 5) עקרונות Naming להמשך

- תיקיות: לפי תחום אחריות (`finance`, `features/draw`, `features/player_management`).
- קבצים: שם שמסביר תפקיד (`paymentRoutes`, `reportRoutes`, `settingsRoutes`).
- שמות עם typo נשארים כ-bridge בלבד עד ניקוי מלא.

## 6) מצב ריפקטור נוכחי

בוצע:
- פיצול `financeController` למודולים ייעודיים.
- העברת `player_management` ו-`draw` ל-`features` עם bridge.
- נירמול naming של `icon_button` ו-`models/player` עם bridge.

בהמשך (מומלץ):
- להעביר גם `financial_summary_page` ל-`features/finance`.
- לצמצם קבצי `pages` גדולים ל-widgets + state/controller.
- להסיר bridge files אחרי שכל ה-imports עוברים למיקום החדש.
