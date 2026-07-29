/**
 * tests/unit/CreateInvoiceUseCase.test.ts
 *
 * Tests unitarios para el caso de uso de facturación SENIAT.
 * Verifica validación de RIF, cálculo de IVA, conversión BCV,
 * y asignación de número de control.
 */

import { CreateInvoiceUseCase } from '../../src/application/use-cases/CreateInvoiceUseCase';
import { InMemoryInvoiceRepository } from '../../src/infrastructure/database/InMemoryInvoiceRepository';
import { MockExchangeRateService } from '../../src/infrastructure/services/MockExchangeRateService';

describe('CreateInvoiceUseCase', () => {
  let useCase: CreateInvoiceUseCase;
  let exchangeRateService: MockExchangeRateService;

  beforeEach(() => {
    const repo = new InMemoryInvoiceRepository();
    exchangeRateService = new MockExchangeRateService(150.50);
    useCase = new CreateInvoiceUseCase(repo, exchangeRateService);
  });

  const validRequest = {
    clientId: 'client_001',
    clientRIF: 'J-12345678-9',
    issuerRIF: 'J-87654321-0',
    items: [
      { description: 'Suscripción PRO - 1 mes', quantity: 1, unitPriceUSD: 149, ivaRate: 0.16 },
      { description: 'Configuración IoT', quantity: 2, unitPriceUSD: 50, ivaRate: 0.16 },
    ],
  };

  test('crea factura con RIF válido', async () => {
    const result = await useCase.execute(validRequest);

    expect(result.clientId).toBe('client_001');
    expect(result.status).toBe('ISSUED');
    expect(result.controlNumber).toMatch(/^CL-\d{8}$/);
    expect(result.invoiceNumber).toMatch(/^N-\d{8}$/);
  });

  test('calcula subtotal e IVA correctamente', async () => {
    const result = await useCase.execute(validRequest);

    // 1×149 + 2×50 = 249
    expect(result.subtotalUSD).toBe(249);
    // 249 × 0.16 = 39.84
    expect(result.ivaAmountUSD).toBe(39.84);
    // 249 + 39.84 = 288.84
    expect(result.totalUSD).toBe(288.84);
  });

  test('conversión a Bolívares usa tasa BCV', async () => {
    const result = await useCase.execute(validRequest);

    expect(result.exchangeRateBs).toBe(150.50);
    // 288.84 × 150.50 = 43470.42
    expect(result.totalBs).toBe(+(288.84 * 150.50).toFixed(2));
  });

  test('lanza error si RIF del cliente es inválido', async () => {
    await expect(
      useCase.execute({ ...validRequest, clientRIF: 'X-invalid-rif' }),
    ).rejects.toThrow('RIF del cliente inválido');
  });

  test('lanza error si RIF del emisor es inválido', async () => {
    await expect(
      useCase.execute({ ...validRequest, issuerRIF: 'invalid' }),
    ).rejects.toThrow('RIF del emisor inválido');
  });

  test('lanza error si no hay items', async () => {
    await expect(
      useCase.execute({ ...validRequest, items: [] }),
    ).rejects.toThrow('al menos un ítem');
  });

  test('ítem exento (ivaRate 0) no genera IVA', async () => {
    const result = await useCase.execute({
      ...validRequest,
      items: [{ description: 'Servicio exento', quantity: 1, unitPriceUSD: 100, ivaRate: 0 }],
    });

    expect(result.subtotalUSD).toBe(100);
    expect(result.ivaAmountUSD).toBe(0);
    expect(result.totalUSD).toBe(100);
  });
});