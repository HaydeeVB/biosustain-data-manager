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
import { getCategoria, CATEGORIAS, type CategoriaId, type Categoria } from '../lib/categorias';

const router = Router();

// Category-aware lot schema. `categoria` drives dynamic units, params, and ESG calcs.
const loteSchema = z.object({
  cestaId: z.string().min(1).optional(),   // optional: BSF legacy nests under cestas
  categoria: z.enum(['plantas', 'ganado', 'larvas']).default('plantas'),
  tipoResiduo: z.string().min(2),
  pesoKg: z.number().positive(),
  unidadPrincipal: z.string().optional(),
  tipoSustrato: z.string().optional().default('Diana (36% verde)'),
  residuoTipo: z.string().optional(),
});

/** Apply category-specific ESG + projection factors to a lot. */
function calcForCategoria(cat: Categoria, pesoKg: number) {
  const e = cat.esg;
  return {
    biomasaEstimada: +(pesoKg * e.biomassFactor).toFixed(2),
    co2eReducido: +(pesoKg * e.co2eFactor).toFixed(2),
    metanoEvitado: +(pesoKg * e.methaneFactor).toFixed(2),
    frassEstimado: +(pesoKg * e.biomassFactor * 0.4).toFixed(2),
    fechaCosecha: new Date(Date.now() + e.harvestDays * 24 * 60 * 60 * 1000),
  };
}

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

  const { cestaId, categoria, tipoResiduo, pesoKg, unidadPrincipal, tipoSustrato, residuoTipo } = parse.data;

  if (!isDbConfigured()) {
    res.status(503).json({ error: 'Base de datos no configurada.', code: 'DB_ERROR' });
    return;
  }

  try {
    // Non-larval categories don't hang off a cesta; BSF legacy does.
    // Verify cesta belongs to client when one is provided.
    if (cestaId) {
      const cestaCheck = await query(
        'SELECT id FROM cestas WHERE id = $1 AND cliente_id = $2',
        [cestaId, clienteId]
      );
      if (cestaCheck.rows.length === 0) {
        res.status(404).json({ error: 'Cesta no encontrada.', code: 'CESTA_NOT_FOUND' });
        return;
      }
    }

    const cat = getCategoria(categoria);
    const calc = calcForCategoria(cat, pesoKg);
    const loteId = `lote_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const unidad = unidadPrincipal || cat.defaultUnit;

    await query(
      `INSERT INTO lotes
        (id, cliente_id, cesta_id, categoria, tipo_residuo, peso_kg, unidad_principal, tipo_sustrato, residuo_tipo,
         fecha_proyeccion_cosecha, biomasa_estimada_kg, co2e_reducido_kg, metano_evitado_kg, frass_estimado_kg, estado, categoria_config)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'activo', $15::jsonb)`,
      [loteId, clienteId, cestaId || null, categoria, tipoResiduo, pesoKg, unidad, tipoSustrato, residuoTipo || tipoResiduo,
       calc.fechaCosecha, calc.biomasaEstimada, calc.co2eReducido, calc.metanoEvitado, calc.frassEstimado,
       JSON.stringify({ cesta: cestaId || null, unidad, monitoring: cat.monitored.map(m => m.key), factors: cat.esg })]
    );

    res.status(201).json({
      lote: {
        id: loteId,
        categoria,
        cestaId: cestaId || null,
        tipoResiduo,
        pesoKg,
        unidadPrincipal: unidad,
        tipoSustrato,
        residuoTipo: residuoTipo || tipoResiduo,
        fechaIngreso: new Date().toISOString(),
        fechaProyeccionCosecha: calc.fechaCosecha.toISOString(),
        biomasaEstimadaKg: calc.biomasaEstimada,
        co2eReducidoKg: calc.co2eReducido,
        metanoEvitadoKg: calc.metanoEvitado,
        frassEstimadoKg: calc.frassEstimado,
        monitoringParams: cat.monitored.map(m => ({ key: m.key, label: m.label, unit: m.unit })),
        estado: 'activo',
      },
    });
  } catch (err: any) {
    console.error('[LOTES] Create error:', err.message);
    res.status(500).json({ error: 'Error al registrar lote.', code: 'DB_ERROR' });
  }
});

// ── GET: Category config (drives dynamic units/params/thresholds in the UI) ──
router.get('/categorias', async (_req: Request, res: Response) => {
  res.json({
    categorias: Object.values(CATEGORIAS).map((c) => ({
      id: c.id,
      nombre: c.nombre,
      nombreEn: c.nombreEn,
      icon: c.icon,
      wasteInputs: c.wasteInputs,
      primaryUnits: c.primaryUnits,
      defaultUnit: c.defaultUnit,
      monitored: c.monitored.map((m) => ({ key: m.key, label: m.label, unit: m.unit, optimalMin: m.optimalMin, optimalMax: m.optimalMax, warningMax: m.warningMax })),
      esg: c.esg,
    })),
  });
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
      categoria: r.categoria || 'plantas',
      cestaId: r.cesta_id,
      cestaUbicacion: r.cesta_ubicacion,
      tipoResiduo: r.tipo_residuo,
      pesoKg: parseFloat(r.peso_kg),
      unidadPrincipal: r.unidad_principal,
      tipoSustrato: r.tipo_sustrato,
      residuoTipo: r.residuo_tipo,
      fechaIngreso: r.fecha_ingreso,
      fechaProyeccionCosecha: r.fecha_proyeccion_cosecha,
      biomasaEstimadaKg: parseFloat(r.biomasa_estimada_kg),
      co2eReducidoKg: parseFloat(r.co2e_reducido_kg),
      metanoEvitadoKg: parseFloat(r.metano_evitado_kg),
      frassEstimadoKg: parseFloat(r.frass_estimado_kg),
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