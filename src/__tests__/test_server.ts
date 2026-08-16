/**
 * test_server.ts — Tests del servidor SaaS BioSustain.
 */
import request from 'supertest';
import app from '../server';

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
      expect(res.body.email).toBe(testEmail);
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
      expect(res.body.resumen).toBeDefined();
      expect(res.body.metricas).toBeDefined();
      expect(res.body.alertas).toBeInstanceOf(Array);
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
      expect(res.body.metricas).toBeDefined();
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

    beforeAll(async () => {
      const email = `cerebro_${Date.now()}@example.com`;
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ nombre: 'Test Cerebro', email, password: 'TestPassword123!' });
      token = res.body.token;
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