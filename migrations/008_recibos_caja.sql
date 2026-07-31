-- Migración 008: Tabla recibos_caja para Módulo de Recibos de Caja Agricovet
-- Documentos Contables Permanentes (Solo Creación y Lectura)

CREATE TABLE IF NOT EXISTS public.recibos_caja (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio VARCHAR(50) NOT NULL,
  numero_secuencial SERIAL,
  fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cliente_nombre TEXT NOT NULL,
  cliente_nit VARCHAR(50) DEFAULT 'CF',
  cliente_codigo VARCHAR(50) DEFAULT '',
  cantidad_letras TEXT NOT NULL,
  facturas JSONB DEFAULT '[]'::jsonb,
  cheques JSONB DEFAULT '[]'::jsonb,
  efectivo_total NUMERIC(12, 2) DEFAULT 0.00,
  monto_total NUMERIC(12, 2) DEFAULT 0.00,
  observaciones TEXT DEFAULT '',
  cajero_nombre TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS con políticas de lectura e inserción pública
ALTER TABLE public.recibos_caja ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'recibos_caja' AND policyname = 'Permitir lectura publica recibos_caja'
  ) THEN
    CREATE POLICY "Permitir lectura publica recibos_caja" ON public.recibos_caja FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'recibos_caja' AND policyname = 'Permitir insercion publica recibos_caja'
  ) THEN
    CREATE POLICY "Permitir insercion publica recibos_caja" ON public.recibos_caja FOR INSERT WITH CHECK (true);
  END IF;
END $$;
