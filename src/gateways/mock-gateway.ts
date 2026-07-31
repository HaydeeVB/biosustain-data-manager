/**
 * mock-gateway.ts — Mock Payment Gateway for BioSustain SaaS.
 *
 * MercadoPago is blocked for Venezuelan accounts. This mock allows
 * full subscription workflow testing on Cloud Run without a real
 * payment processor. Implements IPaymentGateway interface.
 *
 * When MercadoPago sandbox keys are available (Mexico/Argentina/Colombia),
 * swap this for mercadopago.ts with the same interface.
 */
import { randomUUID } from 'crypto';

export interface PaymentResult {
  success: boolean;
  transactionId: string;
  message: string;
  amount: number;
  currency: string;
}

export interface IPaymentGateway {
  processPayment(amount: number, currency: string, description: string, customerId: string): Promise<PaymentResult>;
  refundPayment(transactionId: string): Promise<PaymentResult>;
}

export class MockPaymentGateway implements IPaymentGateway {
  private transactions: Map<string, PaymentResult> = new Map();

  async processPayment(
    amount: number,
    currency: string,
    description: string,
    customerId: string
  ): Promise<PaymentResult> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Always succeeds in mock mode
    const transactionId = `mock_${randomUUID().substring(0, 12)}`;
    const result: PaymentResult = {
      success: true,
      transactionId,
      message: `Mock payment processed: ${description}`,
      amount,
      currency,
    };

    this.transactions.set(transactionId, result);
    console.log(`[MockGateway] Payment processed for ${customerId}: ${amount} ${currency} (${transactionId})`);
    return result;
  }

  async refundPayment(transactionId: string): Promise<PaymentResult> {
    const original = this.transactions.get(transactionId);
    if (!original) {
      return {
        success: false,
        transactionId,
        message: 'Transaction not found',
        amount: 0,
        currency: 'USD',
      };
    }

    const result: PaymentResult = {
      success: true,
      transactionId: `refund_${randomUUID().substring(0, 12)}`,
      message: `Refund processed for ${transactionId}`,
      amount: original.amount,
      currency: original.currency,
    };

    console.log(`[MockGateway] Refund processed for ${transactionId}`);
    return result;
  }

  // Get transaction status (for admin/audit)
  getTransaction(transactionId: string): PaymentResult | undefined {
    return this.transactions.get(transactionId);
  }

  // List all transactions (for admin/audit)
  listTransactions(): PaymentResult[] {
    return Array.from(this.transactions.values());
  }
}

// Singleton instance
export const mockGateway = new MockPaymentGateway();