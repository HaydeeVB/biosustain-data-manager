/**
 * Shared gateway types for BioSustain payment adapters.
 *
 * All adapters (mock, stripe, zinli) implement IPaymentGateway with the SAME
 * contract, so switching providers is a one-line PAYMENT_PROVIDER change —
 * no billing-route changes needed. See factory: src/gateways/index.ts
 */

export interface PaymentResult {
  success: boolean;
  transactionId: string;
  message: string;
  amount: number;
  currency: string;
  /** Optional: URL the client should be redirected to (hosted checkout). */
  checkoutUrl?: string;
  /** Optional: provider order/reference for reconciliation. */
  providerRef?: string;
}

export interface IPaymentGateway {
  processPayment(
    amount: number,
    currency: string,
    description: string,
    customerId: string
  ): Promise<PaymentResult>;
  refundPayment(transactionId: string): Promise<PaymentResult>;
}
