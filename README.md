# מטפל ✦ – מערכת ניהול שכר עובדת זרה

אפליקציית PWA לניהול שכר עובדת זרה — לוח שנה אינטראקטיבי, חגים ישראלים + לאומיים, דוחות PDF, מדריך העסקה מלא.

---

## 🚀 העלאה ל-GitHub + GitHub Pages

### שלב 1 – צור חשבון GitHub
אם אין לך חשבון: https://github.com → Sign up

### שלב 2 – צור Repository
1. לחץ "New" (כפתור ירוק בצד שמאל)
2. Repository name: shakaron
3. בחר Public (נדרש ל-GitHub Pages חינמי)
4. אל תסמן Initialize with README
5. לחץ "Create repository"

### שלב 3 – העלה קבצים דרך הדפדפן
1. בדף ה-Repository החדש לחץ "uploading an existing file"
2. פתח את תיקיית worker-salary-app על המחשב
3. סמן את כל הקבצים והתיקיות (Ctrl+A)
4. גרור לחלון הדפדפן
5. כתוב בתיבת ה-Commit: Initial commit
6. לחץ "Commit changes"

⚠️ חשוב: ודא שהתיקיות .github/workflows/ ו-supabase/ עולות גם הן

### שלב 4 – הפעל GitHub Pages
1. ב-Repository לחץ Settings
2. בתפריט שמאל לחץ "Pages"
3. תחת Source בחר "GitHub Actions"
4. המתן 2-3 דקות
5. הכתובת: https://YOUR_USERNAME.github.io/shakaron/

---

## ☁️ חיבור ל-Supabase

ראה supabase/SETUP.md להוראות מפורטות.

---

## 🔑 GitHub Token לסנכרון Gist

1. GitHub → Settings → Developer settings → Tokens (classic)
2. Generate new token → Scope: gist בלבד
3. העתק מיד (לא יוצג שוב)
4. הזן באפליקציה: לחץ ☁️ סנכרן

---

## 📁 מבנה הקבצים

```
shakaron/
├── index.html          # האפליקציה הראשית
├── app.js              # לוגיקה ראשית
├── holidays.js         # מאגר חגים
├── sw.js               # Service Worker
├── manifest.json       # הגדרות PWA
├── icons/
├── supabase/
│   ├── schema.sql      # סכמת DB + RLS
│   ├── supabase.js     # שכבת נתונים
│   └── SETUP.md        # מדריך הגדרה
└── .github/workflows/  # פריסה אוטומטית
```

---

## 📄 רישיון
שימוש אישי חופשי.
