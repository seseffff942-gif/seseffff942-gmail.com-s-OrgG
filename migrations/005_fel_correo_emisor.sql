-- =====================================================================
--  MIGRACION 005 — Correo del emisor en el DTE
--
--  SAT/INFILE en PRODUCCION valida que el emisor tenga un correo valido.
--  Hasta ahora el XML enviaba CorreoEmisor="" (vacio), que el SandBox
--  acepta pero produccion puede rechazar. Se vuelve configurable.
--
--  IDEMPOTENTE Y ADITIVA. Segura en produccion.
--  Ejecutar en: Supabase -> SQL Editor -> New query -> Run
-- =====================================================================

ALTER TABLE public.fel_config
  ADD COLUMN IF NOT EXISTS correo_emisor TEXT;

-- =====================================================================
--  Verificacion:
--    SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'fel_config' AND column_name = 'correo_emisor';
--  (debe devolver 1 fila)
--
--  Luego, cargar el correo real del emisor (Agricovet):
--    UPDATE public.fel_config SET correo_emisor = 'correo@agricovet.com' WHERE id = 1;
-- =====================================================================
