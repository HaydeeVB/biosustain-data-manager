/**
 * dashboard.ts — Dashboard del cliente con PostgreSQL.
 *
 * GET /api/v1/dashboard → resumen del estado de todas las cestas del cliente
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

  if (isDbConfigured()) {
    try {
      // Get all cestas for this client
      const cestasResult = await query(
        `SELECT c.id, c.ubicacion, c.activa, c.fecha_instalacion,
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

      const cestas = cestasResult.rows.map((r: any) => ({
        id: r.id,
        ubicacion: r.ubicacion,
        estado: r.activa ? 'activa' : 'inactiva',
        ultimaTemp: r.ultima_temp ? parseFloat(r.ultima_temp) : null,
        ultimaHumedad: r.ultima_humedad ? parseFloat(r.ultima_humedad) : null,
        ultimaBiomasa: r.ultima_biomasa ? parseFloat(r.ultima_biomasa) : null,
      }));

      const cestasActivas = cestas.filter(c => c.estado === 'activa').length;

      // Count alerts (temp > 32 or humidity < 50)
      const alertas = cestas.filter(c =>
        (c.ultimaTemp && c.ultimaTemp > 32) ||
        (c.ultimaHumedad && c.ultimaHumedad < 50)
      ).length;

      // Calculate efficiency from telemetry — cestas within optimal range
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
      const eficiencia = cestasActivas > 0 ? Math.round((cestasOptimas / cestasActivas) * 100) : 0;

      res.json({
        cestasActivas,
        totalCestas: cestas.length,
        alertas,
        eficiencia,
        cestas,
      });
    } catch (err: any) {
      console.error('[DASHBOARD] Error:', err.message);
      res.status(500).json({ error: 'Error al obtener dashboard.', code: 'DB_ERROR' });
    }
  } else {
    res.json({
      cestasActivas: 0,
      totalCestas: 0,
      alertas: 0,
      eficiencia: 0,
      cestas: [],
    });
  }
});

export default router;