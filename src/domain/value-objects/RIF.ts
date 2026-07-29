/**
 * src/domain/value-objects/RIF.ts
 *
 * Value Object para validación de RIF (Registro de Información Fiscal) de Venezuela.
 * Formato: V|E|J|P|G-C-XXXXXXXX-X donde C es un dígito de control.
 */

const RIF_PATTERN = /^[VEJPG]-\d{8}-\d{1}$/;

export class RIF {
  private readonly value: string;

  constructor(value: string) {
    if (!RIF.isValid(value)) {
      throw new Error(`RIF inválido: ${value}. Formato esperado: V|E|J|P|G-XXXXXXXX-X`);
    }
    this.value = value;
  }

  public static isValid(value: string): boolean {
    return RIF_PATTERN.test(value);
  }

  public toString(): string {
    return this.value;
  }

  public equals(other: RIF): boolean {
    return this.value === other.value;
  }
}