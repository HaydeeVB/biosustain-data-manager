/**
 * db.ts — Conexión a PostgreSQL (Cloud SQL).
 *
 * Usa variables individuales (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD)
 * o DATABASE_URL si está disponible.
 */
import { Pool, PoolClient, QueryResult } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

let pool: Pool | null = null;

export function initDb(): void {
  const dbUrl = process.env.DATABASE_URL;
  const dbHost = process.env.DB_HOST;
  const dbPort = process.env.DB_PORT || '5432';
  const dbName = process.env.DB_NAME || 'biosustain';
  const dbUser = process.env.DB_USER || 'postgres';
  const dbPassword = process.env.DB_PASSWORD;

  if (dbUrl) {
    pool = new Pool({
      connectionString: dbUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: { rejectUnauthorized: false },
    });
    console.log('[DB] Pool inicializado via DATABASE_URL');
  } else if (dbHost) {
    pool = new Pool({
      host: dbHost,
      port: parseInt(dbPort, 10),
      database: dbName,
      user: dbUser,
      password: dbPassword,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: { rejectUnauthorized: false },
    });
    console.log(`[DB] Pool inicializado: ${dbHost}:${dbPort}/${dbName}`);
  } else {
    console.warn('[DB] Sin configuración — modo demo (sin base de datos).');
  }
}

export async function query(text: string, params?: unknown[]): Promise<QueryResult> {
  if (!pool) throw new Error('Base de datos no configurada.');
  return pool.query(text, params);
}

export async function getClient(): Promise<PoolClient> {
  if (!pool) throw new Error('Base de datos no configurada.');
  return pool.connect();
}

export async function checkDbConnection(): Promise<boolean> {
  if (!pool) return false;
  try {
    const result = await pool.query('SELECT 1');
    return result.rowCount === 1;
  } catch {
    return false;
  }
}

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