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
import { authenticateIotDevice } from '../middleware/iotAuth';
import { query, isDbConfigured } from '../db';

const router = Router();

// ── Esquema de validación (del BOM del equipo) ────────────────────────────────

const metricSchema = z.object({
  device_id: z.string().min(1).max(50),
  timestamp: z.string().datetime().optional(),
  cesta_id: z.string().min(1).max(50),
  sensores: z.object({
    // coerce: los firmwares suelen mandar números como texto ("742.5"). Rechazarlos por
    // eso obliga a recompilar el nodo por un detalle de comillas.
    humedad_sustrato_pct: z.coerce.number().min(0).max(100).optional(),
    temperatura_sustrato_c: z.coerce.number().min(-20).max(60).optional(),
    amoniaco_ppm: z.coerce.number().min(0).max(500).optional(),
    co2_ppm: z.coerce.number().min(0).max(5000).optional(),
    peso_riel_kg: z.coerce.number().min(0).max(100).optional(),
    // Sensores del nodo de campo (2026-10-24): TDS y pH del lixiviado.
    tds_ppm: z.coerce.number().min(0).max(10000).optional(),
    ph: z.coerce.number().min(0).max(14).optional(),
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

// ── Normalización de payloads de firmware ─────────────────────────────────────
//
// El contrato canónico es anidado: { device_id, cesta_id, sensores:{...} }.
// En la práctica cada nodo se graba con los nombres que el técnico eligió, y pelear con
// eso cuesta una ronda de ida y vuelta por cada despliegue. Se aceptan alias planos en
// español (cesta, nodo, tds, ph, peso, co2, temp, humedad, amoniaco) y se traducen al
// contrato interno. El firmware del nodo de campo CESTA-RURAL-01 usa esos nombres.
const ALIAS_SENSORES: Record<string, keyof z.infer<typeof metricSchema>['sensores']> = {
  tds: 'tds_ppm',
  solidos_totales: 'tds_ppm',
  ph: 'ph',
  peso: 'peso_riel_kg',
  peso_kg: 'peso_riel_kg',
  co2: 'co2_ppm',
  temperatura: 'temperatura_sustrato_c',
  temp: 'temperatura_sustrato_c',
  humedad: 'humedad_sustrato_pct',
  amoniaco: 'amoniaco_ppm',
};

function normalizarPayload(body: any): any {
  if (!body || typeof body !== 'object') return body;
  // Si ya viene en el formato canónico, no se toca.
  if (body.sensores && typeof body.sensores === 'object') {
    return {
      ...body,
      device_id: body.device_id ?? body.nodo ?? body.deviceId,
      cesta_id: body.cesta_id ?? body.cesta ?? body.cestaId,
    };
  }

  const sensores: Record<string, unknown> = {};
  const sobrantes: string[] = [];
  const reservados = new Set(['device_id', 'cesta_id', 'nodo', 'cesta', 'timestamp',
                              'actuadores', 'deviceId', 'cestaId']);

  for (const [clave, valor] of Object.entries(body)) {
    if (reservados.has(clave)) continue;
    const destino = ALIAS_SENSORES[clave.toLowerCase()];
    if (destino) sensores[destino] = valor;
    else sobrantes.push(clave);
  }

  const normalizado: any = {
    device_id: body.device_id ?? body.nodo ?? body.deviceId,
    cesta_id: body.cesta_id ?? body.cesta ?? body.cestaId,
    sensores,
    actuadores: body.actuadores,
    timestamp: body.timestamp,
  };
  if (sobrantes.length) {
    // Se devuelve al cliente para que un nombre mal escrito no se pierda en silencio.
    normalizado.campos_ignorados = sobrantes;
  }
  return normalizado;
}

// ── Endpoint ──────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/iot/metrics
 * Recibe telemetría de un ESP32 y la almacena en TimescaleDB.
 * Devuelve decisión de control del aspersor (compatibilidad con firmware existente).
 */
router.post('/metrics', authenticateIotDevice, async (req: Request, res: Response) => {
  const normalizado = normalizarPayload(req.body);
  const parseResult = metricSchema.safeParse(normalizado);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Payload inválido.',
      detalles: parseResult.error.flatten().fieldErrors,
      // Nombres recibidos: si el firmware usa un alias no reconocido, se ve aquí en vez
      // de perderse en un 400 genérico.
      campos_recibidos: Object.keys(req.body || {}),
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
  let persistido = false;
  if (isDbConfigured()) {
    try {
      await query(
        `INSERT INTO telemetria_cestas
         (timestamp, cesta_id, planta_id, temp_ambiente, humedad_relativa,
          temp_interna_sustrato, niveles_nh3_ppm, co2_ppm, peso_riel_kg,
          tds_ppm, ph,
          degradacion_residuo_kg, biomasa_larvaria_estimada_kg,
          aspersor_activo, extractor_activo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          ts,
          data.cesta_id,
          data.device_id,
          data.sensores.temperatura_sustrato_c,
          data.sensores.humedad_sustrato_pct,
          data.sensores.temperatura_sustrato_c,
          data.sensores.amoniaco_ppm,
          data.sensores.co2_ppm,
          data.sensores.peso_riel_kg ?? null,
          data.sensores.tds_ppm ?? null,
          data.sensores.ph ?? null,
          null, // degradacion_residuo_kg — se calcula luego
          null, // biomasa_larvaria_estimada_kg — se calcula luego
          data.actuadores?.aspersor_auto_status === 1,
          data.actuadores?.ventilacion_status === 1,
        ]
      );
      persistido = true;
    } catch (err) {
      console.error('[IoT] Error guardando en DB:', err);
      // No fallar el request — el ESP32 necesita la respuesta de control
    }
  }

  // Responder con decisión de control (formato compatible con firmware existente)
  res.json({
    status: 'success',
    persistido,
    ...(normalizado?.campos_ignorados?.length
      ? { campos_ignorados: normalizado.campos_ignorados }
      : {}),
    received_data: data,
    ...evaluation,
    timestamp: ts,
  });
});

export default router;