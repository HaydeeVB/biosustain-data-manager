/**
 * ves.ts — Bolívares (VES) / Pago Móvil adapter for BioSustain's IPaymentGateway.
 *
 * Strategy (2026-08-11, Wiston): local farmers prefer paying in Bolívares via Pago
 * Móvil (instant local bank transfer) rather than USDT. By law prices in VES use the
 * official BCV rate, but converting VES back to USDT on the open market loses
 * 12-20%. So the VES option is priced with a +3 USD-equivalent buffer:
 *
 *   Base USDT plan $15  ->  VES price $18-equivalent (at BCV rate).
 *   The +$3 buffer absorbs the currency spread + P2P fees, so after conversion
 *   BioSustain still nets ~$15 USDT (no margin loss).
 *
 * This adapter generates the Pago Móvil payment handoff: the bank, phone/CI, and the
 * VES amount (computed from the USD-equivalent at BCV rate, which is passed in or
 * fetched from BCV). The operator reconciles on the instant transfer.
 *
 * Set PAYMENT_PROVIDER=ves and, optionally, VES_BANK / VES_PHONE / VES_RIF to activate.
 * The USD->VES conversion uses a rate parameter (prefer provider = official BCV); if
 * none, the caller passes vesRate or it defaults with a warning.
 */
import { randomUUID } from 'crypto';
import { IPaymentGateway, PaymentResult } from './types';

// USD-equivalent price charged in VES (USDT base + buffer to absorb FX spread).
// Per plan, the caller passes the base USD amount; we apply the +$3 buffer for VES.
export const VES_USD_BUFFER = 3.0;

export class VesGateway implements IPaymentGateway {
  async processPayment(
    amount: number,          // base USD amount (e.g. 15 for basic)
    _currency: string,       // caller sends 'USD' — we quote in VES
    description: string,
    customerId: string
  ): Promise<PaymentResult> {
    // VES price = (base USD + buffer) converted at the official BCV rate.
    // rate: Fetched from BCV (recommended) or provided via env/caller. Here we read
    // from env so the platform can keep it fresh; a real impl calls BCV's API.
    const vesRate = parseFloat(process.env.BCV_RATE || '0');   // VES per USD
    const vesUsd = amount + VES_USD_BUFFER;                    // e.g. 15 + 3 = 18
    const vesAmount = vesRate > 0 ? vesUsd * vesRate : NaN;

    const bank = process.env.VES_BANK || 'Banco de Venezuela (0102)';
    const phone = process.env.VES_PHONE || '0412-8485662';
    const ci = process.env.VES_CEDULA || '31.116.955';
    const reference = `VES-${Date.now().toString(36).toUpperCase()}-${randomUUID().substring(0, 6).toUpperCase()}`;

    const amountStr = Number.isNaN(vesAmount)
      ? 'no disponible (configure BCV_RATE)'
      : vesAmount.toLocaleString('es-VE', { maximumFractionDigits: 2 });

    const instructions =
      `Pago en Bolívares (Pago Móvil) — ${description} \n` +
      `Monto en USD (con búfer de 3 USD): ${vesUsd.toFixed(2)} USD \n` +
      `Tasa BCV (VES/USD): ${vesRate > 0 ? vesRate.toFixed(2) : 'no configurada'} \n` +
      `Monto a pagar en Bolívares: Bs. ${amountStr} \n` +
      `Banco: ${bank} \n` +
      `Teléfono/Banco (Pago Móvil): ${phone} \n` +
      `Cédula/RIF: ${ci} \n` +
      `Referencia: ${reference} \n` +
      `Nota: el búfer de 3 USD cubre la diferencia Tasa BCV vs mercado P2P (12-20%) para no perder margen.`;

    const checkoutUrl =
      `https://biosustain-dashboard-683265952295.us-central1.run.app/?billing=ves&ref=${encodeURIComponent(reference)}&usd=${vesUsd}`;

    return {
      success: true,
      transactionId: reference,
      message: instructions,
      amount: vesUsd,             // USD-equivalent quoted (incl. buffer)
      currency: 'VES',
      checkoutUrl,
      providerRef: reference,
    };
  }

  async refundPayment(transactionId: string): Promise<PaymentResult> {
    // Pago Móvil refunds are manual reverse transfers.
    return {
      success: true,
      transactionId: `refund_${transactionId}`,
      message: `Reembolso manual Bolívares registrado para ${transactionId} — el operador debe ejecutar la transferencia de retorno.`,
      amount: 0,
      currency: 'VES',
    };
  }
}

export const vesGateway = new VesGateway();
