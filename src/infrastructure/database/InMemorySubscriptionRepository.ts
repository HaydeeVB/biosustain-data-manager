/**
 * src/infrastructure/database/InMemorySubscriptionRepository.ts
 *
 * Implementación en memoria del repositorio de suscripciones.
 * Para desarrollo y pruebas. En producción se sustituye por PostgreSQL.
 */

import { Subscription } from '../../domain/entities/Subscription';
import { SubscriptionRepository } from '../../domain/repositories/SubscriptionRepository';

export class InMemorySubscriptionRepository implements SubscriptionRepository {
  private subscriptions: Map<string, Subscription> = new Map();

  async save(subscription: Subscription): Promise<Subscription> {
    this.subscriptions.set(subscription.id, { ...subscription });
    return subscription;
  }

  async findById(id: string): Promise<Subscription | null> {
    return this.subscriptions.get(id) ?? null;
  }

  async findByClientId(clientId: string): Promise<Subscription[]> {
    return Array.from(this.subscriptions.values()).filter(s => s.clientId === clientId);
  }

  async findActiveByClientId(clientId: string): Promise<Subscription | null> {
    const now = new Date();
    return (
      Array.from(this.subscriptions.values()).find(
        s => s.clientId === clientId && s.status === 'ACTIVE' && s.endDate > now,
      ) ?? null
    );
  }

  async updateStatus(id: string, status: Subscription['status']): Promise<void> {
    const sub = this.subscriptions.get(id);
    if (sub) {
      this.subscriptions.set(id, { ...sub, status, updatedAt: new Date() });
    }
  }
}