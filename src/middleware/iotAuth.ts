/**
 * iotAuth.ts — Autenticación de dispositivos IoT (ESP32) con clave POR NODO.
 *
 * ANTES (hasta 2026-09-26): una sola IOT_API_KEY compartida por todos los nodos.
 * Consecuencia: el límite de ingesta se contaba por clave, así que varias cestas
 * compartían el mismo presupuesto y una podía dejar mudas a las demás.
 *
 * AHORA: se aceptan dos tipos de clave.
 *   1. Clave POR NODO — registrada en la tabla `iot_devices` (se guarda el
 *      sha256, nunca la clave). Permite revocar un nodo sin tocar los demás.
 *   2. Clave MAESTRA (IOT_API_KEY, la de Secret Manager) — se sigue aceptando
 *      para no romper ningún nodo ya instalado. Marcada es_maestra = true.
 *
 * Resuelve además req.iotDeviceId, que el limitador usa para contar por
 * dispositivo en lugar de por IP (varias cestas comparten router en la planta).
 */
import { Request, Response, NextFunction } from 'express';
import { createHash, timingSafeEqual } from 'crypto';
import { query, isDbConfigured } from '../db';

declare global {
  namespace Express {
    interface Request {
      iotDeviceId?: string;
      iotEsMaestra?: boolean;
    }
  }
}

function sha256(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

/** Comparación en tiempo constante para no filtrar información por timing. */
function igualSeguro(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export async function authenticateIotDevice(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const apiKey = (req.headers['x-api-key'] as string | undefined)?.trim();
  const masterKey = process.env.IOT_API_KEY || '';

  // Fail closed — sin ninguna clave configurada no hay acceso abierto.
  // (Se permite si la DB tiene nodos registrados, aunque no haya maestra.)
  if (!masterKey && !isDbConfigured()) {
    res.status(503).json({
      error: 'Servicio IoT no configurado. Contacte al administrador.',
      code: 'IOT_NOT_CONFIGURED',
    });
    return;
  }

  if (!apiKey) {
    res.status(401).json({
      error: 'API key requerida en header X-API-Key.',
      code: 'NO_API_KEY',
    });
    return;
  }

  // 1) Clave maestra (compartida, heredada) — siempre válida si coincide.
  if (masterKey && igualSeguro(apiKey, masterKey)) {
    req.iotEsMaestra = true;
    // El device_id viene en el cuerpo; se usa para el conteo del limitador.
    req.iotDeviceId = (req.body?.device_id as string) || 'maestra-desconocido';
    next();
    return;
  }

  // 2) Clave por nodo — se busca por hash.
  if (isDbConfigured()) {
    try {
      const hash = sha256(apiKey);
      const result = await query(
        `SELECT id FROM iot_devices
          WHERE clave_hash = $1 AND activo = true
          LIMIT 1`,
        [hash],
      );

      if (result.rows.length > 0) {
        const deviceId = result.rows[0].id as string;
        req.iotDeviceId = deviceId;
        req.iotEsMaestra = false;

        // Marcar último uso sin bloquear la ingesta si falla.
        query('UPDATE iot_devices SET ultimo_uso = NOW() WHERE id = $1', [deviceId])
          .catch((e) => console.error('[IoT] No se pudo actualizar ultimo_uso:', e.message));

        next();
        return;
      }
    } catch (err: any) {
      // Si la tabla aún no existe (migración no aplicada), no bloquear:
      // se cae al comportamiento anterior (solo clave maestra).
      console.error('[IoT] Error consultando iot_devices:', err.message);
    }
  }

  res.status(401).json({
    error: 'API key inválida o nodo desactivado.',
    code: 'INVALID_API_KEY',
  });
}
