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
