-- =====================================================================
--  MIGRACION 004 — Integracion real con INFILE
--
--  1. La URL del certificador se vuelve configurable (pruebas/produccion
--     usan URLs o credenciales distintas; nunca quemadas en el codigo).
--  2. El tipo de DTE por defecto es configurable. El negocio factura con
--     FACTURA CAMBIARIA (FCAM), confirmado con el cliente.
--  3. Se guarda TODO lo que se envia y TODO lo que responde el
--     certificador, tanto en el documento como en la bitacora.
--
--  IDEMPOTENTE Y ADITIVA. Segura en produccion.
--  Ejecutar en: Supabase -> SQL Editor -> New query -> Run
-- =====================================================================

ALTER TABLE public.fel_config
  ADD COLUMN IF NOT EXISTS infile_url TEXT
    DEFAULT 'https://certificador.feel.com.gt/fel/procesounificado/transaccion/v2/xml';

ALTER TABLE public.fel_config
  ADD COLUMN IF NOT EXISTS tipo_dte_default TEXT DEFAULT 'FCAM';

-- Respuesta completa del certificador (JSON crudo), ademas del XML que ya
-- se guarda en xml_enviado / xml_certificado.
ALTER TABLE public.fel_documentos
  ADD COLUMN IF NOT EXISTS respuesta_certificador JSONB;

-- La bitacora tambien conserva la respuesta cruda de cada intento.
ALTER TABLE public.fel_bitacora
  ADD COLUMN IF NOT EXISTS respuesta JSONB;

-- =====================================================================
--  Verificacion:
--    SELECT column_name FROM information_schema.columns
--    WHERE table_name IN ('fel_config','fel_documentos','fel_bitacora')
--      AND column_name IN ('infile_url','tipo_dte_default',
--                          'respuesta_certificador','respuesta');
--  (debe devolver 4 filas)
-- =====================================================================
