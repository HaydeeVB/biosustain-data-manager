-- 05_test_db.sql — construye la base de pruebas `biosustain_test`.
--
-- POR QUÉ: los tests corren contra una base real (no en memoria) para que las consultas SQL
-- se prueben de verdad. Esta base es desechable y NO debe apuntar nunca a producción:
-- `src/__tests__/setup-env.ts` aborta si el nombre no termina en "_test".
--
-- USO (una vez, y otra vez que cambie el esquema):
--   createdb  biosustain_test            # o: psql -c "CREATE DATABASE biosustain_test;"
--   psql -d biosustain_test -f scripts/05_test_db.sql
--   npm test
--
-- Diferencias con producción: Cloud SQL no soporta TimescaleDB, así que no hay hypertable
-- ni políticas de compresión. Todo lo demás es idéntico.

-- ── 1. Esquema base (01_schema.sql sin TimescaleDB) ────────────────────────────
-- BioSustain SaaS — Esquema de Base de Datos
-- TimescaleDB (PostgreSQL) — para el SaaS multi-tenant
--
-- Ejecutar en orden:
--   1. Este archivo (schema + hypertables)
--   2. compression_policies.sql
--   3. seed_demo.sql (opcional, datos de prueba)

-- ── Extensión TimescaleDB ─────────────────────────────────────────────────────

-- ── Tabla: clientes ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clientes (
    id VARCHAR(100) PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    empresa VARCHAR(200) DEFAULT '',
    telefono VARCHAR(50) DEFAULT '',
    plan VARCHAR(20) DEFAULT 'basico' CHECK (plan IN ('basico', 'pro', 'enterprise')),
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    activo BOOLEAN DEFAULT true
);

-- ── Tabla: cestas ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cestas (
    id VARCHAR(100) PRIMARY KEY,
    cliente_id VARCHAR(100) REFERENCES clientes(id),
    ubicacion VARCHAR(200) DEFAULT '',
    fecha_instalacion TIMESTAMPTZ DEFAULT NOW(),
    activa BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_cestas_cliente ON cestas(cliente_id);

-- ── Tabla: telemetria_cestas (Hypertable) ──────────────────────────────────────
-- Basada en el BOM del equipo BioSustain
CREATE TABLE IF NOT EXISTS telemetria_cestas (
    timestamp TIMESTAMPTZ NOT NULL,
    cesta_id VARCHAR(50) NOT NULL,
    planta_id VARCHAR(50) DEFAULT 'MARACAY-01',

    -- Variables de microclima y metabolismo
    temp_ambiente NUMERIC(4,2),
    humedad_relativa NUMERIC(4,2),
    temp_interna_sustrato NUMERIC(4,2),
    niveles_nh3_ppm NUMERIC(5,2),
    co2_ppm NUMERIC(5,2),
    peso_riel_kg NUMERIC(6,2),

    -- Variables de proceso
    degradacion_residuo_kg NUMERIC(6,2),
    biomasa_larvaria_estimada_kg NUMERIC(6,2),

    -- Estado de actuadores
    aspersor_activo BOOLEAN DEFAULT false,
    extractor_activo BOOLEAN DEFAULT false
);

-- Convertir a Hypertable (chunk cada 7 días)
-- Cloud SQL no tiene TimescaleDB: se omite create_hypertable.

-- Índice para consultas rápidas por cesta
CREATE INDEX IF NOT EXISTS idx_cesta_tiempo
ON telemetria_cestas (cesta_id, timestamp DESC);

-- ── Tabla: audit_log (para el Sandbox — click-wrap NDA, scraping detection) ───
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    cliente_id VARCHAR(100),
    accion VARCHAR(100) NOT NULL,
    endpoint VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    detalles JSONB
);

CREATE INDEX IF NOT EXISTS idx_audit_cliente ON audit_log(cliente_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp DESC);

-- ── Tabla: subscriptions (pagos) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
    id VARCHAR(100) PRIMARY KEY,
    cliente_id VARCHAR(100) REFERENCES clientes(id),
    plan VARCHAR(20) NOT NULL CHECK (plan IN ('basico', 'pro', 'enterprise')),
    estado VARCHAR(20) DEFAULT 'activa' CHECK (estado IN ('activa', 'suspendida', 'cancelada', 'pendiente')),
    provider VARCHAR(20) DEFAULT 'mock' CHECK (provider IN ('mercadopago', 'stripe', 'mock', 'usdt', 'zinli', 'ves')),
    provider_subscription_id VARCHAR(255),
    inicio TIMESTAMPTZ DEFAULT NOW(),
    fin TIMESTAMPTZ,
    monto_mensual NUMERIC(10,2),
    moneda VARCHAR(3) DEFAULT 'USD'
);

CREATE INDEX IF NOT EXISTS idx_subs_cliente ON subscriptions(cliente_id);

-- ── 2. Columnas añadidas después del esquema original ──────────────────────────
ALTER TABLE telemetria_cestas ADD COLUMN IF NOT EXISTS tds_ppm NUMERIC(7,2);
ALTER TABLE telemetria_cestas ADD COLUMN IF NOT EXISTS ph NUMERIC(4,2);
ALTER TABLE telemetria_cestas ALTER COLUMN co2_ppm TYPE NUMERIC(7,2);

