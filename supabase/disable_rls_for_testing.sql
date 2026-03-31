-- ============================================================
-- Option A: כבה RLS לחלוטין (לבדיקה בלבד - לא לפרודקשן!)
-- ============================================================
ALTER TABLE workers  DISABLE ROW LEVEL SECURITY;
ALTER TABLE months   DISABLE ROW LEVEL SECURITY;
ALTER TABLE rates    DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE signups  DISABLE ROW LEVEL SECURITY;


-- ============================================================
-- Option B: אפשר שמירה ללא התחברות (anon) - מתאים לשלב בטא
-- הרץ את זה במקום Option A אם רוצה אבטחה בסיסית
-- ============================================================

-- workers: anon יכול להכניס ולקרוא הכל (ללא מידור)
-- ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "workers_select_own" ON workers;
-- DROP POLICY IF EXISTS "workers_insert_own" ON workers;
-- DROP POLICY IF EXISTS "workers_update_own" ON workers;
-- DROP POLICY IF EXISTS "workers_delete_own" ON workers;
-- CREATE POLICY "allow_all" ON workers FOR ALL USING (true) WITH CHECK (true);

-- months
-- ALTER TABLE months ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "months_select_own" ON months;
-- DROP POLICY IF EXISTS "months_insert_own" ON months;
-- DROP POLICY IF EXISTS "months_update_own" ON months;
-- DROP POLICY IF EXISTS "months_delete_own" ON months;
-- CREATE POLICY "allow_all" ON months FOR ALL USING (true) WITH CHECK (true);

-- rates
-- ALTER TABLE rates ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "rates_select_own" ON rates;
-- DROP POLICY IF EXISTS "rates_insert_own" ON rates;
-- DROP POLICY IF EXISTS "rates_update_own" ON rates;
-- DROP POLICY IF EXISTS "rates_delete_own" ON rates;
-- CREATE POLICY "allow_all" ON rates FOR ALL USING (true) WITH CHECK (true);

-- signups
-- ALTER TABLE signups ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "signups_insert_all" ON signups;
-- DROP POLICY IF EXISTS "signups_select_admin" ON signups;
-- CREATE POLICY "allow_all" ON signups FOR ALL USING (true) WITH CHECK (true);
