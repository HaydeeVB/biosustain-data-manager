-- BioSustain SaaS — Datos de Prueba (Opcional)
-- Ejecutar después de 01_schema.sql y 02_compression_policies.sql

-- Cliente de prueba
INSERT INTO clientes (id, nombre, email, password_hash, empresa, telefono, plan)
VALUES (
    'cli_demo_001',
    'Productor Demo Aragua',
    'demo@biosustain.com',
    '$2a$10$examplehashreplacewithreal',
    'Granja Demo C.A.',
    '+58 414 1234567',
    'pro'
) ON CONFLICT (id) DO NOTHING;

-- Cestas de prueba
INSERT INTO cestas (id, cliente_id, ubicacion)
VALUES
    ('CESTA-01', 'cli_demo_001', 'Nave Principal - Aragua'),
    ('CESTA-02', 'cli_demo_001', 'Nave Principal - Aragua'),
    ('CESTA-03', 'cli_demo_001', 'Galpón Secundario - Maracay'),
    ('CESTA-04', 'cli_demo_001', 'Laboratorio I+D - Palo Negro')
ON CONFLICT (id) DO NOTHING;

-- Telemetría de muestra (últimas 24 horas, cada 30 min)
INSERT INTO telemetria_cestas (timestamp, cesta_id, planta_id, temp_ambiente, humedad_relativa, temp_interna_sustrato, niveles_nh3_ppm, peso_riel_kg, aspersor_activo, extractor_activo)
SELECT
    NOW() - (n * INTERVAL '30 minutes'),
    'CESTA-01',
    'MARACAY-01',
    28.5 + (random() * 4 - 2),
    65.0 + (random() * 10 - 5),
    28.0 + (random() * 3 - 1.5),
    10.0 + (random() * 5),
    42.0 + (random() * 3),
    false,
    true
FROM generate_series(1, 48) AS n;