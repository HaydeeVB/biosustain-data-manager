/**
 * src/presentation/index.ts
 *
 * Punto de entrada de la aplicación — orquesta la composición de
 * dependencias (dependency injection manual) y expone los controladores.
 *
 * Esta arquitectura permite que cualquier framework HTTP (Express, Fastify,
 * o el servidor nativo de Node) consuma los controladores sin acoplamiento.
 */

import { CreateSubscriptionUseCase } from '../application/use-cases/CreateSubscriptionUseCase';
import { RequestLicenseUseCase } from '../application/use-cases/RequestLicenseUseCase';
import { CreateInvoiceUseCase } from '../application/use-cases/CreateInvoiceUseCase';
import {
  InMemorySubscriptionRepository,
  InMemoryLicenseRepository,
  InMemoryInvoiceRepository,
  InMemoryDecisionRepository,
  MockPaymentGateway,
  MockCryptoService,
  MockExchangeRateService,
} from '../infrastructure';

import { SubscriptionController } from './controllers/SubscriptionController';
import { LicenseController } from './controllers/LicenseController';
import { InvoiceController } from './controllers/InvoiceController';
import { BioconversionController } from './controllers/BioconversionController';

/** Composición de dependencias — en producción se sustituyen los mocks. */
export function createControllers() {
  // Repositorios
  const subscriptionRepo = new InMemorySubscriptionRepository();
  const licenseRepo = new InMemoryLicenseRepository();
  const invoiceRepo = new InMemoryInvoiceRepository();
  const decisionRepo = new InMemoryDecisionRepository();

  // Servicios
  const paymentGateway = new MockPaymentGateway();
  const cryptoService = new MockCryptoService();
  const exchangeRateService = new MockExchangeRateService();

  // Casos de uso
  const createSubscriptionUseCase = new CreateSubscriptionUseCase(
    subscriptionRepo, paymentGateway,
  );
  const requestLicenseUseCase = new RequestLicenseUseCase(
    licenseRepo, cryptoService,
  );
  const createInvoiceUseCase = new CreateInvoiceUseCase(
    invoiceRepo, exchangeRateService,
  );

  // Controladores
  return {
    subscription: new SubscriptionController(createSubscriptionUseCase),
    license: new LicenseController(requestLicenseUseCase),
    invoice: new InvoiceController(createInvoiceUseCase),
    bioconversion: new BioconversionController(decisionRepo),
  };
}

export { SubscriptionController } from './controllers/SubscriptionController';
export { LicenseController } from './controllers/LicenseController';
export { InvoiceController } from './controllers/InvoiceController';
export { BioconversionController } from './controllers/BioconversionController';