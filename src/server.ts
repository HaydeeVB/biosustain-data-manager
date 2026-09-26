/**
 * server.ts — Punto de entrada del SaaS BioSustain Data-Manager.
 *
 * Servidor Express con:
 * - Autenticación JWT
 * - Rate limiting (anti-scraping)
 * - Validación de entrada (Zod)
 * - Helmet para headers de seguridad
 * - CORS restringido a orígenes conocidos
 * - Multi-tenant: cada cliente ve solo sus cestas
 *
 * Endpoints:
 *   GET  /api/v1/health           → estado del servicio
 *   POST /api/v1/auth/register    → registro de cliente
 *   POST /api/v1/auth/login       → login de cliente
 *   GET  /api/v1/auth/me          → perfil del cliente autenticado
 *   GET  /api/v1/cestas           → cestas del cliente
 *   GET  /api/v1/cestas/:id       → detalle de una cesta
 *   GET  /api/v1/cestas/:id/metrics → telemetría de una cesta
 *   GET  /api/v1/dashboard        → dashboard del cliente
 *   POST /api/v1/iot/metrics      → ingesta de datos IoT (ESP32)
 *   GET  /api/v1/esg             → métricas ESG del cliente
 */
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 8080;

// ── Middlewares de seguridad ──────────────────────────────────────────────────

// Headers de seguridad
app.use(helmet());

