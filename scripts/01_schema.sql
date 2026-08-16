-- BioSustain SaaS — Esquema de Base de Datos
-- TimescaleDB (PostgreSQL) — para el SaaS multi-tenant
--
-- Ejecutar en orden:
--   1. Este archivo (schema + hypertables)
--   2. compression_policies.sql
--   3. seed_demo.sql (opcional, datos de prueba)

-- ── Extensión TimescaleDB ─────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

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
SELECT create_hypertable('telemetria_cestas', 'timestamp',
    chunk_time_interval => INTERVAL '7 days',
    if_not_exists => true
);

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