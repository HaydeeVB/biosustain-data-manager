/**
 * src/domain/repositories/InvoiceRepository.ts
 *
 * Interfaz del repositorio de facturas.
 */

import { Invoice } from '../entities/Invoice';

export interface InvoiceRepository {
  save(invoice: Invoice): Promise<Invoice>;
  findById(id: string): Promise<Invoice | null>;
  findByClientId(clientId: string): Promise<Invoice[]>;
  findByControlNumber(controlNumber: string): Promise<Invoice | null>;
  getNextControlNumber(): Promise<string>;
}