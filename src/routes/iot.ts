/**
 * iot.ts — Ingesta de datos IoT desde ESP32.
 *
 * POST /api/v1/iot/metrics → recibe telemetría de los sensores
 *
 * Autenticación: API key en header X-API-Key (no JWT — para ESP32)
 * Rate limiting: 1 request por 10 segundos por dispositivo
 *
 * Estructura JSON esperada (del BOM):
 * {
 *   "device_id": "BSF-NODE-ARAGUA-01",
 *   "timestamp": "2026-07-01T12:05:00Z",
 *   "cesta_id": "CESTA-04",
 *   "sensores": {
 *     "humedad_sustrato_pct": 65.4,
 *     "temperatura_sustrato_c": 28.2,
 *     "amoniaco_ppm": 12.5,
 *     "co2_ppm": 450.0,
 *     "peso_riel_kg": 42.85
 *   },
 *   "actuadores": {
 *     "aspersor_auto_status": 0,
 *     "ventilacion_status": 1
 *   }
 * }
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateApiKey } from '../middleware/auth';
import { query, isDbConfigured } from '../db';

const router = Router();

// ── Esquema de validación (del BOM del equipo) ────────────────────────────────

const metricSchema = z.object({
  device_id: z.string().min(1).max(50),
  timestamp: z.string().datetime().optional(),
  cesta_id: z.string().min(1).max(50),
  sensores: z.object({
    humedad_sustrato_pct: z.number().min(0).max(100).optional(),
    temperatura_sustrato_c: z.number().min(-20).max(60).optional(),
    amoniaco_ppm: z.number().min(0).max(500).optional(),
    co2_ppm: z.number().min(0).max(5000).optional(),
    peso_riel_kg: z.number().min(0).max(100).optional(),
  }),
  actuadores: z.object({
    aspersor_auto_status: z.number().int().min(0).max(1).optional(),
    ventilacion_status: z.number().int().min(0).max(1).optional(),
  }).optional(),
});

// ── Umbrales biológicos (del backend existente en Cloud Run) ──────────────────

const evaluateBioreactorMetrics = (temp: number | undefined, humidity: number | undefined) => {
  let triggerSprinkler = false;
  let analysisMessage = 'Parámetros estables dentro del rango óptimo.';

  if (temp !== undefined && temp > 32.0) {
    triggerSprinkler = true;
    analysisMessage = 'Variación térmica detectada (Exceso de temperatura). Se sugiere activar el aspersor por 45 segundos.';
  } else if (humidity !== undefined && humidity < 50.0) {
    triggerSprinkler = true;
    analysisMessage = 'Humedad crítica detectada. Activación preventiva del aspersor.';
  }

  return { trigger_sprinkler: triggerSprinkler, message: analysisMessage };
};

// ── Endpoint ──────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/iot/metrics
 * Recibe telemetría de un ESP32 y la almacena en TimescaleDB.
 * Devuelve decisión de control del aspersor (compatibilidad con firmware existente).
 */
router.post('/metrics', authenticateApiKey, async (req: Request, res: Response) => {
  const parseResult = metricSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Payload inválido.',
      detalles: parseResult.error.flatten().fieldErrors,
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  const data = parseResult.data;
  const ts = data.timestamp || new Date().toISOString();

  // Evaluar umbrales biológicos (misma lógica del backend existente)
  const evaluation = evaluateBioreactorMetrics(
    data.sensores.temperatura_sustrato_c,
    data.sensores.humedad_sustrato_pct,
  );

  // Si hay DB, almacenar telemetría
  if (isDbConfigured()) {
    try {
      await query(
        `INSERT INTO telemetria_cestas
         (timestamp, cesta_id, planta_id, temp_ambiente, humedad_relativa,
          temp_interna_sustrato, niveles_nh3_ppm, degradacion_residuo_kg,
          biomasa_larvaria_estimada_kg, aspersor_activo, extractor_activo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          ts,
          data.cesta_id,
          data.device_id,
          data.sensores.temperatura_sustrato_c,
          data.sensores.humedad_sustrato_pct,
          data.sensores.temperatura_sustrato_c,
          data.sensores.amoniaco_ppm,
          null, // degradacion_residuo_kg — se calcula luego
          null, // biomasa_larvaria_estimada_kg — se calcula luego
          data.actuadores?.aspersor_auto_status === 1,
          data.actuadores?.ventilacion_status === 1,
        ]
      );
    } catch (err) {
      console.error('[IoT] Error guardando en DB:', err);
      // No fallar el request — el ESP32 necesita la respuesta de control
    }
  }

  // Responder con decisión de control (formato compatible con firmware existente)
  res.json({
    status: 'success',
    received_data: data,
    ...evaluation,
    timestamp: ts,
  });
});

export default router;