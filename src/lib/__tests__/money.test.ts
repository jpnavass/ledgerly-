import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatCents,
  eurosToCents,
  centsToEuros,
  formatPercent,
  formatDocNumber,
  assertCents,
  assertRate,
  roundHalfUp,
} from '../money.ts';

describe('FASE 1: Módulo de Aritmética Monetaria Entera (money.ts)', () => {
  it('Redondeo aritmético half-up determinista para números positivos y negativos', () => {
    assert.strictEqual(roundHalfUp(4999.5), 5000);
    assert.strictEqual(roundHalfUp(4999.49), 4999);
    assert.strictEqual(roundHalfUp(-4999.5), -5000);
    assert.strictEqual(roundHalfUp(-4999.49), -4999);
    assert.strictEqual(roundHalfUp(2.5), 3);
    assert.strictEqual(roundHalfUp(0.5), 1);
    assert.strictEqual(roundHalfUp(-2.5), -3);
    assert.strictEqual(roundHalfUp(-0.5), -1);
    assert.strictEqual(roundHalfUp(-2.4), -2);
    assert.strictEqual(roundHalfUp(-2.6), -3);
    assert.strictEqual(roundHalfUp(0), 0);
  });

  it('formatCents formatea según norma española con aritmética entera estricta', () => {
    assert.strictEqual(formatCents(0), '0,00 €');
    assert.strictEqual(formatCents(5), '0,05 €');
    assert.strictEqual(formatCents(99), '0,99 €');
    assert.strictEqual(formatCents(100000), '1.000,00 €');
    assert.strictEqual(formatCents(123456789), '1.234.567,89 €');
    assert.strictEqual(formatCents(-123456), '-1.234,56 €');
  });

  it('formatCents lanza RangeError con enteros no seguros o flotantes', () => {
    assert.throws(() => formatCents(NaN), RangeError);
    assert.throws(() => formatCents(1.5), RangeError);
    assert.throws(() => formatCents(Number.MAX_SAFE_INTEGER + 1), RangeError);
  });

  it('eurosToCents convierte cadenas y números a céntimos enteros con precisión', () => {
    assert.strictEqual(eurosToCents('1.234,56'), 123456);
    assert.strictEqual(eurosToCents('1234,56'), 123456);
    assert.strictEqual(eurosToCents('1234.56'), 123456);
    assert.strictEqual(eurosToCents('0,1'), 10);
    assert.strictEqual(eurosToCents('12.5'), 1250);
    assert.strictEqual(eurosToCents(12.5), 1250);
    assert.strictEqual(eurosToCents(0.01), 1);
    assert.strictEqual(eurosToCents('-50,25'), -5025);
  });

  it('eurosToCents rechaza formatos ambiguos o no numéricos', () => {
    assert.throws(() => eurosToCents('1,2,3'), RangeError);
    assert.throws(() => eurosToCents(''), RangeError);
    assert.throws(() => eurosToCents('abc'), RangeError);
    assert.throws(() => eurosToCents('12.34.56,78'), RangeError);
  });

  it('centsToEuros realiza conversión bidireccional exacta', () => {
    assert.strictEqual(centsToEuros(123456), 1234.56);
    assert.strictEqual(centsToEuros(0), 0);
    assert.strictEqual(centsToEuros(-500), -5);
  });

  it('formatPercent formatea porcentajes con coma decimal', () => {
    assert.strictEqual(formatPercent(21), '21%');
    assert.strictEqual(formatPercent(5.2), '5,2%');
    assert.strictEqual(formatPercent(0), '0%');
  });

  it('formatDocNumber garantiza mínimo 4 dígitos sin truncar números grandes', () => {
    assert.strictEqual(formatDocNumber('FAC', 48), 'FAC-0048');
    assert.strictEqual(formatDocNumber('PRE', 1), 'PRE-0001');
    assert.strictEqual(formatDocNumber('ALB', 10450), 'ALB-10450');
    assert.throws(() => formatDocNumber('', 1), RangeError);
    assert.throws(() => formatDocNumber('FAC', 0), RangeError);
    assert.throws(() => formatDocNumber('FAC', -5), RangeError);
  });
});
