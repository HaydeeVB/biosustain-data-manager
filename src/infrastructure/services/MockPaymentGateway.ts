/**
 * src/infrastructure/services/MockPaymentGateway.ts
 *
 * Mock del gateway de pago — para desarrollo y pruebas.
 * En producción se sustituye por Stripe/PayPal/MercadoPago.
 */

import { PaymentGateway } from '../../domain/services/PaymentGateway';

export class MockPaymentGateway implements PaymentGateway {
  private validReferences: Set<string> = new Set();

  async verifyPayment(reference: string): Promise<boolean> {
    // En mock, cualquier referencia que empiece con "pay_" es válida
    return reference.startsWith('pay_');
  }

  async processPayment(amount: number, currency: string): Promise<string> {
    const reference = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.validReferences.add(reference);
    return reference;
  }
}