-- ── 3. Tabla de llaves por nodo IoT (04_iot_devices.sql) ────────────────────────
-- ============================================================================
--  API keys por nodo IoT — esquema + compatibilidad hacia atrás
--  BioSustain / Bio Morphix C.A. · Prospyr 305 · 2026-09-26
-- ============================================================================
--
--  PROBLEMA QUE RESUELVE
--  ---------------------
--  Hasta hoy todos los nodos ESP32 compartían una sola clave (IOT_API_KEY),
--  así que compartían el mismo presupuesto de ingesta (el límite por
--  dispositivo de server.ts se cuenta por clave). Con una cesta no hay
--  problema; con varias, una puede agotar la cuota de las demás.
--
--  DISEÑO
--  ------
--  · Una fila por nodo en `iot_devices`: hash de la clave, no la clave.
--  · Se sigue aceptando la clave maestra (IOT_API_KEY) para no romper ningún
--    nodo ya instalado — marcada `es_maestra`.
--  · El rate limit pasa a contar por device_id (resuelto desde la clave),
--    que es lo que el comentario original de iot.ts quería decir.
--
--  Aplicar con:
--    psql "$DB" -f scripts/04_iot_devices.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS iot_devices (
    id              VARCHAR(100) PRIMARY KEY,           -- DEVICE_ID del firmware
    cesta_id        VARCHAR(50),                        -- cesta asignada (informativo)
    clave_hash      VARCHAR(128) NOT NULL UNIQUE,       -- sha256(clave) en hex
    descripcion     VARCHAR(200) DEFAULT '',
    es_maestra      BOOLEAN DEFAULT false,              -- clave compartida heredada
    activo          BOOLEAN DEFAULT true,
    creado_en       TIMESTAMPTZ DEFAULT NOW(),
    ultimo_uso      TIMESTAMPTZ                         -- se actualiza en cada ingesta
);

CREATE INDEX IF NOT EXISTS idx_iot_devices_hash
  ON iot_devices (clave_hash) WHERE activo = true;

-- ── Registrar la clave maestra existente (compatibilidad) ────────────────────
--  No se inserta aquí porque el valor vive en Secret Manager. Se hace desde el
--  backend al arrancar, o con el script scripts/register_master_key.sh.
--  Así ningún nodo ya instalado deja de funcionar tras el cambio.

-- ── Cómo emitir una clave por nodo ──────────────────────────────────────────
--  1. Generar:   openssl rand -hex 32
--  2. Calcular el hash:
--       python3 -c "import hashlib,sys;print(hashlib.sha256(sys.argv[1].encode()).hexdigest())" "<CLAVE>"
--  3. Insertar:
--       INSERT INTO iot_devices (id, cesta_id, clave_hash, descripcion)
--       VALUES ('BSF-NODE-ARAGUA-02', 'CESTA-02', '<HASH>', 'Nodo cesta 2');
--  4. Poner la clave (no el hash) en API_KEY del firmware de ESE nodo.
--
--  Consultar nodos registrados:
--    SELECT id, cesta_id, activo, ultimo_uso, descripcion FROM iot_devices ORDER BY creado_en;
--
--  Revocar un nodo perdido (sin afectar a los demás):
--    UPDATE iot_devices SET activo = false WHERE id = 'BSF-NODE-ARAGUA-02';


-- ── 4. Lotes (añadida con la función de registro de lotes) ─────────────────────
\restrict M9eChyqscwJ7vfauW7drBSyeID6yIaQDABBgyJo73QGhRpdSvKqCjx31ggI3UKS























CREATE TABLE IF NOT EXISTS public.lotes (
    id character varying(100) NOT NULL,
    cliente_id character varying(100),
    cesta_id character varying(100),
    tipo_residuo character varying(200) NOT NULL,
    peso_kg numeric(10,2) NOT NULL,
    tipo_sustrato character varying(100) DEFAULT 'Diana (36% verde)'::character varying,
    fecha_ingreso timestamp with time zone DEFAULT now(),
    fecha_proyeccion_cosecha timestamp with time zone,
    estado character varying(50) DEFAULT 'activo'::character varying,
    biomasa_estimada_kg numeric(10,2),
    co2e_reducido_kg numeric(10,2),
    categoria character varying(50) DEFAULT 'bsf'::character varying NOT NULL,
    unidad_principal character varying(100),
    residuo_tipo character varying(200),
    metano_evitado_kg numeric(10,2),
    frass_estimado_kg numeric(10,2),
    categoria_config jsonb
);






COMMENT ON COLUMN public.lotes.categoria IS 'Category of bioconversion: palma|ganado|platano|bsf';






ALTER TABLE ONLY public.lotes
    ADD CONSTRAINT lotes_pkey PRIMARY KEY (id);






CREATE INDEX idx_lotes_cesta ON public.lotes USING btree (cesta_id);






CREATE INDEX idx_lotes_cliente ON public.lotes USING btree (cliente_id);






ALTER TABLE ONLY public.lotes
    ADD CONSTRAINT lotes_cesta_id_fkey FOREIGN KEY (cesta_id) REFERENCES public.cestas(id);






ALTER TABLE ONLY public.lotes
    ADD CONSTRAINT lotes_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);






\unrestrict M9eChyqscwJ7vfauW7drBSyeID6yIaQDABBgyJo73QGhRpdSvKqCjx31ggI3UKS
