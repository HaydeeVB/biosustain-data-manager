/**
 * auth.ts — Rutas de autenticación con PostgreSQL.
 *
 * POST /api/v1/auth/register — registro de nuevo cliente
 * POST /api/v1/auth/login    — login de cliente existente
 * GET  /api/v1/auth/me       — perfil del cliente autenticado
 */
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { query, isDbConfigured } from '../db';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'biosustain-dev-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// In-memory fallback (only when DB not configured)
interface MemClient {
  id: string; nombre: string; email: string; empresa?: string;
  telefono?: string; passwordHash: string; plan: string; creadoEn: Date;
}
const memClients: Map<string, MemClient> = new Map();
const memByEmail: Map<string, MemClient> = new Map();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  nombre: z.string().min(2),
  empresa: z.string().optional(),
  telefono: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function genToken(clienteId: string): string {
  return jwt.sign({ clienteId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as any);
}

// ── REGISTER ──────────────────────────────────────────────────────────
router.post('/register', async (req: Request, res: Response) => {
  const parse = registerSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({
      error: 'Datos de registro inválidos.',
      detalles: parse.error.flatten().fieldErrors,
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  const { email, password, nombre, empresa, telefono } = parse.data;
  const passwordHash = await bcrypt.hash(password, 10);

  if (isDbConfigured()) {
    try {
      // Check if email exists
      const existing = await query('SELECT id FROM clientes WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        res.status(409).json({ error: 'Ya existe un cliente con este email.', code: 'EMAIL_EXISTS' });
        return;
      }

      const clienteId = `cli_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await query(
        `INSERT INTO clientes (id, nombre, email, empresa, telefono, password_hash, plan)
         VALUES ($1, $2, $3, $4, $5, $6, 'basico')`,
        [clienteId, nombre, email, empresa || '', telefono || '', passwordHash]
      );

      const token = genToken(clienteId);
      res.status(201).json({
        token,
        cliente: { id: clienteId, nombre, email, empresa: empresa || '', telefono: telefono || '', plan: 'basico' },
      });
    } catch (err: any) {
      console.error('[AUTH] Register error:', err.message);
      res.status(500).json({ error: 'Error al registrar cliente.', code: 'DB_ERROR' });
    }
  } else {
    // In-memory fallback
    if (memByEmail.has(email)) {
      res.status(409).json({ error: 'Ya existe un cliente con este email.', code: 'EMAIL_EXISTS' });
      return;
    }
    const clienteId = `cli_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const client: MemClient = {
      id: clienteId, nombre, email, empresa, telefono,
      passwordHash, plan: 'basico', creadoEn: new Date(),
    };
    memClients.set(clienteId, client);
    memByEmail.set(email, client);

    const token = genToken(clienteId);
    res.status(201).json({
      token,
      cliente: { id: clienteId, nombre, email, empresa: empresa || '', telefono: telefono || '', plan: 'basico' },
    });
  }
});

// ── LOGIN ─────────────────────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response) => {
  const parse = loginSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Credenciales inválidas.', code: 'VALIDATION_ERROR' });
    return;
  }

  const { email, password } = parse.data;

  if (isDbConfigured()) {
    try {
      const result = await query('SELECT * FROM clientes WHERE email = $1', [email]);
      if (result.rows.length === 0) {
        res.status(401).json({ error: 'Credenciales inválidas.', code: 'INVALID_CREDENTIALS' });
        return;
      }

      const client = result.rows[0];
      const valid = await bcrypt.compare(password, client.password_hash);
      if (!valid) {
        res.status(401).json({ error: 'Credenciales inválidas.', code: 'INVALID_CREDENTIALS' });
        return;
      }

      const token = genToken(client.id);
      res.json({
        token,
        cliente: {
          id: client.id, nombre: client.nombre, email: client.email,
          empresa: client.empresa || '', telefono: client.telefono || '', plan: client.plan || 'basico',
        },
      });
    } catch (err: any) {
      console.error('[AUTH] Login error:', err.message);
      res.status(500).json({ error: 'Error al iniciar sesión.', code: 'DB_ERROR' });
    }
  } else {
    const client = memByEmail.get(email);
    if (!client) {
      res.status(401).json({ error: 'Credenciales inválidas.', code: 'INVALID_CREDENTIALS' });
      return;
    }
    const valid = await bcrypt.compare(password, client.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Credenciales inválidas.', code: 'INVALID_CREDENTIALS' });
      return;
    }

    const token = genToken(client.id);
    res.json({
      token,
      cliente: {
        id: client.id, nombre: client.nombre, email: client.email,
        empresa: client.empresa || '', telefono: client.telefono || '', plan: client.plan,
      },
    });
  }
});

// ── ME (GET) + PATCH (update profile) ─────────────────────────────
router.get('/me', async (req: Request, res: Response) => {
  const clienteId = (req as any).cliente?.clienteId;
  if (!clienteId) {
    res.status(401).json({ error: 'No autenticado.', code: 'NOT_AUTHENTICATED' });
    return;
  }

  if (isDbConfigured()) {
    try {
      const result = await query(
        'SELECT id, nombre, email, empresa, telefono, plan, creado_en FROM clientes WHERE id = $1',
        [clienteId]
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Cliente no encontrado.', code: 'NOT_FOUND' });
        return;
      }
      res.json({ cliente: result.rows[0] });
    } catch {
      res.status(500).json({ error: 'Error al obtener perfil.', code: 'DB_ERROR' });
    }
  } else {
    const client = memClients.get(clienteId);
    if (!client) {
      res.status(404).json({ error: 'Cliente no encontrado.', code: 'NOT_FOUND' });
      return;
    }
    res.json({
      cliente: {
        id: client.id, nombre: client.nombre, email: client.email,
        empresa: client.empresa || '', telefono: client.telefono || '', plan: client.plan,
      },
    });
  }
});

// ── PATCH ME (update profile) ─────────────────────────────────────
router.patch('/me', async (req: Request, res: Response) => {
  const clienteId = (req as any).cliente?.clienteId;
  if (!clienteId) {
    res.status(401).json({ error: 'No autenticado.', code: 'NOT_AUTHENTICATED' });
    return;
  }

  const { nombre, empresa, telefono } = req.body;

  if (isDbConfigured()) {
    try {
      const result = await query(
        `UPDATE clientes SET nombre = COALESCE($1, nombre), empresa = COALESCE($2, empresa), telefono = COALESCE($3, telefono)
         WHERE id = $4 RETURNING id, nombre, email, empresa, telefono, plan`,
        [nombre || null, empresa || null, telefono || null, clienteId]
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Cliente no encontrado.', code: 'NOT_FOUND' });
        return;
      }
      res.json({ cliente: result.rows[0] });
    } catch {
      res.status(500).json({ error: 'Error al actualizar perfil.', code: 'DB_ERROR' });
    }
  } else {
    const client = memClients.get(clienteId);
    if (!client) { res.status(404).json({ error: 'No encontrado.', code: 'NOT_FOUND' }); return; }
    if (nombre) client.nombre = nombre;
    if (empresa !== undefined) client.empresa = empresa;
    res.json({ cliente: { id: client.id, nombre: client.nombre, email: client.email, empresa: client.empresa, telefono: client.telefono, plan: client.plan } });
  }
});

// ── CHANGE PASSWORD ───────────────────────────────────────────────
router.post('/password', async (req: Request, res: Response) => {
  const clienteId = (req as any).cliente?.clienteId;
  if (!clienteId) {
    res.status(401).json({ error: 'No autenticado.', code: 'NOT_AUTHENTICATED' });
    return;
  }

  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword || newPassword.length < 8) {
    res.status(400).json({ error: 'Contraseña inválida (mín. 8 caracteres).', code: 'VALIDATION_ERROR' });
    return;
  }

  if (isDbConfigured()) {
    try {
      const result = await query('SELECT password_hash FROM clientes WHERE id = $1', [clienteId]);
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Cliente no encontrado.', code: 'NOT_FOUND' });
        return;
      }

      const valid = await bcrypt.compare(oldPassword, result.rows[0].password_hash);
      if (!valid) {
        res.status(401).json({ error: 'Contraseña actual incorrecta.', code: 'INVALID_PASSWORD' });
        return;
      }

      const newHash = await bcrypt.hash(newPassword, 10);
      await query('UPDATE clientes SET password_hash = $1 WHERE id = $2', [newHash, clienteId]);
      res.json({ success: true, message: 'Contraseña actualizada.' });
    } catch {
      res.status(500).json({ error: 'Error al cambiar contraseña.', code: 'DB_ERROR' });
    }
  } else {
    const client = memClients.get(clienteId);
    if (!client) { res.status(404).json({ error: 'No encontrado.', code: 'NOT_FOUND' }); return; }
    const valid = await bcrypt.compare(oldPassword, client.passwordHash);
    if (!valid) { res.status(401).json({ error: 'Contraseña actual incorrecta.', code: 'INVALID_PASSWORD' }); return; }
    client.passwordHash = await bcrypt.hash(newPassword, 10);
    res.json({ success: true, message: 'Contraseña actualizada.' });
  }
});

export default router;