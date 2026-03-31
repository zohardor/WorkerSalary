-- פתרון פשוט: טבלת פרימיום על בסיס מייל
-- ללא תלות ב-auth.users

CREATE TABLE IF NOT EXISTS premium_access (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL UNIQUE,
  plan       TEXT NOT NULL DEFAULT 'premium',
  plan_until TIMESTAMPTZ,
  note       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE premium_access DISABLE ROW LEVEL SECURITY;

-- הוסף גישת פרימיום למשפחה לפי מייל:
-- שנה את הכתובת למייל האמיתי
INSERT INTO premium_access (email, plan, plan_until, note)
VALUES (
  'FAMILY_EMAIL@gmail.com',
  'premium',
  NOW() + INTERVAL '1 year',
  'בטא - גרסת פרימיום ניסיון'
);

-- לצפייה בכל בעלי הגישה:
-- SELECT * FROM premium_access;
