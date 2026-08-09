-- =====================================================================
--  MIGRACION 002 — Factura Electronica en Linea (FEL) Guatemala
--  Certificador: INFILE
--
--  IDEMPOTENTE: se puede ejecutar varias veces sin causar dano.
--  NO modifica ninguna tabla existente. Solo agrega tablas nuevas.
--  Por eso es seguro correrla en produccion sin afectar lo que ya opera.
--
--  Ejecutar en: Supabase -> SQL Editor -> New query -> Run
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. CONFIGURACION DEL EMISOR
--    Una sola fila. Reemplaza el patron de guardar config en archivos
--    JSON, que en Vercel no persiste (ver informe de auditoria).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fel_config (
    id                      INT PRIMARY KEY DEFAULT 1,

    -- Datos fiscales del emisor (los proporciona el cliente)
    nit_emisor              TEXT,
    nombre_emisor           TEXT,
    nombre_comercial        TEXT,
    direccion               TEXT,
    codigo_postal           TEXT    DEFAULT '01001',
    municipio               TEXT,
    departamento            TEXT,
    pais                    TEXT    DEFAULT 'GT',
    codigo_establecimiento  INT,
    afiliacion_iva          TEXT    DEFAULT 'GEN',   -- GEN = Regimen General

    -- Reglas de calculo. iva_incluido = TRUE significa que el precio
    -- que se muestra al cliente YA trae el IVA adentro (opcion elegida).
    iva_incluido            BOOLEAN DEFAULT TRUE,
    tasa_iva                NUMERIC DEFAULT 0.12,
    moneda                  TEXT    DEFAULT 'GTQ',

    -- Ambiente e integracion con INFILE
    ambiente                TEXT    DEFAULT 'pruebas',  -- 'pruebas' | 'produccion'
    infile_usuario          TEXT,
    infile_llave_firma      TEXT,
    infile_llave_token      TEXT,

    actualizado_en          TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT fel_config_fila_unica CHECK (id = 1),
    CONSTRAINT fel_config_ambiente   CHECK (ambiente IN ('pruebas','produccion'))
);

-- Crea la fila de configuracion vacia si aun no existe
INSERT INTO public.fel_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;


-- ---------------------------------------------------------------------
-- 2. DOCUMENTOS FEL
--    Un registro por cada DTE. Se mantiene SEPARADO de 'invoices' para
--    no alterar la tabla que ya usa el sistema en produccion.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fel_documentos (
    id                  TEXT PRIMARY KEY,
    invoice_id          TEXT NOT NULL,

    -- FACT = factura | FCAM = factura cambiaria (ventas al credito)
    -- NCRE = nota de credito | NDEB = nota de debito
    tipo_dte            TEXT NOT NULL DEFAULT 'FACT',

    -- pendiente  -> aun no se envia al certificador
    -- enviado    -> enviado, esperando respuesta
    -- certificado-> INFILE devolvio el numero de autorizacion (valido ante SAT)
    -- error      -> rechazado; revisar mensaje_error
    -- anulado    -> anulado ante SAT
    estado              TEXT NOT NULL DEFAULT 'pendiente',

    -- Respuesta del certificador
    numero_autorizacion TEXT,          -- UUID que asigna SAT via INFILE
    serie               TEXT,
    numero              TEXT,
    fecha_certificacion TIMESTAMPTZ,

    -- Montos (desglose exigido por FEL)
    monto_gravable      NUMERIC,       -- base sin IVA
    monto_iva           NUMERIC,       -- IVA (12%)
    gran_total          NUMERIC,       -- total con IVA = lo que paga el cliente

    -- Trazabilidad: guardar los XML es obligatorio para auditorias de SAT
    xml_enviado         TEXT,
    xml_certificado     TEXT,

    -- Control de reintentos y errores
    intentos            INT DEFAULT 0,
    mensaje_error       TEXT,

    -- Anulacion
    motivo_anulacion    TEXT,
    fecha_anulacion     TIMESTAMPTZ,

    creado_en           TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en      TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT fel_estado_valido CHECK (
        estado IN ('pendiente','enviado','certificado','error','anulado')
    ),
    CONSTRAINT fel_tipo_valido CHECK (
        tipo_dte IN ('FACT','FCAM','NCRE','NDEB','NABN','RDON')
    )
);

-- Una factura no puede tener dos DTE certificados del mismo tipo.
-- Evita doble certificacion por reintentos o dobles clics.
CREATE UNIQUE INDEX IF NOT EXISTS idx_fel_doc_unico_certificado
    ON public.fel_documentos (invoice_id, tipo_dte)
    WHERE estado = 'certificado';

CREATE INDEX IF NOT EXISTS idx_fel_invoice ON public.fel_documentos (invoice_id);
CREATE INDEX IF NOT EXISTS idx_fel_estado  ON public.fel_documentos (estado);
CREATE INDEX IF NOT EXISTS idx_fel_uuid    ON public.fel_documentos (numero_autorizacion);


-- ---------------------------------------------------------------------
-- 3. BITACORA DE COMUNICACION CON INFILE
--    Registro de cada llamada. Indispensable para diagnosticar rechazos
--    de SAT sin tener que reproducir el problema.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fel_bitacora (
    id              BIGSERIAL PRIMARY KEY,
    documento_id    TEXT,
    invoice_id      TEXT,
    operacion       TEXT,           -- 'certificar' | 'anular' | 'consultar'
    exito           BOOLEAN,
    codigo_respuesta TEXT,
    mensaje         TEXT,
    duracion_ms     INT,
    creado_en       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fel_bitacora_doc   ON public.fel_bitacora (documento_id);
CREATE INDEX IF NOT EXISTS idx_fel_bitacora_fecha ON public.fel_bitacora (creado_en DESC);


-- =====================================================================
--  FIN MIGRACION 002
--
--  Verificacion rapida (debe devolver 3 filas):
--    SELECT table_name FROM information_schema.tables
--    WHERE table_schema='public' AND table_name LIKE 'fel_%';
-- =====================================================================
