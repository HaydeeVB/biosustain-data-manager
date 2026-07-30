/**
 * cestas.ts — Rutas de cestas (multi-tenant).
 *
 * Cada cliente solo ve sus propias cestas.
 * GET  /api/v1/cestas            → listar cestas del cliente
 * GET  /api/v1/cestas/:id        → detalle de una cesta
 * GET  /api/v1/cestas/:id/metrics → telemetría de una cesta
 */
import { Router, Request, Response } from 'express';
import { query, isDbConfigured } from '../db';

const router = Router();

// ── Almacenamiento en memoria (modo demo) ─────────────────────────────────────

interface Cesta {
  id: string;
  clienteId: string;
  ubicacion: string;
  fechaInstalacion: string;
  activa: boolean;
}

const cestasEnMemoria: Map<string, Cesta> = new Map();

// ── Endpoints ──────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/cestas
 * Lista las cestas del cliente autenticado.
 */
router.get('/', (req: Request, res: Response) => {
  const clienteId = req.cliente?.clienteId;
  if (!clienteId) {
    res.status(401).json({ error: 'No autenticado.', code: 'NOT_AUTHENTICATED' });
    return;
  }

  // Filtrar cestas del cliente
  const cestas = Array.from(cestasEnMemoria.values())
    .filter(c => c.clienteId === clienteId)
    .map(c => ({
      id: c.id, ubicacion: c.ubicacion,
      fechaInstalacion: c.fechaInstalacion, activa: c.activa,
    }));

  res.json({ cestas, total: cestas.length });
});

/**
 * GET /api/v1/cestas/:id
 * Devuelve el detalle de una cesta específica.
 * Verifica que la cesta pertenezca al cliente.
 */
router.get('/:id', (req: Request, res: Response) => {
  const clienteId = req.cliente?.clienteId;
  if (!clienteId) {
    res.status(401).json({ error: 'No autenticado.', code: 'NOT_AUTHENTICATED' });
    return;
  }

  const cestaId = req.params.id as string;
  const cesta = cestasEnMemoria.get(cestaId);
  if (!cesta) {
    res.status(404).json({ error: 'Cesta no encontrada.', code: 'CESTA_NOT_FOUND' });
    return;
  }

  // Multi-tenant: verificar propiedad
  if (cesta.clienteId !== clienteId) {
    res.status(403).json({ error: 'No tiene acceso a esta cesta.', code: 'FORBIDDEN' });
    return;
  }

  res.json(cesta);
});

/**
 * GET /api/v1/cestas/:id/metrics
 * Devuelve la telemetría más reciente de una cesta.
 * Verifica que la cesta pertenezca al cliente.
 */
router.get('/:id/metrics', async (req: Request, res: Response) => {
  const clienteId = req.cliente?.clienteId;
  if (!clienteId) {
    res.status(401).json({ error: 'No autenticado.', code: 'NOT_AUTHENTICATED' });
    return;
  }

  const cestaIdMetric = req.params.id as string;
  const cesta = cestasEnMemoria.get(cestaIdMetric);
  if (!cesta) {
    res.status(404).json({ error: 'Cesta no encontrada.', code: 'CESTA_NOT_FOUND' });
    return;
  }

  if (cesta.clienteId !== clienteId) {
    res.status(403).json({ error: 'No tiene acceso a esta cesta.', code: 'FORBIDDEN' });
    return;
  }

  // Si hay DB, consultar telemetría real
  if (isDbConfigured()) {
    try {
      const limit = Math.min(parseInt(String(req.query.limit) || '100'), 1000);
      const result = await query(
        `SELECT * FROM telemetria_cestas
         WHERE cesta_id = $1
         ORDER BY timestamp DESC
         LIMIT $2`,
        [req.params.id, limit]
      );
      res.json({
        cestaId: req.params.id,
        metrics: result.rows,
        total: result.rowCount,
      });
      return;
    } catch (err) {
      console.error('[CESTAS] Error consultando DB:', err);
      res.status(500).json({ error: 'Error consultando telemetría.', code: 'DB_ERROR' });
      return;
    }
  }

  // Modo demo: datos simulados
  res.json({
    cestaId: req.params.id,
    metrics: [],
    total: 0,
    nota: 'Modo demo — sin base de datos configurada.',
  });
});

export default router;