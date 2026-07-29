/**
 * src/domain/entities/Subscription.ts
 *
 * Entidad de suscripción — representa el plan contratado por un cliente.
 */

export type SubscriptionPlan = 'BASIC' | 'PRO' | 'ENTERPRISE';
export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'PENDING';

export interface Subscription {
  id: string;
  clientId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  startDate: Date;
  endDate: Date;
  paymentReference: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Duración de cada plan en días. */
export const PLAN_DURATION_DAYS: Record<SubscriptionPlan, number> = {
  BASIC: 30,
  PRO: 30,
  ENTERPRISE: 30,
};

/** Precios de cada plan en USD. */
export const PLAN_PRICE_USD: Record<SubscriptionPlan, number> = {
  BASIC: 49,
  PRO: 149,
  ENTERPRISE: 499,
};