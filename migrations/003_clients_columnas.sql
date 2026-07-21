-- =====================================================================
--  MIGRACION 003 — Columnas faltantes en la tabla 'clients'
--
--  PROBLEMA
--  El servidor inserta clientes con las columnas "sellerId", "companyName"
--  y "createdAt". Cuando alguna no existe, el insert falla y el codigo entra
--  en una cascada de reintentos (ver safeInsertClient en server.ts):
--
--     insert normal        -> falla: no existe "sellerId"
--     insert camel+snake   -> falla: no existe "company_name"
--     insert podado        -> falla: no existe "created_at"
--     insert minimo        -> falla: clave duplicada
--
--  Es decir, hasta 4 viajes a la base por cada cliente, y el cliente termina
--  guardandose incompleto o no guardandose.
--
--  SOLUCION
--  Agregar las columnas para que el PRIMER insert funcione. Los reintentos
--  dejan de ejecutarse solos.
--
--  IDEMPOTENTE Y ADITIVA: solo agrega columnas si faltan. No modifica ni
--  borra datos, por lo que es segura tambien en produccion.
--
--  Ejecutar en: Supabase -> SQL Editor -> New query -> Run
-- =====================================================================

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS "sellerId"    TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS "companyName" TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS "createdAt"   TEXT;

-- Busquedas por vendedor (pantalla de clientes filtrada)
CREATE INDEX IF NOT EXISTS idx_clients_seller ON public.clients ("sellerId");

-- =====================================================================
--  Verificacion (deben aparecer las tres columnas):
--
--    SELECT column_name FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='clients'
--    ORDER BY column_name;
--
--  NOTA PARA PRODUCCION
--  Si la base real ya tiene estas columnas, esta migracion no hace nada.
--  Si le faltaban, ademas de corregir el guardado elimina 3 viajes a la
--  base por cada cliente creado.
-- =====================================================================
