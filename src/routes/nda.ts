/**
 * nda.ts — Rutas del click-wrap NDA.
 *
 * GET  /api/v1/nda  → devuelve el texto del NDA
 * POST /api/v1/nda/accept → registra aceptación del cliente
 *
 * Requisito del documento de arquitectura (Servidor.pdf):
 * "Términos de Servicio Digitales (Click-Wrap NDA): Al ingresar por primera vez,
 * el usuario debe aceptar obligatoriamente los términos que prohíben explícitamente
 * el escaneo de vulnerabilidades, pruebas de penetración o inyección de código."
 */
import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { query, isDbConfigured } from '../db';

const router = Router();

// ── Texto del NDA ─────────────────────────────────────────────────────────────

const NDA_TEXTO = `TÉRMINOS DE SERVICIO — BIOSUSTAIN DATA-MANAGER

Al acceder a esta plataforma, usted acepta los siguientes términos:

1. CONFIDENCIALIDAD
La información mostrada en este panel es confidencial. No está permitido
compartir credenciales, datos de telemetría ni información comercial con terceros.

2. PROHIBICIÓN DE INGENIERÍA INVERSA
Se prohíbe expresamente el escaneo de vulnerabilidades, pruebas de penetración,
inyección de código, scraping de datos o cualquier intento de acceder al código
fuente, algoritmos o modelos del sistema sin autorización escrita.

3. USO AUTORIZADO
El acceso es exclusivamente para consultar el estado de sus cestas de
bioconversión, métricas de producción y reportes ESG. Cualquier uso fuera
de este alcance resultará en revocación inmediata de credenciales.

4. PROPIEDAD INTELECTUAL
Los algoritmos de bioconversión, modelos de gemelos digitales, fórmulas de
sustrato y código del sistema son propiedad de Bio Morphix C.A. El cliente
no adquiere derechos sobre estos elementos.

5. RESPONSABILIDAD
Los datos mostrados son informativos. Bio Morphix C.A. no se hace responsable
de decisiones operativas tomadas por el cliente basadas en la plataforma.

Fecha de vigencia: Julio 2026`;

// ── Almacenamiento en memoria (modo demo) ────────────────────────────────────

const aceptacionesNDA: Map<string, { clienteId: string; fechaAceptacion: Date; version: string }> = new Map();
const NDA_VERSION = '2026-07';

// ── Endpoints ──────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/nda
 * Devuelve el texto del NDA para que el cliente lo lea.
 */
router.get('/', (_req: Request, res: Response) => {
  res.json({
    texto: NDA_TEXTO,
    version: NDA_VERSION,
    requiereAceptacion: true,
  });
});

/**
 * POST /api/v1/nda/accept
 * Registra la aceptación del NDA por parte del cliente.
 * Requiere autenticación.
 */
router.post('/accept', authenticateToken, async (req: Request, res: Response) => {
  const clienteId = req.cliente?.clienteId;
  if (!clienteId) {
    res.status(401).json({ error: 'No autenticado.', code: 'NOT_AUTHENTICATED' });
    return;
  }

  // Verificar si ya aceptó
  if (aceptacionesNDA.has(clienteId)) {
    res.json({ ok: true, message: 'NDA ya aceptado previamente.' });
    return;
  }

  // Registrar aceptación
  aceptacionesNDA.set(clienteId, {
    clienteId,
    fechaAceptacion: new Date(),
    version: NDA_VERSION,
  });

  // Guardar en DB si está configurada
  if (isDbConfigured()) {
    try {
      await query(
        `INSERT INTO audit_log (cliente_id, accion, endpoint, detalles)
         VALUES ($1, 'NDA_ACCEPT', '/api/v1/nda/accept', $2)`,
        [clienteId, JSON.stringify({ version: NDA_VERSION, timestamp: new Date().toISOString() })]
      );
    } catch {
      // No fallar por error de audit
    }
  }

  res.json({
    ok: true,
    message: 'NDA aceptado. Acceso completo habilitado.',
    fechaAceptacion: new Date().toISOString(),
    version: NDA_VERSION,
  });
});

/**
 * GET /api/v1/nda/status
 * Verifica si el cliente ha aceptado el NDA.
 */
router.get('/status', authenticateToken, (req: Request, res: Response) => {
  const clienteId = req.cliente?.clienteId;
  if (!clienteId) {
    res.status(401).json({ error: 'No autenticado.', code: 'NOT_AUTHENTICATED' });
    return;
  }

  const aceptacion = aceptacionesNDA.get(clienteId);
  res.json({
    aceptado: !!aceptacion,
    fechaAceptacion: aceptacion?.fechaAceptacion.toISOString() || null,
    version: aceptacion?.version || null,
  });
});

export default router;