/**
 * src/presentation/controllers/InvoiceController.ts
 *
 * Controlador para endpoints de facturación.
 */

import { CreateInvoiceUseCase } from '../../application/use-cases/CreateInvoiceUseCase';
import { CreateInvoiceRequestDTO } from '../../application/dtos/InvoiceDTOs';

export class InvoiceController {
  constructor(private createInvoiceUseCase: CreateInvoiceUseCase) {}

  async create(request: CreateInvoiceRequestDTO): Promise<{
    status: number;
    body: unknown;
  }> {
    try {
      const result = await this.createInvoiceUseCase.execute(request);
      return { status: 201, body: result };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error interno';
      return { status: 400, body: { error: message } };
    }
  }
}