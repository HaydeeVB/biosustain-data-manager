/**
 * esg.ts — Métricas ESG del cliente calculadas desde la base de datos.
 *
 * GET /api/v1/esg → métricas de sostenibilidad calculadas desde lotes + telemetría
 *
 * Campos planos para coincidir con el frontend (sin ?? fallbacks).
 */
import { Router, Request, Response } from 'express';
import { query, isDbConfigured } from '../db';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
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
    // Calcular desde lotes reales
    const lotesResult = await query(
      `SELECT peso_kg, biomasa_estimada_kg, co2e_reducido_kg
       FROM lotes WHERE cliente_id = $1 AND estado = 'activo'`,
      [clienteId]
    );

    const lotes = lotesResult.rows;
    const totalResiduosKg = lotes.reduce((sum: number, l: any) => sum + parseFloat(l.peso_kg || 0), 0);
    const totalBiomasaKg = lotes.reduce((sum: number, l: any) => sum + parseFloat(l.biomasa_estimada_kg || 0), 0);
    const totalCo2eKg = lotes.reduce((sum: number, l: any) => sum + parseFloat(l.co2e_reducido_kg || 0), 0);
    const frassKg = totalBiomasaKg * 0.4; // 40% de biomasa → frass
    const metanoKg = totalResiduosKg * 0.15;

    // Telemetría para eficiencia
    const telemetryResult = await query(
      `SELECT COUNT(*) as total_lecturas,
              COUNT(DISTINCT t.cesta_id) as cestas_monitoreadas,
              AVG(t.temp_ambiente) as temp_promedio,
              AVG(t.humedad_relativa) as humedad_promedio,
              SUM(t.biomasa_larvaria_estimada_kg) as biomasa_telemetria
       FROM telemetria_cestas t
       JOIN cestas c ON t.cesta_id = c.id
       WHERE c.cliente_id = $1`,
      [clienteId]
    );

    const telemetry = telemetryResult.rows[0] || {};
    const cestasMonitoreadas = parseInt(telemetry.cestas_monitoreadas || 0);

    // Eficiencia: basada en cestas dentro de rango óptimo (temp 25-32°C, humedad 50-80%)
    let eficiencia = 0;
    if (cestasMonitoreadas > 0) {
      const cestasOptimasResult = await query(
        `SELECT COUNT(DISTINCT t.cesta_id) as cestas_optimas
         FROM telemetria_cestas t
         JOIN cestas c ON t.cesta_id = c.id
         WHERE c.cliente_id = $1
           AND t.timestamp = (
             SELECT MAX(t2.timestamp) FROM telemetria_cestas t2 WHERE t2.cesta_id = t.cesta_id
           )
           AND t.temp_ambiente BETWEEN 25 AND 32
           AND t.humedad_relativa BETWEEN 50 AND 80`,
        [clienteId]
      );
      const cestasOptimas = parseInt(cestasOptimasResult.rows[0]?.cestas_optimas || 0);
      eficiencia = Math.round((cestasOptimas / cestasMonitoreadas) * 100);
    }

    // Convertir kg → toneladas
    const ton = (kg: number) => kg / 1000;

    res.json({
      clienteId,
      // Campos planos — coinciden con el frontend, sin ?? fallbacks
      residuosReconvertidos: ton(totalResiduosKg),
      frassCertificado: ton(frassKg),
      co2eReducido: ton(totalCo2eKg),
      metanoEvitado: ton(metanoKg),
      biomasaProducida: ton(totalBiomasaKg),
      eficiencia: eficiencia,
      totalLotes: lotes.length,
      cestasMonitoreadas: cestasMonitoreadas,
      descripcion: 'Métricas calculadas desde lotes registrados y telemetría de cestas. Metodología IPCC.',
      ultimaActualizacion: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[ESG] Error:', err.message);
    res.status(500).json({ error: 'Error al calcular métricas ESG.', code: 'ESG_ERROR' });
  }
});

export default router;