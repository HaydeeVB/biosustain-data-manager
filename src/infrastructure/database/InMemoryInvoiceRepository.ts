/**
 * src/infrastructure/database/InMemoryInvoiceRepository.ts
 *
 * Implementación en memoria del repositorio de facturas.
 * Genera números de control secuenciales conforme al SENIAT.
 */

import { Invoice } from '../../domain/entities/Invoice';
import { InvoiceRepository } from '../../domain/repositories/InvoiceRepository';

export class InMemoryInvoiceRepository implements InvoiceRepository {
  private invoices: Map<string, Invoice> = new Map();
  private controlCounter: number = 1;

  async save(invoice: Invoice): Promise<Invoice> {
    this.invoices.set(invoice.id, { ...invoice });
    return invoice;
  }

  async findById(id: string): Promise<Invoice | null> {
    return this.invoices.get(id) ?? null;
  }

  async findByClientId(clientId: string): Promise<Invoice[]> {
    return Array.from(this.invoices.values()).filter(i => i.clientId === clientId);
  }

  async findByControlNumber(controlNumber: string): Promise<Invoice | null> {
    return (
      Array.from(this.invoices.values()).find(i => i.controlNumber === controlNumber) ?? null
    );
  }

  async getNextControlNumber(): Promise<string> {
    // Formato SENIAT: CL-NNNNNNNN (8 dígitos)
    const num = String(this.controlCounter).padStart(8, '0');
    this.controlCounter++;
    return `CL-${num}`;
  }
}