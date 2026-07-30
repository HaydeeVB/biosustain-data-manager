/**
 * esg.ts — Métricas ESG del cliente.
 *
 * GET /api/v1/esg → métricas de sostenibilidad del cliente
 *
 * Basado en el Reportes ESG del gemelo digital:
 * - Residuos sólidos reconvertidos (ton)
 * - Frass orgánico certificado (ton)
 * - Reducción de huella CO₂e (ton)
 */
import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const clienteId = req.cliente?.clienteId;
  if (!clienteId) {
    res.status(401).json({ error: 'No autenticado.', code: 'NOT_AUTHENTICATED' });
    return;
  }

  // En producción, calcular desde la base de datos real
  // En modo demo, devolver estructura con los datos del gemelo digital
  res.json({
    clienteId,
    metricas: {
      residuosReconvertidosTon: 0,
      frassCertificadoTon: 0,
      reduccionCO2eTon: 0,
      eficienciaConversion: 0,
    },
    descripcion: 'Métricas de valorización de residuos sólidos y economía circular.',
    ultimaActualizacion: new Date().toISOString(),
  });
});

export default router;