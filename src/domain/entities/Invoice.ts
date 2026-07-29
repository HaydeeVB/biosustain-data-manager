/**
 * src/domain/entities/Invoice.ts
 *
 * Entidad de factura — representa una factura electrónica conforme
 * a la normativa SENIAT de Venezuela.
 */

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'CANCELLED' | 'PAID';

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPriceUSD: number;
  ivaRate: number; // 0.16 para tasa general
}

export interface Invoice {
  id: string;
  invoiceNumber: string;     // Número de factura SENIAT
  controlNumber: string;     // Número de control asignado
  clientId: string;
  clientRIF: string;         // RIF del cliente (formato VEJPG-XXXXXXXX-X)
  issuerRIF: string;         // RIF del emisor
  items: InvoiceItem[];
  subtotalUSD: number;
  ivaAmountUSD: number;
  totalUSD: number;
  totalBs: number;           // Total en Bolívares (conversión BCV)
  exchangeRateBs: number;    // Tasa BCV al momento de emisión
  status: InvoiceStatus;
  issuedAt: Date;
  createdAt: Date;
}

/** Tasa de IVA general en Venezuela (16%). */
export const IVA_RATE = 0.16;