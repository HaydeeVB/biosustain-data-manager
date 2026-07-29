/**
 * src/domain/services/PaymentGateway.ts
 *
 * Interfaz del gateway de pago — contrato para la capa de infraestructura.
 */
export interface PaymentGateway {
  verifyPayment(reference: string): Promise<boolean>;
  processPayment(amount: number, currency: string): Promise<string>;
}