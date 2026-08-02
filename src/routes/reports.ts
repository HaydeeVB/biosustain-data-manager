/**
 * reports.ts — Reportes técnicos exportables (PDF).
 *
 * GET /api/v1/reports/esg/:clienteId → PDF con métricas ESG + trazabilidad
 *
 * Genera un PDF certificado con:
 * - Métricas de bioconversión (residuos, frass, CO2e)
 * - Historial de lotes procesados
 * - Trazabilidad por cesta
 * - Listo para auditorías y certificaciones
 */
import { Router, Request, Response } from 'express';
import { query, isDbConfigured } from '../db';
import { generateEsgReport } from '../utils/pdf';

const router = Router();

router.get('/esg', async (req: Request, res: Response) => {
  const clienteId = (req as any).cliente?.clienteId;
  if (!clienteId) {
    res.status(401).json({ error: 'No autenticado.', code: 'NOT_AUTHENTICATED' });
    return;
  }

  if (!isDbConfigured()) {
    res.status(503).json({ error: 'Base de datos no configurada.', code: 'DB_ERROR' });
    return;
  }

  try {
    // Get client info
    const clientResult = await query(
      'SELECT id, nombre, email, empresa FROM clientes WHERE id = $1',
      [clienteId]
    );
    if (clientResult.rows.length === 0) {
      res.status(404).json({ error: 'Cliente no encontrado.', code: 'NOT_FOUND' });
      return;
    }
    const client = clientResult.rows[0];

    // Get lotes
    const lotesResult = await query(
      `SELECT l.*, c.ubicacion as cesta_ubicacion
       FROM lotes l JOIN cestas c ON l.cesta_id = c.id
       WHERE l.cliente_id = $1 AND l.estado = 'activo'
       ORDER BY l.fecha_ingreso DESC`,
      [clienteId]
    );

    // Get telemetry summary
    const telemetryResult = await query(
      `SELECT COUNT(*) as total_readings,
              COUNT(DISTINCT t.cesta_id) as cestas_monitoreadas,
              AVG(t.temp_ambiente) as temp_promedio,
              AVG(t.humedad_relativa) as humedad_promedio,
              SUM(t.biomasa_larvaria_estimada_kg) as biomasa_total,
              SUM(t.degradacion_residuo_kg) as residuos_procesados
       FROM telemetria_cestas t
       JOIN cestas c ON t.cesta_id = c.id
       WHERE c.cliente_id = $1`,
      [clienteId]
    );

    // Calculate ESG metrics
    const lotes = lotesResult.rows;
    const totalResiduos = lotes.reduce((sum: number, l: any) => sum + parseFloat(l.peso_kg), 0);
    const totalBiomasa = lotes.reduce((sum: number, l: any) => sum + parseFloat(l.biomasa_estimada_kg || 0), 0);
    const totalCo2e = lotes.reduce((sum: number, l: any) => sum + parseFloat(l.co2e_reducido_kg || 0), 0);
    const frassEstimado = totalBiomasa * 0.4; // 40% of biomass becomes frass

    const reportData = {
      client: {
        nombre: client.nombre,
        empresa: client.empresa || '',
        email: client.email,
      },
      fecha: new Date().toISOString(),
      metricas: {
        residuosProcesadosKg: totalResiduos,
        biomasaProducidaKg: totalBiomasa,
        frassEstimadoKg: frassEstimado,
        co2eReducidoKg: totalCo2e,
        metanoEvitadoKg: totalResiduos * 0.15,
      },
      lotes: lotes.map((l: any) => ({
        id: l.id,
        cesta: l.cesta_ubicacion,
        tipoResiduo: l.tipo_residuo,
        pesoKg: parseFloat(l.peso_kg),
        sustrato: l.tipo_sustrato,
        fechaIngreso: l.fecha_ingreso,
        fechaCosecha: l.fecha_proyeccion_cosecha,
        biomasaKg: parseFloat(l.biomasa_estimada_kg),
        co2eKg: parseFloat(l.co2e_reducido_kg),
      })),
      telemetry: telemetryResult.rows[0] || {},
    };

    const pdfBuffer = await generateEsgReport(reportData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="BioSustain_Reporte_ESG_${Date.now()}.pdf"`);
    res.send(pdfBuffer);
  } catch (err: any) {
    console.error('[REPORTS] ESG error:', err.message);
    res.status(500).json({ error: 'Error al generar reporte.', code: 'REPORT_ERROR' });
  }
});

export default router;