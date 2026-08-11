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

/**
 * Resolve a gateway. Pass an explicit `providerName` to select a specific rail
 * (e.g. a client choosing 'ves' Pago Móvil over 'usdt' USDT). With no arg, uses the
 * PAYMENT_PROVIDER env (the "default/live" rail). Unknown → mock (safe).
 */
export function getGateway(providerName?: string): IPaymentGateway {
  const provider = (providerName || process.env.PAYMENT_PROVIDER || 'mock').toLowerCase();
  const gateway = providers[provider];
  if (!gateway) {
    console.warn(`[Payments] Unknown provider "${provider}", falling back to mock`);
    return mockGateway;
  }
  return gateway;
}

/** Active provider name (for reporting / checkout URL logic at the route). */
export function getProviderName(providerName?: string): string {
  const provider = (providerName || process.env.PAYMENT_PROVIDER || 'mock').toLowerCase();
  return provider in providers ? provider : 'mock';
}