// CORS restringido
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',');
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// Parseo de JSON con límite de tamaño (prevenir payloads maliciosos)
app.use(express.json({ limit: '100kb' }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
//
// FIX (2026-09-26): hasta hoy el ÚNICO limitador era global y por IP
// (100 req / 15 min). Una cesta enviando cada 10 s consume 8.640 req/día,
// así que la PRIMERA cesta ya rozaba el techo y la SEGUNDA detrás de la misma
// conexión quedaba bloqueada con 429 — la telemetría se perdía en silencio.
// Reproducido en vivo: primer 429 en la petición #96.
//
// El comentario viejo de iot.ts decía "1 request por 10 segundos por
// dispositivo"; eso nunca se implementó. Ahora sí: el limitador general se
// aplica a TODA la API EXCEPTO /api/v1/iot/, que tiene su propio límite
// generoso por device_id (no por IP, porque varias cestas comparten salida
// a internet en la planta).
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  message: {
    error: 'Demasiadas solicitudes. Acceso temporalmente suspendido.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Límite propio de la ingesta IoT. Se cuenta POR NODO (device_id), resuelto por
// el middleware iotAuth desde la API key — nunca por IP, porque varias cestas
// comparten router en la planta. Techo alto a propósito: 6 lecturas/min por nodo
// = 8.640/día, así que 60.000/día deja margen amplio por dispositivo.
const iotLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: parseInt(process.env.IOT_RATE_LIMIT_MAX || '60000', 10),
  message: {
    error: 'Límite de ingesta IoT excedido para este dispositivo.',
    code: 'IOT_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Cada nodo tiene su propio presupuesto. Con claves por nodo (iot_devices)
  // esto ya no se reparte entre cestas.
  keyGenerator: (req: Request) => {
    const deviceId = req.iotDeviceId || (req.body?.device_id as string);
    if (deviceId) return `iot-dev:${deviceId}`;
    const apiKey = req.header('X-API-Key');
    return apiKey ? `iot-key:${apiKey}` : `iot-ip:${req.ip}`;
  },
});

// La ingesta IoT va PRIMERO, con su propio limitador...
app.use('/api/v1/iot/', iotLimiter);
// ...y queda excluida del limitador general (si no, se aplicarían los dos).
app.use('/api/', (req, res, next) => {
  if (req.path.startsWith('/v1/iot/')) return next();
  return apiLimiter(req, res, next);
});

// ── Rutas ─────────────────────────────────────────────────────────────────────

// Health check (sin auth)
app.get('/api/v1/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'biosustain-saas',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

// Auth routes
import authRoutes from './routes/auth';
import { initDb, query, isDbConfigured } from './db';

// Initialize database connection
initDb();

// Auth routes: /register and /login are public, /me and /password need auth
app.use('/api/v1/auth', authRoutes);

// Public stats (for login screen — no auth required)
app.get('/api/v1/public/stats', async (_req: any, res: any) => {
  try {
    if (!isDbConfigured()) {
      res.json({ cestas: 0, eficiencia: 0, co2e: 0 });
      return;
    }
    const cestasResult = await query('SELECT COUNT(*) as total FROM cestas WHERE activa = true');
    const cestas = parseInt(cestasResult.rows[0]?.total || 0);

    const lotesResult = await query(`SELECT COALESCE(SUM(co2e_reducido_kg), 0) as co2e FROM lotes WHERE estado = 'activo'`);
    const co2eKg = parseFloat(lotesResult.rows[0]?.co2e || 0);

    const optimasResult = await query(
      `SELECT COUNT(DISTINCT t.cesta_id) as optimas
       FROM telemetria_cestas t
       WHERE t.timestamp = (SELECT MAX(t2.timestamp) FROM telemetria_cestas t2 WHERE t2.cesta_id = t.cesta_id)
         AND t.temp_ambiente BETWEEN 25 AND 32
         AND t.humedad_relativa BETWEEN 50 AND 80`
    );
    const optimas = parseInt(optimasResult.rows[0]?.optimas || 0);
    const eficiencia = cestas > 0 ? Math.round((optimas / cestas) * 100) : 0;

    res.json({ cestas, eficiencia, co2e: co2eKg / 1000 });
  } catch (e: any) {
    console.error('[PUBLIC STATS] Error:', e.message);
    res.json({ cestas: 0, eficiencia: 0, co2e: 0, error: e.message });
  }
});

// NDA (click-wrap)
import ndaRoutes from './routes/nda';
app.use('/api/v1/nda', ndaRoutes);

// Legal documents (public) — privacy policy + terms of service
import legalRoutes from './routes/legal';
app.use('/api/v1/legal', legalRoutes);

// Protected routes (require JWT)
import { authenticateToken } from './middleware/auth';
import { auditLog } from './middleware/audit';

// Cestas (multi-tenant — cada cliente ve solo las suyas)
import cestaRoutes from './routes/cestas';
app.use('/api/v1/cestas', authenticateToken, auditLog, cestaRoutes);

// Dashboard
import dashboardRoutes from './routes/dashboard';
app.use('/api/v1/dashboard', authenticateToken, auditLog, dashboardRoutes);

// ESG metrics
import esgRoutes from './routes/esg';
app.use('/api/v1/esg', authenticateToken, auditLog, esgRoutes);

// IoT ingesta (API key auth, no JWT — para ESP32)
import iotRoutes from './routes/iot';
app.use('/api/v1/iot', iotRoutes);

// Cerebro bridge (encrypted request/response to private model server)
import cerebroRoutes from './routes/cerebro';
app.use('/api/v1/cerebro', authenticateToken, auditLog, cerebroRoutes);

// Billing (mock gateway — MercadoPago blocked for Venezuela)
import billingRoutes from './routes/billing';
app.use('/api/v1/billing', billingRoutes);

// Lotes (manual lot registration — conference demo)
import lotesRoutes from './routes/lotes';
app.use('/api/v1/lotes', authenticateToken, auditLog, lotesRoutes);

// Reports (ESG PDF export)
import reportsRoutes from './routes/reports';
app.use('/api/v1/reports', authenticateToken, auditLog, reportsRoutes);

// ── Manejo de errores ─────────────────────────────────────────────────────────

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({
    error: 'Error interno del servidor',
    code: 'INTERNAL_ERROR',
  });
});

// ── 404 ────────────────────────────────────────────────────────────────────────

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint no encontrado', code: 'NOT_FOUND' });
});

// ── Inicio ────────────────────────────────────────────────────────────────────

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[BioSustain SaaS] Servidor en puerto ${PORT}`);
    console.log(`[BioSustain SaaS] CORS orígenes: ${allowedOrigins.join(', ')}`);
  });
}

export default app;