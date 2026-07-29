/**
 * src/application/use-cases/CreateSubscriptionUseCase.ts
 *
 * Caso de uso: crear una nueva suscripción.
 * Valida el pago, crea la suscripción con fecha de vencimiento
 * según el plan, y la persiste.
 */

import { Subscription, SubscriptionPlan, PLAN_DURATION_DAYS } from '../../domain/entities/Subscription';
import { SubscriptionRepository } from '../../domain/repositories/SubscriptionRepository';
import { PaymentGateway } from '../../domain/services/PaymentGateway';
import { CreateSubscriptionRequestDTO, CreateSubscriptionResponseDTO } from '../dtos/SubscriptionDTOs';

export class CreateSubscriptionUseCase {
  constructor(
    private subscriptionRepository: SubscriptionRepository,
    private paymentGateway: PaymentGateway,
  ) {}

  async execute(request: CreateSubscriptionRequestDTO): Promise<CreateSubscriptionResponseDTO> {
    // 1. Validar pago
    const paymentValid = await this.paymentGateway.verifyPayment(request.paymentReference);
    if (!paymentValid) {
      throw new Error('Referencia de pago inválida o no confirmada');
    }

    // 2. Verificar suscripción activa existente
    const existing = await this.subscriptionRepository.findActiveByClientId(request.clientId);
    if (existing) {
      throw new Error('El cliente ya tiene una suscripción activa');
    }

    // 3. Crear suscripción
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + PLAN_DURATION_DAYS[request.plan]);

    const subscription: Subscription = {
      id: this.generateId(),
      clientId: request.clientId,
      plan: request.plan,
      status: 'ACTIVE',
      startDate: now,
      endDate,
      paymentReference: request.paymentReference,
      createdAt: now,
      updatedAt: now,
    };

    // 4. Persistir
    const saved = await this.subscriptionRepository.save(subscription);

    return {
      id: saved.id,
      clientId: saved.clientId,
      plan: saved.plan,
      status: saved.status,
      startDate: saved.startDate.toISOString(),
      endDate: saved.endDate.toISOString(),
      paymentReference: saved.paymentReference,
    };
  }

  private generateId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}