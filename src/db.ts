/**
 * db.ts — Conexión a TimescaleDB (PostgreSQL).
 *
 * Pool de conexiones con manejo de errores.
 * Si DATABASE_URL no está configurada, usa modo demo (en memoria).
 */
import { Pool, PoolClient, QueryResult } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

let pool: Pool | null = null;

/**
 * Inicializa el pool de conexiones si DATABASE_URL está configurada.
 */
export function initDb(): void {
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    pool = new Pool({
      connectionString: dbUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    console.log('[DB] Pool de conexiones inicializado.');
  } else {
    console.warn('[DB] DATABASE_URL no configurada — modo demo (sin base de datos real).');
  }
}

/**
 * Ejecuta una consulta SQL.
 * Si no hay pool, lanza error.
 */
export async function query(text: string, params?: unknown[]): Promise<QueryResult> {
  if (!pool) {
    throw new Error('Base de datos no configurada. Set DATABASE_URL en .env');
  }
  return pool.query(text, params);
}

/**
 * Obtiene un cliente del pool (para transacciones).
 */
export async function getClient(): Promise<PoolClient> {
  if (!pool) {
    throw new Error('Base de datos no configurada. Set DATABASE_URL en .env');
  }
  return pool.connect();
}

/**
 * Verifica la conexión a la base de datos.
 */
export async function checkDbConnection(): Promise<boolean> {
  if (!pool) return false;
  try {
    const result = await pool.query('SELECT 1');
    return result.rowCount === 1;
  } catch {
    return false;
  }
}

/**
 * Cierra el pool de conexiones.
 */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[DB] Pool cerrado.');
  }
}

export function isDbConfigured(): boolean {
  return pool !== null;
}