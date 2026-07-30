/**
 * auth.ts — Rutas de autenticación.
 *
 * POST /api/v1/auth/register — registro de nuevo cliente
 * POST /api/v1/auth/login    — login de cliente existente
 * GET  /api/v1/auth/me       — perfil del cliente autenticado
 */
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { generarToken, authenticateToken } from '../middleware/auth';
import { query, isDbConfigured } from '../db';

const router = Router();

// ── Esquemas de validación ────────────────────────────────────────────────────

const registerSchema = z.object({
  nombre: z.string().min(2).max(200),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  empresa: z.string().optional().default(''),
  telefono: z.string().max(50).optional().default(''),
  plan: z.enum(['basico', 'pro', 'enterprise']).default('basico'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ── Almacenamiento en memoria (modo demo) ────────────────────────────────────

interface Cliente {
  id: string;
  nombre: string;
  email: string;
  passwordHash: string;
  empresa: string;
  telefono: string;
  plan: string;
  creadoEn: Date;
  activo: boolean;
}

const clientesEnMemoria: Map<string, Cliente> = new Map();

// ── Endpoints ─────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/register
 * Registra un nuevo cliente.
 */
router.post('/register', async (req: Request, res: Response) => {
  const parseResult = registerSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Datos de registro inválidos.',
      detalles: parseResult.error.flatten().fieldErrors,
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  const { nombre, email, password, empresa, telefono, plan } = parseResult.data;

  // Verificar si el email ya está registrado
  const existente = Array.from(clientesEnMemoria.values()).find(c => c.email === email);
  if (existente) {
    res.status(409).json({ error: 'Email ya registrado.', code: 'EMAIL_EXISTS' });
    return;
  }

  // Hashear contraseña
  const passwordHash = await bcrypt.hash(password, 10);
  const id = `cli_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const cliente: Cliente = {
    id, nombre, email, passwordHash, empresa, telefono, plan,
    creadoEn: new Date(), activo: true,
  };
  clientesEnMemoria.set(id, cliente);

  // TODO: Si DB configurada, guardar en PostgreSQL
  // if (isDbConfigured()) {
  //   await query('INSERT INTO clientes ...', [id, nombre, email, passwordHash, ...]);
  // }

  // Generar JWT
  const token = generarToken({ clienteId: id, email, plan });

  res.status(201).json({
    token,
    cliente: {
      id, nombre, email, empresa, telefono, plan,
      creadoEn: cliente.creadoEn.toISOString(),
    },
  });
});

/**
 * POST /api/v1/auth/login
 * Autentica un cliente existente.
 */
router.post('/login', async (req: Request, res: Response) => {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Credenciales inválidas.',
      detalles: parseResult.error.flatten().fieldErrors,
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  const { email, password } = parseResult.data;

  // Buscar cliente
  const cliente = Array.from(clientesEnMemoria.values()).find(c => c.email === email);
  if (!cliente) {
    res.status(401).json({ error: 'Credenciales inválidas.', code: 'INVALID_CREDENTIALS' });
    return;
  }

  // Verificar contraseña
  const passwordValida = await bcrypt.compare(password, cliente.passwordHash);
  if (!passwordValida) {
    res.status(401).json({ error: 'Credenciales inválidas.', code: 'INVALID_CREDENTIALS' });
    return;
  }

  if (!cliente.activo) {
    res.status(403).json({ error: 'Cuenta suspendida. Contacte soporte.', code: 'ACCOUNT_SUSPENDED' });
    return;
  }

  const token = generarToken({ clienteId: cliente.id, email: cliente.email, plan: cliente.plan });

  res.json({
    token,
    cliente: {
      id: cliente.id, nombre: cliente.nombre, email: cliente.email,
      empresa: cliente.empresa, telefono: cliente.telefono, plan: cliente.plan,
      creadoEn: cliente.creadoEn.toISOString(),
    },
  });
});

/**
 * GET /api/v1/auth/me
 * Devuelve el perfil del cliente autenticado.
 */
router.get('/me', authenticateToken, (req: Request, res: Response) => {
  if (!req.cliente) {
    res.status(401).json({ error: 'No autenticado.', code: 'NOT_AUTHENTICATED' });
    return;
  }

  const cliente = clientesEnMemoria.get(req.cliente.clienteId);
  if (!cliente) {
    res.status(404).json({ error: 'Cliente no encontrado.', code: 'CLIENT_NOT_FOUND' });
    return;
  }

  res.json({
    id: cliente.id, nombre: cliente.nombre, email: cliente.email,
    empresa: cliente.empresa, telefono: cliente.telefono, plan: cliente.plan,
    creadoEn: cliente.creadoEn.toISOString(), activo: cliente.activo,
  });
});

export default router;