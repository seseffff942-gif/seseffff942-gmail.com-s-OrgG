-- =====================================================================
--  AGRICOVET - Script de creacion de la base de DESARROLLO
--  Ejecutar UNA VEZ en: Supabase -> SQL Editor -> New query -> Run
--  Proyecto destino: vkrpvvqvtyyqqstyuchc  (NO ejecutar en produccion)
-- =====================================================================

-- ---------- 1. TABLAS ----------

CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT,
    role TEXT,
    password TEXT,
    photo TEXT,
    phone TEXT
);

CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    name TEXT,
    category TEXT,
    stock NUMERIC,
    price NUMERIC,
    description TEXT,
    image TEXT,
    variants JSONB,
    specifications JSONB,
    is_external BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS public.offers (
    id TEXT PRIMARY KEY,
    "buyQty" NUMERIC,
    "freeQty" NUMERIC,
    "productId" TEXT,
    name TEXT,
    price NUMERIC,
    "sellerPrices" JSONB
);

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

CREATE TABLE IF NOT EXISTS public.payments (
    id TEXT PRIMARY KEY,
    "invoiceId" TEXT,
    amount NUMERIC,
    date TEXT,
    "receiptUrl" TEXT,
    is_archived BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS public.clients (
    id TEXT PRIMARY KEY,
    name TEXT,
    "companyName" TEXT,
    nit TEXT,
    phone TEXT,
    address TEXT,
    "createdAt" TEXT
);

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

CREATE TABLE IF NOT EXISTS public.dispatches (
    id TEXT PRIMARY KEY,
    "invoiceId" TEXT,
    items JSONB,
    date TEXT,
    client TEXT,
    "sellerId" TEXT
);

-- ---------- 2. INDICES (consultas mas rapidas = menos costo) ----------

CREATE INDEX IF NOT EXISTS idx_invoices_seller  ON public.invoices ("sellerId");
CREATE INDEX IF NOT EXISTS idx_invoices_date    ON public.invoices (date);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON public.payments ("invoiceId");
CREATE INDEX IF NOT EXISTS idx_products_cat     ON public.products (category);

-- ---------- 3. STORAGE (imagenes de productos, logo, firmas, recibos) ----------

INSERT INTO storage.buckets (id, name, public)
VALUES ('productos', 'productos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "dev_lectura_publica" ON storage.objects;
CREATE POLICY "dev_lectura_publica" ON storage.objects
  FOR SELECT USING (bucket_id = 'productos');

DROP POLICY IF EXISTS "dev_subida" ON storage.objects;
CREATE POLICY "dev_subida" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'productos');

DROP POLICY IF EXISTS "dev_actualizacion" ON storage.objects;
CREATE POLICY "dev_actualizacion" ON storage.objects
  FOR UPDATE USING (bucket_id = 'productos');

-- =====================================================================
--  NOTA SOBRE RLS (Row Level Security)
--  Este script deja las tablas SIN RLS para poder desarrollar rapido.
--  Es aceptable en la base de DESARROLLO, pero NO en produccion.
--  Las politicas RLS por rol se disenan e implementan como parte del
--  trabajo de seguridad, antes de pasar cualquier cambio a produccion.
-- =====================================================================
