/**
 * src/application/use-cases/CreateInvoiceUseCase.ts
 *
 * Caso de uso: emitir una factura electrónica conforme al SENIAT.
 * Valida RIF del cliente, calcula IVA, obtiene tasa BCV, asigna
 * número de control, y persiste.
 */

import { Invoice, InvoiceItem, IVA_RATE } from '../../domain/entities/Invoice';
import { InvoiceRepository } from '../../domain/repositories/InvoiceRepository';
import { ExchangeRateService } from '../../domain/services/ExchangeRateService';
import { RIF } from '../../domain/value-objects/RIF';
import { CreateInvoiceRequestDTO, CreateInvoiceResponseDTO } from '../dtos/InvoiceDTOs';

export class CreateInvoiceUseCase {
  constructor(
    private invoiceRepository: InvoiceRepository,
    private exchangeRateService: ExchangeRateService,
  ) {}

  async execute(request: CreateInvoiceRequestDTO): Promise<CreateInvoiceResponseDTO> {
    // 1. Validar RIF del cliente
    if (!RIF.isValid(request.clientRIF)) {
      throw new Error(`RIF del cliente inválido: ${request.clientRIF}`);
    }

    // 2. Validar RIF del emisor
    if (!RIF.isValid(request.issuerRIF)) {
      throw new Error(`RIF del emisor inválido: ${request.issuerRIF}`);
    }

    // 3. Validar items
    if (!request.items || request.items.length === 0) {
      throw new Error('La factura debe tener al menos un ítem');
    }

    // 4. Calcular subtotal e IVA
    const { subtotal, ivaAmount, total } = this.calculateTotals(request.items);

    // 5. Obtener tasa BCV
    const exchangeRateBs = await this.exchangeRateService.getBCVRate();
    const totalBs = +(total * exchangeRateBs).toFixed(2);

    // 6. Asignar número de control
    const controlNumber = await this.invoiceRepository.getNextControlNumber();

    // 7. Crear factura
    const now = new Date();
    const invoice: Invoice = {
      id: this.generateId(),
      invoiceNumber: this.generateInvoiceNumber(),
      controlNumber,
      clientId: request.clientId,
      clientRIF: request.clientRIF,
      issuerRIF: request.issuerRIF,
      items: request.items,
      subtotalUSD: subtotal,
      ivaAmountUSD: ivaAmount,
      totalUSD: total,
      totalBs,
      exchangeRateBs,
      status: 'ISSUED',
      issuedAt: now,
      createdAt: now,
    };

    // 8. Persistir
    const saved = await this.invoiceRepository.save(invoice);

    return {
      id: saved.id,
      invoiceNumber: saved.invoiceNumber,
      controlNumber: saved.controlNumber,
      clientId: saved.clientId,
      subtotalUSD: saved.subtotalUSD,
      ivaAmountUSD: saved.ivaAmountUSD,
      totalUSD: saved.totalUSD,
      totalBs: saved.totalBs,
      exchangeRateBs: saved.exchangeRateBs,
      status: saved.status,
      issuedAt: saved.issuedAt.toISOString(),
    };
  }

  private calculateTotals(items: InvoiceItem[]): {
    subtotal: number; ivaAmount: number; total: number;
  } {
    const subtotal = items.reduce((sum, item) => {
      return sum + (item.quantity * item.unitPriceUSD);
    }, 0);

    // IVA por ítem (algunos pueden tener tasa 0 — exentos)
    const ivaAmount = items.reduce((sum, item) => {
      return sum + (item.quantity * item.unitPriceUSD * item.ivaRate);
    }, 0);

    const total = subtotal + ivaAmount;

    return {
      subtotal: +subtotal.toFixed(2),
      ivaAmount: +ivaAmount.toFixed(2),
      total: +total.toFixed(2),
    };
  }

  private generateId(): string {
    return `inv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateInvoiceNumber(): string {
    // Formato SENIAT: N-000000NNN
    const seq = String(Math.floor(Math.random() * 99999999)).padStart(8, '0');
    return `N-${seq}`;
  }
}