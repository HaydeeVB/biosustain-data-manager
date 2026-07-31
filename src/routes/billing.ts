/**
 * billing.ts — Rutas de facturación y suscripciones.
 *
 * POST /api/v1/billing/subscribe    → crear suscripción (MercadoPago/Stripe)
 * GET  /api/v1/billing/subscription → estado de la suscripción del cliente
 * POST /api/v1/billing/cancel       → cancelar suscripción
 * GET  /api/v1/billing/plans        → planes disponibles
 * POST /api/v1/billing/checkout-haas → checkout Hardware-as-a-Service (compra de cestas)
 *
 * Planes:
 *   basico    — 1 cesta, dashboard básico
 *   pro       — múltiples cestas, analytics, ESG reports
 *   enterprise — API access, custom, soporte prioritario
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth';
import { query, isDbConfigured } from '../db';

const router = Router();

// ── Planes ────────────────────────────────────────────────────────────────────

const PLANES = {
  basico: {
    nombre: 'Básico',
    precioMensual: 15, // USD
    cestas: 1,
    features: ['Dashboard básico', 'Telemetría en tiempo real', '1 cesta incluida'],
    promoLanzamiento: '15 USD total por los primeros 3 meses',
  },
  pro: {
    nombre: 'Pro',
    precioMensual: 45,
    cestas: 10,
    features: ['Todo lo de Básico', 'Múltiples cestas (hasta 10)', 'Analytics avanzado', 'Reportes ESG', 'Proyección de biomasa', 'Diagnóstico con IA'],
  },
  enterprise: {
    nombre: 'Enterprise',
    precioMensual: 150,
    cestas: -1, // ilimitado
    features: ['Todo lo de Pro', 'Cestas ilimitadas', 'Acceso API', 'Soporte prioritario', 'Personalización', 'Multi-planta'],
  },
};

// ── Hardware-as-a-Service ─────────────────────────────────────────────────────

const PRECIO_CESTA = 120; // USD por cesta (cost $40-55, margen $65-80)
const PRECIO_CESTA_RETAIL = 150; // Precio premium

// ── Esquemas ──────────────────────────────────────────────────────────────────

const subscribeSchema = z.object({
  plan: z.enum(['basico', 'pro', 'enterprise']),
  provider: z.enum(['mercadopago', 'stripe', 'mock']).default('mock'),
});

const checkoutHaasSchema = z.object({
  cantidadCestas: z.number().int().min(1).max(100),
  incluyeInstalacion: z.boolean().default(false),
  precioPorCesta: z.number().min(40).max(200).default(PRECIO_CESTA),
});

// ── Almacenamiento en memoria ────────────────────────────────────────────────

interface Subscription {
  id: string;
  clienteId: string;
  plan: string;
  estado: string;
  provider: string;
  inicio: Date;
  montoMensual: number;
  moneda: string;
}

const subscriptionsEnMemoria: Map<string, Subscription> = new Map();

// ── Endpoints ──────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/billing/plans
 * Devuelve los planes disponibles (no requiere auth).
 */
router.get('/plans', (_req: Request, res: Response) => {
  res.json({ planes: PLANES });
});

/**
 * POST /api/v1/billing/subscribe
 * Crea una suscripción para el cliente autenticado.
 */
