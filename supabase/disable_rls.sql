-- כבה RLS על כל הטבלאות (לשלב בטא)
ALTER TABLE workers  DISABLE ROW LEVEL SECURITY;
ALTER TABLE months   DISABLE ROW LEVEL SECURITY;
ALTER TABLE rates    DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE signups  DISABLE ROW LEVEL SECURITY;

-- אמת שהשינוי עבד
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('workers','months','rates','profiles','signups');
