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

