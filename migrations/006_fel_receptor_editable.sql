-- =====================================================================
--  MIGRACION 006 — Receptor editable antes de emitir
--
--  Permite ajustar el nombre y el NIT del receptor ANTES de enviar el DTE a
--  FEL (p. ej. una venta a Consumidor Final que al facturar necesita el NIT
--  real del cliente). El folio y la factura interna no se tocan: solo cambia
--  el receptor con el que se certifica.
--
--  Se guarda el receptor efectivo para que la representacion grafica impresa
--  coincida exactamente con lo certificado ante SAT.
--
--  IDEMPOTENTE Y ADITIVA. Segura en produccion.
--  Ejecutar en: Supabase -> SQL Editor -> New query -> Run
-- =====================================================================

ALTER TABLE public.fel_documentos
  ADD COLUMN IF NOT EXISTS receptor_nit    TEXT;

ALTER TABLE public.fel_documentos
  ADD COLUMN IF NOT EXISTS receptor_nombre TEXT;

-- =====================================================================
--  Verificacion (debe devolver 2 filas):
--    SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'fel_documentos'
--      AND column_name IN ('receptor_nit','receptor_nombre');
-- =====================================================================
