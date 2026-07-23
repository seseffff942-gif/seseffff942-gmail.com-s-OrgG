-- Desactivar RLS para que el backend pueda escribir usando la llave anon
ALTER TABLE office_inventory DISABLE ROW LEVEL SECURITY;

-- Por precaución, eliminamos las políticas anteriores
DROP POLICY IF EXISTS "Allow all authenticated to read office_inventory" ON office_inventory;
DROP POLICY IF EXISTS "Allow all authenticated to insert office_inventory" ON office_inventory;
DROP POLICY IF EXISTS "Allow all authenticated to update office_inventory" ON office_inventory;
DROP POLICY IF EXISTS "Allow all authenticated to delete office_inventory" ON office_inventory;
