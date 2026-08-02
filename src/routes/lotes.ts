/**
 * lotes.ts — Registro manual de lotes orgánicos.
 *
 * POST /api/v1/lotes           → registrar nuevo lote (manual data entry)
 * GET  /api/v1/lotes           → listar lotes del cliente
 * GET  /api/v1/lotes/:id       → detalle de un lote
 * DELETE /api/v1/lotes/:id     → eliminar lote
 *
 * El usuario ingresa: tipo de residuo, peso (kg), tipo de sustrato.
 * El sistema calcula: proyección de cosecha, biomasa estimada, CO2e reducido.
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query, isDbConfigured } from '../db';

const router = Router();

const loteSchema = z.object({
  cestaId: z.string().min(1),
  tipoResiduo: z.string().min(2),
  pesoKg: z.number().positive(),
  tipoSustrato: z.string().optional().default('Diana (36% verde)'),
});

// ── POST: Register a new lote ──────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
  const clienteId = (req as any).cliente?.clienteId;
  if (!clienteId) {
    res.status(401).json({ error: 'No autenticado.', code: 'NOT_AUTHENTICATED' });
    return;
  }

  const parse = loteSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({
      error: 'Datos del lote inválidos.',
      detalles: parse.error.flatten().fieldErrors,
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  const { cestaId, tipoResiduo, pesoKg, tipoSustrato } = parse.data;

  if (!isDbConfigured()) {
    res.status(503).json({ error: 'Base de datos no configurada.', code: 'DB_ERROR' });
    return;
  }

  try {
    // Verify cesta belongs to client
    const cestaCheck = await query(
      'SELECT id FROM cestas WHERE id = $1 AND cliente_id = $2',
      [cestaId, clienteId]
    );
    if (cestaCheck.rows.length === 0) {
      res.status(404).json({ error: 'Cesta no encontrada.', code: 'CESTA_NOT_FOUND' });
      return;
    }

    const loteId = `lote_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // Verhulst projection: ~14 day cycle, biomass ≈ peso * 0.18 (FCR)
    // CO2e: each kg of waste avoids ~0.5 kg CO2e from landfill methane
    const biomasaEstimada = +(pesoKg * 0.18).toFixed(2);
    const co2eReducido = +(pesoKg * 0.5).toFixed(2);
    const fechaCosecha = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days

    await query(
      `INSERT INTO lotes (id, cliente_id, cesta_id, tipo_residuo, peso_kg, tipo_sustrato, fecha_proyeccion_cosecha, biomasa_estimada_kg, co2e_reducido_kg, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'activo')`,
      [loteId, clienteId, cestaId, tipoResiduo, pesoKg, tipoSustrato, fechaCosecha, biomasaEstimada, co2eReducido]
    );

    res.status(201).json({
      lote: {
        id: loteId,
        cestaId,
        tipoResiduo,
        pesoKg,
        tipoSustrato,
        fechaIngreso: new Date().toISOString(),
        fechaProyeccionCosecha: fechaCosecha.toISOString(),
        biomasaEstimadaKg: biomasaEstimada,
        co2eReducidoKg: co2eReducido,
        estado: 'activo',
      },
    });
  } catch (err: any) {
    console.error('[LOTES] Create error:', err.message);
    res.status(500).json({ error: 'Error al registrar lote.', code: 'DB_ERROR' });
  }
});

// ── GET: List lotes ─────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  const clienteId = (req as any).cliente?.clienteId;
  if (!clienteId) {
    res.status(401).json({ error: 'No autenticado.', code: 'NOT_AUTHENTICATED' });
    return;
  }

  if (!isDbConfigured()) {
    res.json({ lotes: [] });
    return;
  }

  try {
    const result = await query(
      `SELECT l.*, c.ubicacion as cesta_ubicacion
       FROM lotes l
       JOIN cestas c ON l.cesta_id = c.id
       WHERE l.cliente_id = $1
       ORDER BY l.fecha_ingreso DESC`,
      [clienteId]
    );

    const lotes = result.rows.map((r: any) => ({
      id: r.id,
      cestaId: r.cesta_id,
      cestaUbicacion: r.cesta_ubicacion,
      tipoResiduo: r.tipo_residuo,
      pesoKg: parseFloat(r.peso_kg),
      tipoSustrato: r.tipo_sustrato,
      fechaIngreso: r.fecha_ingreso,
      fechaProyeccionCosecha: r.fecha_proyeccion_cosecha,
      biomasaEstimadaKg: parseFloat(r.biomasa_estimada_kg),
      co2eReducidoKg: parseFloat(r.co2e_reducido_kg),
      estado: r.estado,
    }));

    res.json({ lotes, total: lotes.length });
  } catch (err: any) {
    console.error('[LOTES] List error:', err.message);
    res.status(500).json({ error: 'Error al obtener lotes.', code: 'DB_ERROR' });
  }
});

// ── GET: Lote detail ────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  const clienteId = (req as any).cliente?.clienteId;
  const loteId = req.params.id as string;

  if (!isDbConfigured()) {
    res.status(404).json({ error: 'Lote no encontrado.', code: 'NOT_FOUND' });
    return;
  }

  try {
    const result = await query(
      `SELECT l.*, c.ubicacion as cesta_ubicacion
       FROM lotes l JOIN cestas c ON l.cesta_id = c.id
       WHERE l.id = $1 AND l.cliente_id = $2`,
      [loteId, clienteId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Lote no encontrado.', code: 'NOT_FOUND' });
      return;
    }
    res.json({ lote: result.rows[0] });
  } catch {
    res.status(500).json({ error: 'Error al obtener lote.', code: 'DB_ERROR' });
  }
});

// ── DELETE: Delete lote ─────────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response) => {
  const clienteId = (req as any).cliente?.clienteId;
  const loteId = req.params.id as string;

  if (!isDbConfigured()) {
    res.status(404).json({ error: 'Lote no encontrado.', code: 'NOT_FOUND' });
    return;
  }

  try {
    const result = await query(
      'DELETE FROM lotes WHERE id = $1 AND cliente_id = $2 RETURNING id',
      [loteId, clienteId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Lote no encontrado.', code: 'NOT_FOUND' });
      return;
    }
    res.json({ deleted: true, id: loteId });
  } catch {
    res.status(500).json({ error: 'Error al eliminar lote.', code: 'DB_ERROR' });
  }
});

export default router;