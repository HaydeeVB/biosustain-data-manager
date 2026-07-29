/**
 * tests/unit/CreateSubscriptionUseCase.test.ts
 *
 * Tests unitarios para el caso de uso de suscripción.
 * Usa repositorios en memoria y mock de gateway de pago.
 */

import { CreateSubscriptionUseCase } from '../../src/application/use-cases/CreateSubscriptionUseCase';
import { InMemorySubscriptionRepository } from '../../src/infrastructure/database/InMemorySubscriptionRepository';
import { MockPaymentGateway } from '../../src/infrastructure/services/MockPaymentGateway';

describe('CreateSubscriptionUseCase', () => {
  let useCase: CreateSubscriptionUseCase;
  let repo: InMemorySubscriptionRepository;
  let paymentGateway: MockPaymentGateway;

  beforeEach(() => {
    repo = new InMemorySubscriptionRepository();
    paymentGateway = new MockPaymentGateway();
    useCase = new CreateSubscriptionUseCase(repo, paymentGateway);
  });

  test('crea suscripción con pago válido', async () => {
    const result = await useCase.execute({
      clientId: 'client_001',
      plan: 'PRO',
      paymentReference: 'pay_valid_12345',
    });

    expect(result.clientId).toBe('client_001');
    expect(result.plan).toBe('PRO');
    expect(result.status).toBe('ACTIVE');
    expect(result.endDate).toBeDefined();
  });

  test('lanza error si la referencia de pago es inválida', async () => {
    await expect(
      useCase.execute({
        clientId: 'client_001',
        plan: 'BASIC',
        paymentReference: 'invalid_ref',
      }),
    ).rejects.toThrow('Referencia de pago inválida');
  });

  test('lanza error si el cliente ya tiene suscripción activa', async () => {
    await useCase.execute({
      clientId: 'client_001',
      plan: 'BASIC',
      paymentReference: 'pay_valid_001',
    });

    await expect(
      useCase.execute({
        clientId: 'client_001',
        plan: 'PRO',
        paymentReference: 'pay_valid_002',
      }),
    ).rejects.toThrow('suscripción activa');
  });

  test('fecha de vencimiento es 30 días después del inicio', async () => {
    const result = await useCase.execute({
      clientId: 'client_002',
      plan: 'BASIC',
      paymentReference: 'pay_valid_002',
    });

    const start = new Date(result.startDate);
    const end = new Date(result.endDate);
    const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(30);
  });
});