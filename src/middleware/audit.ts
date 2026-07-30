/**
 * audit.ts — Middleware de audit logging.
 *
 * Registra cada acción del cliente en la tabla audit_log.
 * Permite detección de scraping y análisis de comportamiento.
 * (Requisito del documento de arquitectura: Servidor.pdf)
 */
import { Request, Response, NextFunction } from 'express';
import { query, isDbConfigured } from '../db';

// Almacenamiento en memoria (modo demo)
interface AuditEntry {
  id: number;
  clienteId: string;
  accion: string;
  endpoint: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  detalles: Record<string, unknown>;
}

const auditLogEnMemoria: AuditEntry[] = [];
let auditCounter = 0;

// Detección de scraping: más de N requests/minuto del mismo cliente
const requestCounts: Map<string, { count: number; windowStart: number }> = new Map();
const SCRAPING_THRESHOLD = 60; // 60 requests por minuto = scraping
const WINDOW_MS = 60_000;

/**
 * Middleware que registra cada request en el audit log.
 */
export async function auditLog(req: Request, res: Response, next: NextFunction): Promise<void> {
  const clienteId = req.cliente?.clienteId || 'anonymous';
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  const endpoint = `${req.method} ${req.path}`;

  // Detección de scraping
  const now = Date.now();
  const entry = requestCounts.get(clienteId);
  if (entry) {
    if (now - entry.windowStart > WINDOW_MS) {
      // Reset window
      requestCounts.set(clienteId, { count: 1, windowStart: now });
    } else {
      entry.count++;
      if (entry.count > SCRAPING_THRESHOLD) {
        res.status(429).json({
          error: 'Actividad inusual detectada. Acceso temporalmente suspendido.',
          code: 'SCRAPING_DETECTED',
        });
        return;
      }
    }
  } else {
    requestCounts.set(clienteId, { count: 1, windowStart: now });
  }

  // Registrar en audit log
  const auditEntry: AuditEntry = {
    id: ++auditCounter,
    clienteId,
    accion: req.method,
    endpoint,
    ipAddress: ip,
    userAgent,
    timestamp: new Date(),
    detalles: { body: req.body ? Object.keys(req.body) : [] },
  };

  // Guardar en memoria
  auditLogEnMemoria.push(auditEntry);

  // Guardar en DB si está configurada
  if (isDbConfigured()) {
    try {
      await query(
        `INSERT INTO audit_log (cliente_id, accion, endpoint, ip_address, user_agent, detalles)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [clienteId, auditEntry.accion, auditEntry.endpoint,
         auditEntry.ipAddress, auditEntry.userAgent,
         JSON.stringify(auditEntry.detalles)]
      );
    } catch {
      // No fallar el request por error de audit log
    }
  }

  next();
}

/**
 * Devuelve el audit log (solo admin).
 */
export function getAuditLog(limit: number = 100): AuditEntry[] {
  return auditLogEnMemoria.slice(-limit);
}