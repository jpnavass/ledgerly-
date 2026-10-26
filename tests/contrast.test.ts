import test from 'node:test';
import assert from 'node:assert/strict';
import {
  wcagContrast,
  relativeLuminance,
  pickReadableText,
  hexToRgb,
  rgbToHex,
} from '../src/lib/theme/contrast.ts';

test('FASE 10: Algoritmo de Luminancia y Contraste WCAG 2.1 / 2.2 AA (contrast.test.ts)', async (t) => {
  await t.test('Ratio entre #000000 y #FFFFFF es exactamente 21:1', () => {
    const ratio = wcagContrast('#000000', '#FFFFFF');
    assert.strictEqual(ratio, 21);
    const inverse = wcagContrast('#FFFFFF', '#000000');
    assert.strictEqual(inverse, 21);
  });

  await t.test('#767676 sobre #FFFFFF pasa para texto normal (>= 4.5:1) mientras #777777 falla', () => {
    const passingRatio = wcagContrast('#767676', '#FFFFFF');
    const failingRatio = wcagContrast('#777777', '#FFFFFF');

    assert.ok(
      passingRatio >= 4.5,
      `#767676 debe pasar el umbral WCAG AA normal de 4.5:1 (obtenido: ${passingRatio})`
    );
    assert.ok(
      failingRatio < 4.5,
      `#777777 debe fallar el umbral WCAG AA normal de 4.5:1 (obtenido: ${failingRatio})`
    );
  });

  await t.test('pickReadableText selecciona blanco sobre negro y negro sobre blanco', () => {
    assert.strictEqual(pickReadableText('#000000'), '#FFFFFF');
    assert.strictEqual(pickReadableText('#0F172A'), '#FFFFFF');
    assert.strictEqual(pickReadableText('#FFFFFF'), '#000000');
    assert.strictEqual(pickReadableText('#F8FAFC'), '#000000');
  });

  await t.test('Conversión bidireccional hex <-> rgb y validación de sintaxis', () => {
    const rgb = hexToRgb('#6366F1');
    assert.deepStrictEqual(rgb, { r: 99, g: 102, b: 241 });
    const hex = rgbToHex(rgb);
    assert.strictEqual(hex, '#6366F1');

    assert.throws(() => hexToRgb('invalid'), /Formato hexadecimal inválido/);
  });

  await t.test('Luminancia relativa de colores de referencia estandarizados', () => {
    assert.strictEqual(relativeLuminance('#000000'), 0);
    assert.strictEqual(relativeLuminance('#FFFFFF'), 1);
  });
});
