-- BioSustain SaaS — Políticas de Compresión y Retención
-- Ejecutar después de 01_schema.sql

-- Compresión: datos > 14 días se comprimen (90% reducción de costos)
ALTER TABLE telemetria_cestas SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'cesta_id, planta_id',
    timescaledb.compress_orderby = 'timestamp DESC'
);

SELECT add_compression_policy('telemetria_cestas', INTERVAL '14 days');

-- Retención: datos > 365 días se eliminan (después de backup a S3)
SELECT add_retention_policy('telemetria_cestas', INTERVAL '365 days');