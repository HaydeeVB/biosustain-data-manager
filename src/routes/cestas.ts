/**
 * cestas.ts — Rutas de cestas con PostgreSQL.
 *
 * GET  /api/v1/cestas            → listar cestas del cliente
 * GET  /api/v1/cestas/:id        → detalle de una cesta
 * GET  /api/v1/cestas/:id/metrics → telemetría de una cesta
 */
import { Router, Request, Response } from 'express';
import { query, isDbConfigured } from '../db';

const router = Router();

// In-memory fallback
const cestasEnMemoria = new Map<string, any>();

router.get('/', async (req: Request, res: Response) => {
  const clienteId = (req as any).cliente?.clienteId;
  if (!clienteId) {
    res.status(401).json({ error: 'No autenticado.', code: 'NOT_AUTHENTICATED' });
    return;
  }

  if (isDbConfigured()) {
    try {
      const result = await query(
        `SELECT c.id, c.ubicacion, c.fecha_instalacion, c.activa,
                (SELECT t.temp_ambiente FROM telemetria_cestas t
                 WHERE t.cesta_id = c.id ORDER BY t.timestamp DESC LIMIT 1) AS ultima_temp,
                (SELECT t.humedad_relativa FROM telemetria_cestas t
                 WHERE t.cesta_id = c.id ORDER BY t.timestamp DESC LIMIT 1) AS ultima_humedad,
                (SELECT t.biomasa_larvaria_estimada_kg FROM telemetria_cestas t
                 WHERE t.cesta_id = c.id ORDER BY t.timestamp DESC LIMIT 1) AS ultima_biomasa
         FROM cestas c
         WHERE c.cliente_id = $1
         ORDER BY c.fecha_instalacion DESC`,
        [clienteId]
      );

      const cestas = result.rows.map((r: any) => ({
        id: r.id,
        ubicacion: r.ubicacion,
        estado: r.activa ? 'activa' : 'inactiva',
        fechaInstalacion: r.fecha_instalacion,
        ultimaTemp: r.ultima_temp ? parseFloat(r.ultima_temp) : null,
        ultimaHumedad: r.ultima_humedad ? parseFloat(r.ultima_humedad) : null,
        ultimaBiomasa: r.ultima_biomasa ? parseFloat(r.ultima_biomasa) : null,
      }));

      res.json({ cestas });
    } catch (err: any) {
      console.error('[CESTAS] List error:', err.message);
      res.status(500).json({ error: 'Error al obtener cestas.', code: 'DB_ERROR' });
    }
  } else {
    const cestas = Array.from(cestasEnMemoria.values()).filter(c => c.clienteId === clienteId);
    res.json({ cestas });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  const clienteId = (req as any).cliente?.clienteId;
  const cestaId = req.params.id as string;

  if (isDbConfigured()) {
    try {
      const result = await query(
        `SELECT c.* FROM cestas c WHERE c.id = $1 AND c.cliente_id = $2`,
        [cestaId, clienteId]
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Cesta no encontrada.', code: 'CESTA_NOT_FOUND' });
        return;
      }
      res.json({ cesta: result.rows[0] });
    } catch {
      res.status(500).json({ error: 'Error al obtener cesta.', code: 'DB_ERROR' });
    }
  } else {
    const cesta = cestasEnMemoria.get(cestaId);
    if (!cesta || cesta.clienteId !== clienteId) {
      res.status(404).json({ error: 'Cesta no encontrada.', code: 'CESTA_NOT_FOUND' });
      return;
    }
    res.json({ cesta });
  }
});

router.get('/:id/metrics', async (req: Request, res: Response) => {
  const clienteId = (req as any).cliente?.clienteId;
  const cestaId = req.params.id;
  const limit = Math.min(parseInt(String(req.query.limit) || '100'), 1000);

  if (isDbConfigured()) {
    try {
      // Verify ownership
      const ownership = await query(
        'SELECT id FROM cestas WHERE id = $1 AND cliente_id = $2',
        [cestaId, clienteId]
      );
      if (ownership.rows.length === 0) {
        res.status(404).json({ error: 'Cesta no encontrada.', code: 'CESTA_NOT_FOUND' });
        return;
      }

      const result = await query(
        `SELECT * FROM telemetria_cestas
         WHERE cesta_id = $1
         ORDER BY timestamp DESC
         LIMIT $2`,
        [cestaId, limit]
      );

      res.json({
        cestaId,
        total: result.rows.length,
        metrics: result.rows,
      });
    } catch {
      res.status(500).json({ error: 'Error al obtener telemetría.', code: 'DB_ERROR' });
    }
  } else {
    res.json({ cestaId, total: 0, metrics: [] });
  }
});

// Batch sparkline data — last 20 readings per cesta (for dashboard cards)
router.get('/sparklines/all', async (req: Request, res: Response) => {
  const clienteId = (req as any).cliente?.clienteId;
  if (!clienteId) {
    res.status(401).json({ error: 'No autenticado.', code: 'NOT_AUTHENTICATED' });
    return;
  }

  if (!isDbConfigured()) {
    res.json({ sparklines: {} });
    return;
  }

  try {
    const cestasResult = await query(
      'SELECT id FROM cestas WHERE cliente_id = $1',
      [clienteId]
    );

    const sparklines: Record<string, { temp: number[]; humedad: number[]; biomasa: number[] }> = {};

    for (const cesta of cestasResult.rows) {
      const result = await query(
        `SELECT temp_ambiente, humedad_relativa, biomasa_larvaria_estimada_kg
         FROM telemetria_cestas
         WHERE cesta_id = $1
         ORDER BY timestamp DESC
         LIMIT 20`,
        [cesta.id]
      );
      // Reverse so oldest is first (left to right)
      const rows = result.rows.reverse();
      sparklines[cesta.id] = {
        temp: rows.map((r: any) => parseFloat(r.temp_ambiente || 0)),
        humedad: rows.map((r: any) => parseFloat(r.humedad_relativa || 0)),
        biomasa: rows.map((r: any) => parseFloat(r.biomasa_larvaria_estimada_kg || 0)),
      };
    }

    res.json({ sparklines });
  } catch {
    res.status(500).json({ error: 'Error al obtener sparklines.', code: 'DB_ERROR' });
  }
});

export default router;