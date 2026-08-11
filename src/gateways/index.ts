/**
 * Gateway factory — resolves the active BioSustain payment gateway from env.
 *
 *   PAYMENT_PROVIDER=mock   (default, dev/testing — always succeeds)
 *   PAYMENT_PROVIDER=stripe (card payments via Stripe Checkout — needs STRIPE_SECRET_KEY,
 *                           works behind a US entity)
 *   PAYMENT_PROVIDER=zinli  (regional transfer/pago móvil — for Venezuelan settlement)
 *
 * All implement the same IPaymentGateway, so the billing route calls getGateway()
 * and the provider can be swapped with one env change — no code changes.
 */
import { IPaymentGateway } from './types';
import { mockGateway } from './mock-gateway';
import { stripeGateway } from './stripe';
import { zinliGateway } from './zinli';
import { usdtGateway } from './usdt';
import { vesGateway } from './ves';

export type * from './types';
export type { IPaymentGateway, PaymentResult } from './types';

const providers: Record<string, IPaymentGateway> = {
  mock: mockGateway,
  stripe: stripeGateway,
  zinli: zinliGateway,
  usdt: usdtGateway,
  ves: vesGateway,
};

/** Resolve the active gateway. Unknown provider falls back to mock (safe default). */
export function getGateway(): IPaymentGateway {
  const provider = (process.env.PAYMENT_PROVIDER || 'mock').toLowerCase();
  const gateway = providers[provider];
  if (!gateway) {
    console.warn(`[Payments] Unknown PAYMENT_PROVIDER "${provider}", falling back to mock`);
    return mockGateway;
  }
  return gateway;
}

/** Active provider name (for reporting / checkout URL logic at the route). */
export function getProviderName(): string {
  const provider = (process.env.PAYMENT_PROVIDER || 'mock').toLowerCase();
  return provider in providers ? provider : 'mock';
}
