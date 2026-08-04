/**
 * auth.ts — Middleware de autenticación JWT.
 *
 * Verifica el token JWT en el header Authorization: Bearer <token>.
 * Si es válido, adjunta el cliente al request.
 * Si no, responde 401.
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || '';
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET no está configurado. El servidor no puede arrancar sin un secret.');
  process.exit(1);
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

export interface ClientePayload {
  clienteId: string;
  email: string;
  plan: string;
}

// Extender Request para incluir el cliente
declare global {
  namespace Express {
    interface Request {
      cliente?: ClientePayload;
    }
  }
}

/**
 * Genera un JWT para un cliente.
 */
export function generarToken(payload: ClientePayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as any });
}

/**
 * Middleware: verifica el JWT en el header Authorization.
 * Si es válido, adjunta el cliente a req.cliente.
 * Si no, responde 401.
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token de autenticación requerido.', code: 'NO_TOKEN' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as ClientePayload;
    req.cliente = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado.', code: 'INVALID_TOKEN' });
  }
}

/**
 * Middleware: verifica API key en header X-API-Key (para ESP32 IoT).
 */
export function authenticateApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string | undefined;
  const expectedKey = process.env.IOT_API_KEY || '';

  if (!expectedKey) {
    // Fail closed — no open access without a configured key
    res.status(503).json({ error: 'Servicio IoT no configurado. Contacte al administrador.', code: 'IOT_NOT_CONFIGURED' });
    return;
  }

  if (!apiKey || apiKey !== expectedKey) {
    res.status(401).json({ error: 'API key requerida en header X-API-Key.', code: 'NO_API_KEY' });
    return;
  }

  next();
}