-- ============================================================
-- שכרון – Supabase Schema
-- הרץ את הקובץ הזה ב: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── EXTENSIONS ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── PROFILES (מידע נוסף על משתמש מעבר ל-auth.users) ────────
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT,
  full_name   TEXT,
  plan        TEXT NOT NULL DEFAULT 'free',   -- 'free' | 'premium'
  plan_until  TIMESTAMPTZ,                    -- תאריך פקיעת פרימיום
  is_admin    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── WORKERS (עובדות) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workers (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  passport         TEXT,
  nationality      TEXT DEFAULT 'india',
  start_date       DATE,
  visa_date        DATE,
  phone            TEXT,
  base_salary      NUMERIC(10,2) DEFAULT 0,
  shabbat_bonus    NUMERIC(10,2) DEFAULT 0,
  holiday_bonus    NUMERIC(10,2) DEFAULT 0,
  vac_total        INTEGER DEFAULT 14,
  hol_total        INTEGER DEFAULT 12,
  sick_total       INTEGER DEFAULT 18,
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── RATES (שיעורי הוצאות מעסיק לכל עובדת) ──────────────────
CREATE TABLE IF NOT EXISTS rates (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id    UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  bituach      NUMERIC(5,2) DEFAULT 3.55,
  pension      NUMERIC(5,2) DEFAULT 6.00,
  havra_days   INTEGER DEFAULT 6,
  havra_rate   NUMERIC(8,2) DEFAULT 378,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (worker_id)
);

-- ── MONTHS (חודשי דיווח) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS months (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id    UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  month_key    CHAR(7) NOT NULL,              -- 'YYYY-MM'
  base         NUMERIC(10,2) DEFAULT 0,
  expenses     NUMERIC(10,2) DEFAULT 0,
  vac_days     INTEGER DEFAULT 0,
  notes        TEXT,
  shabbats     TEXT[] DEFAULT '{}',           -- ['2025-01-04', ...]
  holidays     TEXT[] DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (worker_id, month_key)
);

-- ── SIGNUPS (רשימת הרשמות פרימיום) ─────────────────────────
CREATE TABLE IF NOT EXISTS signups (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  email        TEXT NOT NULL,
  phone        TEXT,
  plan         TEXT DEFAULT 'yearly',
  feedback     TEXT,
  source       TEXT DEFAULT 'app',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── UPDATED_AT TRIGGER ──────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_workers_updated BEFORE UPDATE ON workers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_months_updated BEFORE UPDATE ON months
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_rates_updated BEFORE UPDATE ON rates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── AUTO-CREATE PROFILE ON SIGNUP ───────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── ROW LEVEL SECURITY ───────────────────────────────────────
ALTER TABLE profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE rates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE months    ENABLE ROW LEVEL SECURITY;
ALTER TABLE signups   ENABLE ROW LEVEL SECURITY;

-- profiles: כל משתמש רואה ועורך רק את עצמו
CREATE POLICY "profile_select_own" ON profiles FOR SELECT
  USING (id = auth.uid());
CREATE POLICY "profile_update_own" ON profiles FOR UPDATE
  USING (id = auth.uid());

-- workers: רק הבעלים רואה את העובדות שלו
CREATE POLICY "workers_select_own" ON workers FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "workers_insert_own" ON workers FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "workers_update_own" ON workers FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY "workers_delete_own" ON workers FOR DELETE
  USING (user_id = auth.uid());

-- rates: דרך worker_id שמחובר ל-user_id
CREATE POLICY "rates_select_own" ON rates FOR SELECT
  USING (worker_id IN (SELECT id FROM workers WHERE user_id = auth.uid()));
CREATE POLICY "rates_insert_own" ON rates FOR INSERT
  WITH CHECK (worker_id IN (SELECT id FROM workers WHERE user_id = auth.uid()));
CREATE POLICY "rates_update_own" ON rates FOR UPDATE
  USING (worker_id IN (SELECT id FROM workers WHERE user_id = auth.uid()));
CREATE POLICY "rates_delete_own" ON rates FOR DELETE
  USING (worker_id IN (SELECT id FROM workers WHERE user_id = auth.uid()));

-- months: דרך worker_id
CREATE POLICY "months_select_own" ON months FOR SELECT
  USING (worker_id IN (SELECT id FROM workers WHERE user_id = auth.uid()));
CREATE POLICY "months_insert_own" ON months FOR INSERT
  WITH CHECK (worker_id IN (SELECT id FROM workers WHERE user_id = auth.uid()));
CREATE POLICY "months_update_own" ON months FOR UPDATE
  USING (worker_id IN (SELECT id FROM workers WHERE user_id = auth.uid()));
CREATE POLICY "months_delete_own" ON months FOR DELETE
  USING (worker_id IN (SELECT id FROM workers WHERE user_id = auth.uid()));

-- signups: כל אחד יכול להוסיף, רק אדמין רואה
CREATE POLICY "signups_insert_all" ON signups FOR INSERT
  WITH CHECK (TRUE);
CREATE POLICY "signups_select_admin" ON signups FOR SELECT
  USING (
    auth.uid() IN (SELECT id FROM profiles WHERE is_admin = TRUE)
  );

-- ── ADMIN VIEW (נוחות לאדמין) ───────────────────────────────
CREATE OR REPLACE VIEW admin_dashboard AS
SELECT
  p.id            AS user_id,
  p.email,
  p.full_name,
  p.plan,
  p.plan_until,
  p.created_at    AS joined,
  COUNT(DISTINCT w.id)  AS worker_count,
  COUNT(DISTINCT m.id)  AS month_count
FROM profiles p
LEFT JOIN workers w ON w.user_id = p.id
LEFT JOIN months  m ON m.worker_id = w.id
GROUP BY p.id, p.email, p.full_name, p.plan, p.plan_until, p.created_at
ORDER BY p.created_at DESC;

-- הגישה ל-view רק לאדמין (דרך service_role key)
-- אין צורך ב-RLS על view — הגדר ב-Dashboard תחת Roles

-- ── INDEXES ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_workers_user_id  ON workers(user_id);
CREATE INDEX IF NOT EXISTS idx_months_worker_id ON months(worker_id);
CREATE INDEX IF NOT EXISTS idx_months_key       ON months(month_key);
CREATE INDEX IF NOT EXISTS idx_signups_email    ON signups(email);
