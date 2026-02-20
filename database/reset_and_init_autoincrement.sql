
-- 1. Reset Defects Table Data (Truncate)
TRUNCATE TABLE defects RESTART IDENTITY;

-- 2. Verify Schema (Optional, just ensuring AUTO INCREMENT is set)
-- Note: In PostgreSQL, RESTART IDENTITY resets the serial sequence to 1.
-- If using SQLite locally, logic might differ (DELETE FROM defects; DELETE FROM sqlite_sequence WHERE name='defects';)
-- But we are targeting Supabase (PostgreSQL).

-- 3. (Optional) Insert dummy initial data to verify ID = 1?
-- INSERT INTO defects (title, test_type, severity, priority, status, creator) 
-- VALUES ('System Initialization Check', 'System', 'Minor', 'P3', 'Open', 'Admin');

COMMIT;
