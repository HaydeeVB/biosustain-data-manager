/**
 * src/domain/repositories/SubscriptionRepository.ts
 *
 * Interfaz del repositorio de suscripciones — contrato que la capa
 * de infraestructura debe implementar.
 */

import { Subscription, SubscriptionPlan } from '../entities/Subscription';

export interface SubscriptionRepository {
  save(subscription: Subscription): Promise<Subscription>;
  findById(id: string): Promise<Subscription | null>;
  findByClientId(clientId: string): Promise<Subscription[]>;
  findActiveByClientId(clientId: string): Promise<Subscription | null>;
  updateStatus(id: string, status: Subscription['status']): Promise<void>;
}