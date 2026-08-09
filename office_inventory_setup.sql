ALTER TABLE office_inventory DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all authenticated to read office_inventory" ON office_inventory;
DROP POLICY IF EXISTS "Allow all authenticated to insert office_inventory" ON office_inventory;
DROP POLICY IF EXISTS "Allow all authenticated to update office_inventory" ON office_inventory;
DROP POLICY IF EXISTS "Allow all authenticated to delete office_inventory" ON office_inventory;
