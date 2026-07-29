/**
 * src/domain/value-objects/HardwareFingerprint.ts
 *
 * Value Object para huella de hardware — identifica un dispositivo IoT
 * de forma única mediante combinación de identificadores de hardware.
 */

export class HardwareFingerprint {
  private readonly value: string;

  constructor(value: string) {
    if (!value || value.trim().length < 8) {
      throw new Error('Huella de hardware inválida: mínimo 8 caracteres');
    }
    this.value = value.trim();
  }

  public toString(): string {
    return this.value;
  }

  public equals(other: HardwareFingerprint): boolean {
    return this.value === other.value;
  }
}