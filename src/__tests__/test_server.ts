/**
 * test_server.ts — Tests del servidor SaaS BioSustain.
 *
 * Requisitos: la base `biosustain_test` debe existir y tener el esquema. Se aprovisiona con
 * `scripts/05_test_db.sql` (ver README). `setup-env.ts` apunta la app ahí y aborta si el
 * nombre de la base no termina en `_test`.
 */
import request from 'supertest';
import app from '../server';
import { closeDb } from '../db';

// El pool de PostgreSQL mantiene el proceso vivo; se cierra al terminar la suite para que
// `jest` salga limpio (antes avisaba "Jest did not exit one second after the test run").
afterAll(async () => {
  await closeDb();
});

describe('BioSustain SaaS API', () => {

  describe('Health', () => {
    it('GET /api/v1/health → 200 ok', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('biosustain-saas');
    });
  });

  describe('Auth', () => {
    const testEmail = `test_${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';
    let token: string;

    it('POST /api/v1/auth/register → 201 with token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          nombre: 'Productor Test',
          email: testEmail,
          password: testPassword,
          empresa: 'Granja Test C.A.',
          plan: 'basico',
        });
      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      expect(res.body.cliente.email).toBe(testEmail);
      token = res.body.token;
    });

    it('POST /api/v1/auth/register → 409 email ya existe', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          nombre: 'Otro',
          email: testEmail,
          password: testPassword,
        });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('EMAIL_EXISTS');
    });

    it('POST /api/v1/auth/register → 400 password muy corta', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          nombre: 'Test',
          email: 'short@test.com',
          password: '123',
        });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('POST /api/v1/auth/login → 200 with token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testEmail, password: testPassword });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      token = res.body.token;
    });

    it('POST /api/v1/auth/login → 401 credenciales inválidas', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testEmail, password: 'wrong-password' });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('GET /api/v1/auth/me → 200 con token válido', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      // El endpoint devuelve { cliente: {...} } — es lo que consume el panel (data.cliente).
      expect(res.body.cliente.email).toBe(testEmail);
    });

    it('GET /api/v1/auth/me → 401 sin token', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('NO_TOKEN');
    });

    it('GET /api/v1/auth/me → 401 token inválido', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token-here');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_TOKEN');
    });
  });

  describe('Cestas (multi-tenant)', () => {
    let token: string;

    beforeAll(async () => {
      const email = `cestas_${Date.now()}@example.com`;
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ nombre: 'Test Cestas', email, password: 'TestPassword123!' });
      token = res.body.token;
    });

    it('GET /api/v1/cestas → 200 con token', async () => {
      const res = await request(app)
        .get('/api/v1/cestas')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.cestas).toBeInstanceOf(Array);
    });

    it('GET /api/v1/cestas → 401 sin token', async () => {
      const res = await request(app).get('/api/v1/cestas');
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/cestas/fake-id → 404', async () => {
      const res = await request(app)
        .get('/api/v1/cestas/fake-id')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('Dashboard', () => {
    let token: string;

    beforeAll(async () => {
      const email = `dash_${Date.now()}@example.com`;
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ nombre: 'Test Dash', email, password: 'TestPassword123!' });
      token = res.body.token;
    });

    it('GET /api/v1/dashboard → 200 con estructura válida', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      // Contrato real de GET /api/v1/dashboard (lo que consume el panel): contadores
      // planos + el arreglo de cestas. Antes se afirmaba `resumen`/`metricas`, que el
      // endpoint nunca devolvió — la aserción estaba desactualizada, no el código.
      expect(typeof res.body.cestasActivas).toBe('number');
      expect(typeof res.body.totalCestas).toBe('number');
      expect(res.body.cestas).toBeInstanceOf(Array);
    });
  });

  describe('ESG', () => {
    let token: string;

    beforeAll(async () => {
      const email = `esg_${Date.now()}@example.com`;
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ nombre: 'Test ESG', email, password: 'TestPassword123!' });
      token = res.body.token;
    });

    it('GET /api/v1/esg → 200 con métricas ESG', async () => {
      const res = await request(app)
        .get('/api/v1/esg')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      // Contrato real de GET /api/v1/esg: campos planos en toneladas (lo que lee el panel).
      // `metricas` nunca existió en esta respuesta — la aserción estaba desactualizada.
      expect(typeof res.body.residuosReconvertidos).toBe('number');
      expect(typeof res.body.co2eReducido).toBe('number');
      expect(typeof res.body.totalLotes).toBe('number');
    });
  });

  describe('IoT Ingesta', () => {
    it('POST /api/v1/iot/metrics → 200 con payload válido', async () => {
      const res = await request(app)
        .post('/api/v1/iot/metrics')
        .set('X-API-Key', 'test-key')
        .send({
          device_id: 'BSF-NODE-ARAGUA-01',
          cesta_id: 'CESTA-04',
          sensores: {
            temperatura_sustrato_c: 34.5,
            humedad_sustrato_pct: 60.0,
            amoniaco_ppm: 12.5,
          },
        });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.trigger_sprinkler).toBe(true);
    });

    it('POST /api/v1/iot/metrics → 200 sin trigger (parámetros estables)', async () => {
      const res = await request(app)
        .post('/api/v1/iot/metrics')
        .set('X-API-Key', 'test-key')
        .send({
          device_id: 'BSF-NODE-ARAGUA-01',
          cesta_id: 'CESTA-04',
          sensores: {
            temperatura_sustrato_c: 26.0,
            humedad_sustrato_pct: 70.0,
          },
        });
      expect(res.status).toBe(200);
      expect(res.body.trigger_sprinkler).toBe(false);
    });

    it('POST /api/v1/iot/metrics → 400 payload inválido', async () => {
      const res = await request(app)
        .post('/api/v1/iot/metrics')
        .set('X-API-Key', 'test-key')
        .send({ invalid: 'payload' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      // El 400 dice qué nombres llegaron: sin esto, un campo mal escrito se depura a ciegas.
      expect(res.body.campos_recibidos).toBeInstanceOf(Array);
    });

    // El firmware del nodo de campo manda nombres planos en español, no el contrato
    // anidado. Aceptarlos evita una ronda de recompilación por cada despliegue.
    it('POST /api/v1/iot/metrics → acepta alias planos (cesta/nodo/tds/ph/peso/co2)', async () => {
      const res = await request(app)
        .post('/api/v1/iot/metrics')
        .set('X-API-Key', 'test-key')
        .send({
          cesta: 'CESTA-RURAL-01',
          nodo: 'NODO-RURAL-01',
          tds: 742.5,
          ph: 7.83,
          peso: 12.35,
          co2: 1180,
        });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.received_data.cesta_id).toBe('CESTA-RURAL-01');
      expect(res.body.received_data.device_id).toBe('NODO-RURAL-01');
      expect(res.body.received_data.sensores.tds_ppm).toBe(742.5);
      expect(res.body.received_data.sensores.ph).toBe(7.83);
      expect(res.body.received_data.sensores.peso_riel_kg).toBe(12.35);
      expect(res.body.received_data.sensores.co2_ppm).toBe(1180);
    });

    it('POST /api/v1/iot/metrics → tolera números enviados como texto', async () => {
      const res = await request(app)
        .post('/api/v1/iot/metrics')
        .set('X-API-Key', 'test-key')
        .send({ nodo: 'NODO-RURAL-01', cesta: 'CESTA-RURAL-01', tds: '680.0', ph: '7.4', peso: '9.8' });
      expect(res.status).toBe(200);
      expect(res.body.received_data.sensores.tds_ppm).toBe(680);
    });

    it('POST /api/v1/iot/metrics → reporta campos no reconocidos', async () => {
      const res = await request(app)
        .post('/api/v1/iot/metrics')
        .set('X-API-Key', 'test-key')
        .send({ nodo: 'NODO-RURAL-01', cesta: 'CESTA-RURAL-01', tds: 700, tds_ppm2: 999 });
      expect(res.status).toBe(200);
      expect(res.body.campos_ignorados).toContain('tds_ppm2');
    });
  });

  describe('NDA (click-wrap)', () => {
    let token: string;

    beforeAll(async () => {
      const email = `nda_${Date.now()}@example.com`;
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ nombre: 'Test NDA', email, password: 'TestPassword123!' });
      token = res.body.token;
    });

    it('GET /api/v1/nda → 200 con texto del NDA', async () => {
      const res = await request(app).get('/api/v1/nda');
      expect(res.status).toBe(200);
      expect(res.body.texto).toContain('CONFIDENCIALIDAD');
      expect(res.body.requiereAceptacion).toBe(true);
    });

    it('POST /api/v1/nda/accept → 200 acepta NDA', async () => {
      const res = await request(app)
        .post('/api/v1/nda/accept')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('POST /api/v1/nda/accept → 200 ya aceptado', async () => {
      const res = await request(app)
        .post('/api/v1/nda/accept')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    it('GET /api/v1/nda/status → 200 muestra aceptación', async () => {
      const res = await request(app)
        .get('/api/v1/nda/status')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.aceptado).toBe(true);
    });
  });

  describe('Cerebro bridge', () => {
    let token: string;
    let stub: import('http').Server;

    // El Cerebro es un servicio aparte (Python/FastAPI en Cloud Run). Sin él, este bloque
    // devolvía 502 y parecía que el bridge estaba roto. Un stub local en el puerto que
    // apunta setup-env (CEREBRO_URL) hace la prueba determinista y sin red.
    beforeAll(async () => {
      const http = await import('http');
      stub = http.createServer((req, res) => {
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', () => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ stub: true, path: req.url, biomasa_proyectada_kg: 3.42 }));
        });
      });
      await new Promise<void>((resolve) => stub.listen(38999, '127.0.0.1', () => resolve()));

      const email = `cerebro_${Date.now()}@example.com`;
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ nombre: 'Test Cerebro', email, password: 'TestPassword123!' });
      token = res.body.token;
    });

    afterAll(async () => {
      if (stub) await new Promise<void>((resolve) => stub.close(() => resolve()));
    });

    it('POST /api/v1/cerebro/biomass-projection → 200 (modo demo)', async () => {
      const res = await request(app)
        .post('/api/v1/cerebro/biomass-projection')
        .set('Authorization', `Bearer ${token}`)
        .send({
          cestaId: 'CESTA-01',
          biomasaInicialKg: 2.0,
          sustratoInicialKg: 50.0,
          temperaturaPromedio: 28.2,
          humedadPromedio: 65.4,
          diasAProyectar: 5,
        });
      expect(res.status).toBe(200);
      expect(res.body.resultado).toBeDefined();
    });

    it('POST /api/v1/cerebro/water-balance → 200 (modo demo)', async () => {
      const res = await request(app)
        .post('/api/v1/cerebro/water-balance')
        .set('Authorization', `Bearer ${token}`)
        .send({
          cestaId: 'CESTA-01',
          humedadActual: 61.2,
          temperaturaActual: 29.5,
          extractorActivo: true,
        });
      expect(res.status).toBe(200);
      expect(res.body.resultado).toBeDefined();
    });

    it('POST /api/v1/cerebro/biomass-projection → 400 params inválidos', async () => {
      const res = await request(app)
        .post('/api/v1/cerebro/biomass-projection')
        .set('Authorization', `Bearer ${token}`)
        .send({ cestaId: '', biomasaInicialKg: -1 });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('POST /api/v1/cerebro/gemini-diagnostic → 200 (modo demo)', async () => {
      const res = await request(app)
        .post('/api/v1/cerebro/gemini-diagnostic')
        .set('Authorization', `Bearer ${token}`)
        .send({
          cestaId: 'CESTA-01',
          metricas: { temperatura: 34, humedad: 55 },
          pregunta: '¿Cómo va mi lote?',
        });
      expect(res.status).toBe(200);
      expect(res.body.resultado).toBeDefined();
    });
  });

  describe('404', () => {
    it('GET /api/v1/nonexistent → 404', async () => {
      const res = await request(app).get('/api/v1/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });
  });
});