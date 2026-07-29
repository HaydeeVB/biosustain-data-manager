/**
 * src/application/dtos/InvoiceDTOs.ts
 *
 * Data Transfer Objects para el caso de uso de facturación.
 */

import { InvoiceItem } from '../../domain/entities/Invoice';

export interface CreateInvoiceRequestDTO {
  clientId: string;
  clientRIF: string;
  issuerRIF: string;
  items: InvoiceItem[];
}

export interface CreateInvoiceResponseDTO {
  id: string;
  invoiceNumber: string;
  controlNumber: string;
  clientId: string;
  subtotalUSD: number;
  ivaAmountUSD: number;
  totalUSD: number;
  totalBs: number;
  exchangeRateBs: number;
  status: string;
  issuedAt: string;
}