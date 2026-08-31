-- Migraciones para base de datos local Supabase en Docker

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS latitude NUMERIC;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS longitude NUMERIC;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS location_address TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS "locationAddress" TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS geotagged_at TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS "geotaggedAt" TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS geotagged_by TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS "geotaggedBy" TEXT;

CREATE TABLE IF NOT EXISTS public.client_visits (
    id TEXT PRIMARY KEY,
    client_id TEXT,
    "clientId" TEXT,
    client_name TEXT,
    "clientName" TEXT,
    client_code TEXT,
    "clientCode" TEXT,
    company_name TEXT,
    "companyName" TEXT,
    seller_id TEXT,
    "sellerId" TEXT,
    seller_name TEXT,
    "sellerName" TEXT,
    seller_email TEXT,
    "sellerEmail" TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    accuracy NUMERIC,
    distance_meters NUMERIC,
    "distanceMeters" NUMERIC,
    visit_type TEXT,
    "visitType" TEXT,
    notes TEXT,
    photo_url TEXT,
    "photoUrl" TEXT,
    created_at TEXT,
    "createdAt" TEXT
);

NOTIFY pgrst, 'reload schema';
