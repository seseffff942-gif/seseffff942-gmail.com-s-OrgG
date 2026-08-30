-- Ejecuta esto en el SQL Editor de tu Dashboard de Supabase

CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT,
    role TEXT,
    password TEXT,
    photo TEXT,
    phone TEXT
);

-- Si la tabla 'users' ya existía, actualiza su esquema:
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "sellerCode" TEXT;

CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    name TEXT,
    category TEXT,
    stock NUMERIC,
    price NUMERIC,
    description TEXT,
    image TEXT,
    variants JSONB,
    specifications JSONB
);

-- Si la tabla 'products' ya existía, ejecuta esta línea para agregar las columnas:
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS variants JSONB;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS specifications JSONB;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_external BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.offers (
    id TEXT PRIMARY KEY,
    "buyQty" NUMERIC,
    "freeQty" NUMERIC,
    "productId" TEXT,
    name TEXT
);

-- Si la tabla 'offers' ya existía con otras columnas (ej, de una versión anterior), 
-- ejecuta estas líneas para agregar las columnas faltantes:
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS "buyQty" NUMERIC;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS "freeQty" NUMERIC;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS "price" NUMERIC;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS "sellerPrices" JSONB;

CREATE TABLE IF NOT EXISTS public.invoices (
    id TEXT PRIMARY KEY,
    client TEXT,
    nit TEXT,
    phone TEXT,
    address TEXT,
    items JSONB,
    "totalAmount" NUMERIC,
    "paidAmount" NUMERIC,
    "sellerId" TEXT,
    status TEXT,
    date TEXT,
    notes TEXT,
    is_archived BOOLEAN DEFAULT FALSE
);

-- Si la tabla 'invoices' ya existía, agrega las columnas faltantes:
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.payments (
    id TEXT PRIMARY KEY,
    "invoiceId" TEXT,
    amount NUMERIC,
    date TEXT,
    "receiptUrl" TEXT,
    is_archived BOOLEAN DEFAULT FALSE
);

-- Si la tabla 'payments' ya existía, agrega la columna:
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.clients (
    id TEXT PRIMARY KEY,
    name TEXT,
    "companyName" TEXT,
    nit TEXT,
    phone TEXT,
    address TEXT,
    "createdAt" TEXT
);

-- Ejecuta esto si tu tabla clients ya existe y le falta el campo companyName:
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS "companyName" TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS "clientCode" TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS "isBlocked" BOOLEAN DEFAULT FALSE;

-- Tabla para guardar notificaciones y alertas
CREATE TABLE IF NOT EXISTS public.notifications (
    id TEXT PRIMARY KEY,
    type TEXT,
    title TEXT,
    message TEXT,
    "createdAt" TEXT,
    created_at TEXT,
    "productId" TEXT,
    product_id TEXT,
    "invoiceId" TEXT,
    invoice_id TEXT
);

ALTER TABLE public.users ALTER COLUMN email DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.login_tokens (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    token TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "usedAt" TEXT,
    "expiresAt" TEXT
);

-- Tabla para guardar cotizaciones formales (no afecta stock ni folios de venta)
CREATE TABLE IF NOT EXISTS public.quotations (
    id TEXT PRIMARY KEY,
    folio TEXT,
    "folioNumber" NUMERIC,
    "sellerId" TEXT,
    "sellerName" TEXT,
    client TEXT,
    nit TEXT,
    phone TEXT,
    address TEXT,
    items JSONB,
    "totalAmount" NUMERIC,
    status TEXT DEFAULT 'pendiente',
    date TEXT,
    "validityDays" NUMERIC DEFAULT 15,
    "validUntil" TEXT,
    notes TEXT,
    "invoiceId" TEXT,
    "convertedInvoiceFolio" NUMERIC,
    "createdAt" TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Columnas de geolocalización en clientes
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

-- Tabla de Checkpoints de Visitas en Campo
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

CREATE INDEX IF NOT EXISTS idx_client_visits_client_id ON public.client_visits(client_id);
CREATE INDEX IF NOT EXISTS idx_client_visits_seller_id ON public.client_visits(seller_id);
CREATE INDEX IF NOT EXISTS idx_client_visits_created_at ON public.client_visits(created_at);

ALTER TABLE public.client_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir todo en client_visits para anon y authenticated" ON public.client_visits;
CREATE POLICY "Permitir todo en client_visits para anon y authenticated"
    ON public.client_visits
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);