router.post('/subscribe', authenticateToken, async (req: Request, res: Response) => {
  const parseResult = subscribeSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Plan inválido.', code: 'VALIDATION_ERROR' });
    return;
  }

  const clienteId = req.cliente?.clienteId;
  if (!clienteId) {
    res.status(401).json({ error: 'No autenticado.', code: 'NOT_AUTHENTICATED' });
    return;
  }

  const { plan, provider } = parseResult.data;
  const planInfo = PLANES[plan as keyof typeof PLANES];

  const subId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const subscription: Subscription = {
    id: subId,
    clienteId,
    plan,
    estado: 'pendiente', // Pendiente hasta confirmación del provider
    provider,
    inicio: new Date(),
    montoMensual: planInfo.precioMensual,
    moneda: 'USD',
  };

  subscriptionsEnMemoria.set(subId, subscription);

  // TODO: Crear suscripción real en MercadoPago/Stripe
  // When MercadoPago sandbox keys available, swap mock for real gateway
  if (provider === 'mock') {
    const { mockGateway } = await import('../gateways/mock-gateway');
    const promoActiva = plan === 'basico';
    const montoAPagar = promoActiva ? 15 : planInfo.precioMensual;
    const payment = await mockGateway.processPayment(
      montoAPagar,
      'USD',
      `Suscripción ${planInfo.nombre} — ${promoActiva ? 'Promo lanzamiento (3 meses)' : 'Mensual'}`,
      clienteId
    );
    if (payment.success) {
      subscription.estado = 'activa';
      subscription.montoMensual = montoAPagar;
    }
  }

  res.json({
    subscriptionId: subId,
    plan,
    precioMensual: planInfo.precioMensual,
    promoLanzamiento: plan === 'basico' ? '15 USD total por los primeros 3 meses' : null,
    moneda: 'USD',
    provider,
    estado: subscription.estado,
    // En producción: redirect URL del provider para completar pago
    checkoutUrl: provider === 'mercadopago'
      ? `https://www.mercadopago.com/checkout/demo?plan=${plan}&amount=${planInfo.precioMensual}`
      : `https://checkout.stripe.com/demo?plan=${plan}&amount=${planInfo.precioMensual}`,
  });
});

/**
 * GET /api/v1/billing/subscription
 * Devuelve el estado de la suscripción del cliente.
 */
router.get('/subscription', authenticateToken, (req: Request, res: Response) => {
  const clienteId = req.cliente?.clienteId;
  if (!clienteId) {
    res.status(401).json({ error: 'No autenticado.', code: 'NOT_AUTHENTICATED' });
    return;
  }

  const sub = Array.from(subscriptionsEnMemoria.values())
    .find(s => s.clienteId === clienteId);

  if (!sub) {
    res.json({ tieneSuscripcion: false });
    return;
  }

  res.json({
    tieneSuscripcion: true,
    subscriptionId: sub.id,
    plan: sub.plan,
    estado: sub.estado,
    provider: sub.provider,
    montoMensual: sub.montoMensual,
    moneda: sub.moneda,
    inicio: sub.inicio.toISOString(),
  });
});

/**
 * POST /api/v1/billing/cancel
 * Cancela la suscripción del cliente.
 */
router.post('/cancel', authenticateToken, (req: Request, res: Response) => {
  const clienteId = req.cliente?.clienteId;
  if (!clienteId) {
    res.status(401).json({ error: 'No autenticado.', code: 'NOT_AUTHENTICATED' });
    return;
  }

  const sub = Array.from(subscriptionsEnMemoria.values())
    .find(s => s.clienteId === clienteId);

  if (!sub) {
    res.status(404).json({ error: 'No tiene suscripción activa.', code: 'NO_SUBSCRIPTION' });
    return;
  }

  sub.estado = 'cancelada';

  // TODO: Cancelar en el provider (MercadoPago/Stripe)
  res.json({ ok: true, message: 'Suscripción cancelada.', subscriptionId: sub.id });
});

/**
 * POST /api/v1/billing/checkout-haas
 * Checkout para compra de cestas (Hardware-as-a-Service).
 */
router.post('/checkout-haas', authenticateToken, async (req: Request, res: Response) => {
  const parseResult = checkoutHaasSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Parámetros inválidos.', code: 'VALIDATION_ERROR' });
    return;
  }

  const clienteId = req.cliente?.clienteId;
  if (!clienteId) {
    res.status(401).json({ error: 'No autenticado.', code: 'NOT_AUTHENTICATED' });
    return;
  }

  const { cantidadCestas, incluyeInstalacion, precioPorCesta } = parseResult.data;
  const subtotal = cantidadCestas * precioPorCesta;
  const instalacion = incluyeInstalacion ? cantidadCestas * 25 : 0; // $25/cesta instalación
  const total = subtotal + instalacion;

  const orderId = `haas_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  res.json({
    orderId,
    items: {
      cestas: cantidadCestas,
      precioPorCesta,
      incluyeInstalacion,
    },
    desglose: {
      subtotal,
      instalacion,
      total,
      moneda: 'USD',
    },
    // En producción: crear preferencia en MercadoPago
    checkoutUrl: `https://www.mercadopago.com/checkout/demo?order=${orderId}&amount=${total}`,
    estimacionEntrega: '2-3 semanas (Venezuela)',
  });
});

export default router;