/**
 * dashboard.ts — Dashboard del cliente.
 *
 * GET /api/v1/dashboard → resumen del estado de todas las cestas del cliente
 */
import { Router, Request, Response } from 'express';

const router = Router();

// Cestas en memoria (compartido con cestas.ts en modo demo)
// En producción, esto viene de la base de datos

router.get('/', (req: Request, res: Response) => {
  const clienteId = req.cliente?.clienteId;
  if (!clienteId) {
    res.status(401).json({ error: 'No autenticado.', code: 'NOT_AUTHENTICATED' });
    return;
  }

  // En modo demo, devolver estructura vacía pero válida
  // En producción, consultar todas las cestas del cliente + métricas agregadas
  res.json({
    clienteId,
    resumen: {
      totalCestas: 0,
      cestasActivas: 0,
      cestasInactivas: 0,
    },
    metricas: {
      biomasaTotalKg: 0,
      sustratoRemanenteKg: 0,
      eficienciaPromedio: 0,
      mortalidadPromedio: 0,
    },
    alertas: [],
    ultimaActualizacion: new Date().toISOString(),
  });
});

export default router;