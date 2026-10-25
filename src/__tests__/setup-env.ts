/**
 * setup-env.ts — entorno de pruebas. Se ejecuta ANTES de importar `server`.
 *
 * POR QUÉ EXISTE (2026-10-24)
 * --------------------------
 * 19 de 26 tests fallaban con `relation "clientes" does not exist`. La causa no era el
 * código: `db.ts` prefiere `DATABASE_URL`, y en esta máquina había una `DATABASE_URL`
 * heredada del entorno que apunta a OTRA base (el Supabase del portal ALBS, base
 * `postgres`, vacía). `dotenv.config()` no sobrescribe variables ya presentes, así que
 * la suite hablaba con la base equivocada y todo lo demás fallaba en cascada.
 *
 * REGLA: las pruebas usan `biosustain_test`, nunca la base de producción, y nunca
 * heredan `DATABASE_URL` del entorno. Si el nombre de la base no termina en `_test`,
 * esto lanza una excepción — preferimos una suite roja ruidosa a una que escriba en
 * producción.
 */
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const host = process.env.TEST_DB_HOST || process.env.DB_HOST || '';
const port = process.env.TEST_DB_PORT || process.env.DB_PORT || '5432';
const user = process.env.TEST_DB_USER || process.env.DB_USER || 'postgres';
const password = process.env.TEST_DB_PASSWORD || process.env.DB_PASSWORD || '';
const database = process.env.TEST_DB_NAME || 'biosustain_test';

if (!host || !password) {
  throw new Error(
    'setup-env: faltan credenciales de la base de pruebas (DB_HOST / DB_PASSWORD en .env).',
  );
}

if (!database.endsWith('_test')) {
  throw new Error(
    `setup-env: la base de pruebas debe terminar en "_test" (recibido: "${database}"). ` +
      'Abortando para no escribir en producción.',
  );
}

// La base de pruebas manda: se ignoran los valores heredados del entorno.
process.env.DB_HOST = host;
process.env.DB_PORT = port;
process.env.DB_USER = user;
process.env.DB_PASSWORD = password;
process.env.DB_NAME = database;
delete process.env.DATABASE_URL; // db.ts la prefiere sobre DB_HOST — por eso se borra

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-no-usar-en-produccion';

// Llave maestra de ingesta que usan los tests (`X-API-Key: test-key`).
process.env.IOT_API_KEY = process.env.IOT_API_KEY_TEST || 'test-key';

// El Cerebro real vive en Cloud Run. En pruebas se apunta a un stub local (lo levanta
// la suite de Cerebro) para no depender de la red ni dejar que un test llame a producción.
// Puerto alto a propósito: 8001 ya lo ocupa el servicio RAG de openclaw en esta máquina.
process.env.CEREBRO_URL = 'http://127.0.0.1:38999';
