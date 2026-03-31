# חיבור שכרון ל-Supabase

## שלב 1 – צור פרויקט Supabase

1. כנס ל-[supabase.com](https://supabase.com) והירשם (חינמי)
2. לחץ **"New Project"**
3. בחר שם: `shakaron`
4. בחר region: **West EU (Frankfurt)** — הקרוב לישראל
5. הגדר סיסמת DB חזקה (שמור אותה!)
6. לחץ **"Create new project"** — המתן ~2 דקות

---

## שלב 2 – הרץ את הסכמה

1. ב-Dashboard שלך: **SQL Editor** (בסרגל שמאלי)
2. לחץ **"New query"**
3. העתק את כל תוכן `supabase/schema.sql`
4. לחץ **"Run"** (Ctrl+Enter)
5. אמור לראות: `Success. No rows returned`

---

## שלב 3 – הגדר Google Auth

1. ב-Dashboard: **Authentication → Providers**
2. הפעל **Google**
3. עקוב אחר [המדריך הזה](https://supabase.com/docs/guides/auth/social-login/auth-google)
4. הוסף את ה-Redirect URL שלך:
   - פיתוח: `http://localhost:3000`
   - Production: `https://YOUR_USERNAME.github.io/shakaron`

---

## שלב 4 – קבל את ה-Keys

1. ב-Dashboard: **Settings → API**
2. העתק:
   - **Project URL**: `https://xxxx.supabase.co`
   - **anon public key**: `eyJ...`
3. פתח `supabase/supabase.js` ועדכן:
   ```javascript
   const SUPABASE_URL  = 'https://xxxx.supabase.co';
   const SUPABASE_ANON = 'eyJ...';
   ```

---

## שלב 5 – חבר ל-index.html

הוסף לפני `</head>` ב-`index.html`:
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="supabase/supabase.js"></script>
```

---

## שלב 6 – הגדר את עצמך כאדמין

1. הירשם לאפליקציה פעם אחת (כדי שיווצר פרופיל)
2. ב-Supabase Dashboard: **Table Editor → profiles**
3. מצא את השורה שלך
4. שנה `is_admin` מ-`false` ל-`true`

מעכשיו תוכל לראות:
```sql
-- ב-SQL Editor:
SELECT * FROM admin_dashboard;
SELECT * FROM signups ORDER BY created_at DESC;
```

---

## מה כל טבלה עושה

| טבלה | תיאור | RLS |
|------|-------|-----|
| `profiles` | פרופיל משתמש + תוכנית | רואה רק את עצמו |
| `workers` | פרטי עובדת | רואה רק שלו |
| `rates` | שיעורי ב"ל/פנסיה/הבראה | רואה רק שלו |
| `months` | חודשי דיווח + שבתות/חגים | רואה רק שלו |
| `signups` | רשימת הרשמות פרימיום | כותב כולם, קורא אדמין בלבד |

---

## מעקב הרשמות (Admin)

```sql
-- כל ההרשמות לפרימיום
SELECT name, email, plan, created_at
FROM signups
ORDER BY created_at DESC;

-- סטטיסטיקות משתמשים
SELECT plan, COUNT(*) FROM profiles GROUP BY plan;

-- משתמשים פעילים (עם חודשים)
SELECT * FROM admin_dashboard WHERE month_count > 0;
```

---

## עלויות

| שלב | משתמשים | עלות |
|-----|---------|------|
| Free | עד 50,000 auth users, 500MB DB | $0 |
| Pro | עד 100,000 users, 8GB DB | $25/חודש |

הפרויקט שלך יכול לשרת **אלפי משפחות** בחינם לחלוטין.
