/**
 * zinli.ts — Zinli / regional transfer adapter for BioSustain's IPaymentGateway.
 *
 * Drop-in for markets where card processors are blocked (Venezuela). Zinli is a
 * digital wallet with a virtual card; regional transfer (pago móvil / bank
 * transfer) is how subscriptions actually settle locally.
 *
 * This adapter generates a payment REFERENCE + manual transfer instructions and
 * returns them as the checkout URL (a link the customer uses to complete the
 * transfer). It is a structured handoff, not an automated card charge — the
 * operator reconciles payment on confirmation.
 *
 * Set PAYMENT_PROVIDER=zinli and ZINLI_VENDOR_ID (optional) to activate.
 */
import { randomUUID } from 'crypto';
import { IPaymentGateway, PaymentResult } from './types';

// Default operator account details for the transfer (Bank/Venezuela mobile-payment).
// Set via env in production. Values defaulted to Wiston's live endpoints (2026-08-11).
const DEFAULT_ZINLI_ACCOUNT = {
  bank: process.env.ZINLI_BANK || 'Banco de Venezuela (0102)',
  accountHolder: process.env.ZINLI_ACCOUNT_HOLDER || 'Wiston Viteri (BioSustain)',
  rif: process.env.ZINLI_RIF || '31.116.955',
  phone: process.env.ZINLI_PHONE || '0412-8485662',
};

export class ZinliGateway implements IPaymentGateway {
  async processPayment(
    amount: number,
    currency: string,
    description: string,
    customerId: string
  ): Promise<PaymentResult> {
    // Generate a human + machine readable payment reference for reconciliation
    const reference = `BS-${Date.now().toString(36).toUpperCase()}-${randomUUID().substring(0, 6).toUpperCase()}`;

    // Instructions the customer sees to complete the regional transfer
    const instructions =
      `Pago por transferencia/pago móvil ${currency} ${amount.toFixed(2)} \n` +
      `Referencia: ${reference} \n` +
      `Banco: ${DEFAULT_ZINLI_ACCOUNT.bank} \n` +
      `Titular: ${DEFAULT_ZINLI_ACCOUNT.accountHolder} \n` +
      `RIF: ${DEFAULT_ZINLI_ACCOUNT.rif} \n` +
      `Teléfono pago móvil: ${DEFAULT_ZINLI_ACCOUNT.phone} \n` +
      `Concepto: ${description} (cliente ${customerId})`;

    // checkoutUrl doubles as the "complete payment" handoff — for regional we encode
    // the reference so a copy-paste link carries the payment context.
    const checkoutUrl = `https://biosustain-dashboard-683265952295.us-central1.run.app/?billing=transfer&ref=${encodeURIComponent(reference)}&amount=${amount}`;

    return {
      success: true,
      transactionId: reference,
      message: instructions,
      amount,
      currency: currency.toUpperCase(),
      checkoutUrl,
      providerRef: reference,
    };
  }

  async refundPayment(transactionId: string): Promise<PaymentResult> {
    // Regional transfers are manual — a "refund" is a reverse transfer handled by
    // the operator. Record the intent; no automated API.
    return {
      success: true,
      transactionId: `refund_${transactionId}`,
      message: `Reembolso manual registrado para ${transactionId} — el operador debe ejecutar la transferencia de retorno.`,
      amount: 0,
      currency: 'USD',
    };
  }
}

export const zinliGateway = new ZinliGateway();
