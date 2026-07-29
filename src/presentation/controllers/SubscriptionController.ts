/**
 * src/presentation/controllers/SubscriptionController.ts
 *
 * Controlador para endpoints de suscripción.
 * Recibe requests HTTP, delega al caso de uso, devuelve respuestas.
 */

import { CreateSubscriptionUseCase } from '../../application/use-cases/CreateSubscriptionUseCase';
import { CreateSubscriptionRequestDTO } from '../../application/dtos/SubscriptionDTOs';

export class SubscriptionController {
  constructor(private createSubscriptionUseCase: CreateSubscriptionUseCase) {}

  async create(request: CreateSubscriptionRequestDTO): Promise<{
    status: number;
    body: unknown;
  }> {
    try {
      const result = await this.createSubscriptionUseCase.execute(request);
      return { status: 201, body: result };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error interno';
      return { status: 400, body: { error: message } };
    }
  }
}