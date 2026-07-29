/**
 * tests/unit/RIF.test.ts
 *
 * Tests unitarios para el value object RIF.
 */

import { RIF } from '../../src/domain/value-objects/RIF';

describe('RIF', () => {
  test('acepta RIF con prefijo J', () => {
    expect(() => new RIF('J-12345678-9')).not.toThrow();
  });

  test('acepta RIF con prefijo V', () => {
    expect(() => new RIF('V-12345678-1')).not.toThrow();
  });

  test('acepta RIF con prefijo G', () => {
    expect(() => new RIF('G-12345678-2')).not.toThrow();
  });

  test('rechaza formato inválido sin guiones', () => {
    expect(() => new RIF('J123456789')).toThrow('RIF inválido');
  });

  test('rechaza prefijo no válido', () => {
    expect(() => new RIF('X-12345678-9')).toThrow('RIF inválido');
  });

  test('rechaza muy pocos dígitos', () => {
    expect(() => new RIF('J-1234567-9')).toThrow('RIF inválido');
  });

  test('isValid retorna true para formato correcto', () => {
    expect(RIF.isValid('P-12345678-5')).toBe(true);
  });

  test('isValid retorna false para formato incorrecto', () => {
    expect(RIF.isValid('nope')).toBe(false);
  });

  test('equals compara valores correctamente', () => {
    const a = new RIF('J-12345678-9');
    const b = new RIF('J-12345678-9');
    const c = new RIF('V-12345678-9');
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});