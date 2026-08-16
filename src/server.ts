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

// Rate limiting — anti-scraping (100 requests por 15 min por IP)
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  message: {
    error: 'Demasiadas solicitudes. Acceso temporalmente suspendido.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

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