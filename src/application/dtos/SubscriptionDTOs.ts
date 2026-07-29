/**
 * src/application/dtos/SubscriptionDTOs.ts
 *
 * Data Transfer Objects para el caso de uso de suscripción.
 */

import { SubscriptionPlan } from '../../domain/entities/Subscription';

export interface CreateSubscriptionRequestDTO {
  clientId: string;
  plan: SubscriptionPlan;
  paymentReference: string;
}

export interface CreateSubscriptionResponseDTO {
  id: string;
  clientId: string;
  plan: SubscriptionPlan;
  status: string;
  startDate: string;
  endDate: string;
  paymentReference: string;
}