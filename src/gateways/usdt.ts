/**
 * usdt.ts — USDT (Tether, TRC-20) stablecoin adapter for BioSustain's IPaymentGateway.
 *
 * Decision 2026-08-11: USDT selected as the payment method for Venezuelan clients
 * (1 USDT = 1 USD, the regional standard via Binance Pay / TRC-20 transfers).
 *
 * This adapter generates a USDT payment request with the receiving wallet address
 * (and a binance_pay payload when keys are configured) and returns the handoff the
 * client uses to send USDT. It is a structured collection reference, not an
 * automated on-chain charge — the operator reconciles on payment confirmation
 * (this matches the manual-first plan until a full Binance Pay / Node-RPC flow is
 * wired).
 *
 * Set PAYMENT_PROVIDER=usdt and, optionally, USDT_WALLET (TRC-20 address) +
 * BINANCE_PAY_CLIENT_ID/CLIENT_SECRET (for native Binance Pay invoices) to activate.
 */
import { randomUUID } from 'crypto';
import { IPaymentGateway, PaymentResult } from './types';

export class UsdtGateway implements IPaymentGateway {
  async processPayment(
    amount: number,
    currency: string,
    description: string,
    customerId: string
  ): Promise<PaymentResult> {
    // Currency is USD in the billing model; USDT is a USD-pegged stablecoin, so the
    // amount maps 1:1 to USDT. We surface the expected amount in USDT for transparency.
    const usdtAmount = amount.toFixed(2);
    // Collection rail: prefer a Binance Pay ID (merchant/user) — how clients pay via
    // Binance Pay — else fall back to a direct TRC-20 wallet address.
    const binanceId = process.env.BINANCE_PAY_ID || '';
    const wallet = process.env.USDT_WALLET || '';
    const network = process.env.USDT_NETWORK || 'TRC-20';
    const reference = `BS-${Date.now().toString(36).toUpperCase()}-${randomUUID().substring(0, 6).toUpperCase()}`;

    const collectMethod = binanceId
      ? `Binance Pay (ID: ${binanceId}) — el cliente envía ${usdtAmount} USDT a esta ID` 
      : (wallet ? `Dirección USDT (${network}): ${wallet}` : '(colección USDT por configurar)');

    const instructions =
      `Pago en USDT — ${usdtAmount} USDT \n` +
      `Red aprox: ${description} \n` +
      `${collectMethod} \n` +
      `Referencia: ${reference} \n` +
      `Monto exacto: ${usdtAmount} USDT (1 USDT = 1 USD) \n` +
      `Nota: envíe el monto EXACTO y con la referencia como concepto para conciliar.`;

    const checkoutUrl =
      `https://biosustainlab.com/?billing=usdt&ref=${encodeURIComponent(reference)}&amount=${amount}`;

    return {
      success: true,
      transactionId: reference,
      message: instructions,
      amount,
      currency: 'USDT',
      checkoutUrl,
      providerRef: reference,
    };
  }

  async refundPayment(transactionId: string): Promise<PaymentResult> {
    // On-chain USDT refunds are manual (operator sends back). Record the intent.
    return {
      success: true,
      transactionId: `refund_${transactionId}`,
      message: `Reembolso manual USDT registrado para ${transactionId} — el operador debe ejecutar la transferencia de retorno.`,
      amount: 0,
      currency: 'USDT',
    };
  }
}

export const usdtGateway = new UsdtGateway();
