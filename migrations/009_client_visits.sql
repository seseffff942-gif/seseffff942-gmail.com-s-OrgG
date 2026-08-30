-- ==============================================================================
-- MIGRACIÓN 009: MÓDULO DE VISITAS A CLIENTES & CHECKPOINTS GPS
-- Ejecutar este script en el SQL Editor de tu Dashboard de Supabase
-- ==============================================================================

-- 1. Extender tabla de Clientes con coordenadas y control de visitas
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS "locationAddress" TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS location_address TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS "geotaggedAt" TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS geotagged_at TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS "geotaggedBy" TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS geotagged_by TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS "lastVisitAt" TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS last_visit_at TEXT;

-- 2. Crear tabla de Checkpoints de Visitas
CREATE TABLE IF NOT EXISTS public.client_visits (
    id TEXT PRIMARY KEY,
    "clientId" TEXT,
    client_id TEXT,
    "clientName" TEXT,
    client_name TEXT,
    "clientCode" TEXT,
    client_code TEXT,
    "companyName" TEXT,
    company_name TEXT,
    "sellerId" TEXT,
    seller_id TEXT,
    "sellerName" TEXT,
    seller_name TEXT,
    "sellerEmail" TEXT,
    seller_email TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    accuracy DOUBLE PRECISION,
    "distanceMeters" DOUBLE PRECISION,
    distance_meters DOUBLE PRECISION,
    "visitType" TEXT DEFAULT 'rutina',
    visit_type TEXT DEFAULT 'rutina',
    notes TEXT,
    "photoUrl" TEXT,
    photo_url TEXT,
    "createdAt" TEXT DEFAULT NOW()::TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Índices para acelerar búsquedas y filtros en mapas y reportes
CREATE INDEX IF NOT EXISTS idx_client_visits_client_id ON public.client_visits(client_id);
CREATE INDEX IF NOT EXISTS idx_client_visits_seller_id ON public.client_visits(seller_id);
CREATE INDEX IF NOT EXISTS idx_client_visits_created_at ON public.client_visits(created_at);

-- 4. Habilitar permisos de lectura y escritura para la app
ALTER TABLE public.client_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir todo en client_visits para anon y authenticated" ON public.client_visits;
CREATE POLICY "Permitir todo en client_visits para anon y authenticated"
    ON public.client_visits
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);
