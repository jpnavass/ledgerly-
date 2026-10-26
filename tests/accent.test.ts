import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveAccentTokens,
  rgbToHsl,
} from '../src/lib/theme/accent.ts';
import { wcagContrast, hexToRgb } from '../src/lib/theme/contrast.ts';

test('FASE 10: Derivación y Adaptabilidad Accesible de Acentos (accent.test.ts)', async (t) => {
  const officialAccents = [
    { name: 'indigo', hex: '#4F46E5' },
    { name: 'azul', hex: '#2563EB' },
    { name: 'esmeralda', hex: '#047857' },
    { name: 'grafito', hex: '#334155' },
    { name: 'burdeos', hex: '#9F1239' },
  ];

  await t.test('Los 5 acentos oficiales generan tokens válidos con contraste accesible en claro y oscuro', () => {
    for (const { name, hex } of officialAccents) {
      // Modo Claro
      const lightTokens = deriveAccentTokens(hex, 'light');
      assert.ok(lightTokens.accent, `${name} debe generar --accent en claro`);
      assert.ok(lightTokens.accentHover, `${name} debe generar --accent-hover en claro`);
      assert.ok(lightTokens.accentFg, `${name} debe generar --accent-fg en claro`);
      assert.ok(lightTokens.onAccent, `${name} debe generar --on-accent en claro`);

      const lightFgContrast = wcagContrast(lightTokens.accentFg, '#FFFFFF');
      assert.ok(
        lightFgContrast >= 4.5,
        `En claro, ${name} accentFg debe cumplir >= 4.5:1 contra superficie blanca (obtenido: ${lightFgContrast})`
      );

      const lightBtnContrast = wcagContrast(lightTokens.onAccent, lightTokens.accent);
      assert.ok(
        lightBtnContrast >= 4.5,
        `En claro, ${name} botón (--on-accent vs --accent) debe cumplir >= 4.5:1 (obtenido: ${lightBtnContrast})`
      );

      // Modo Oscuro
      const darkTokens = deriveAccentTokens(hex, 'dark');
      const darkFgContrast = wcagContrast(darkTokens.accentFg, '#12151D');
      assert.ok(
        darkFgContrast >= 4.5,
        `En oscuro, ${name} accentFg debe cumplir >= 4.5:1 contra superficie oscura (obtenido: ${darkFgContrast})`
      );

      const darkBtnContrast = wcagContrast(darkTokens.onAccent, darkTokens.accent);
      assert.ok(
        darkBtnContrast >= 4.5,
        `En oscuro, ${name} botón (--on-accent vs --accent) debe cumplir >= 4.5:1 (obtenido: ${darkBtnContrast})`
      );
    }
  });

  await t.test('Color personalizado muy claro (#FFE066) se oscurece para botón hasta cumplir >= 4.5:1 sin cambiar matiz > 5°', () => {
    const inputHex = '#FFE066';
    const originalRgb = hexToRgb(inputHex);
    const originalHsl = rgbToHsl(originalRgb.r, originalRgb.g, originalRgb.b);

    const derived = deriveAccentTokens(inputHex, 'light');

    // Comprobar ratio contra onAccent
    const btnRatio = wcagContrast(derived.onAccent, derived.accent);
    assert.ok(
      btnRatio >= 4.5,
      `El botón derivado debe cumplir ratio accesible >= 4.5:1 (obtenido: ${btnRatio})`
    );

    // Comprobar conservación de matiz (hue delta <= 5 grados)
    const derivedRgb = hexToRgb(derived.accent);
    const derivedHsl = rgbToHsl(derivedRgb.r, derivedRgb.g, derivedRgb.b);
    const hueDiff = Math.abs(originalHsl.h - derivedHsl.h);
    const normalizedHueDiff = Math.min(hueDiff, 360 - hueDiff);

    assert.ok(
      normalizedHueDiff <= 5,
      `El matiz (hue) no debe desviarse más de 5 grados (original: ${originalHsl.h}°, derivado: ${derivedHsl.h}°, diff: ${normalizedHueDiff}°)`
    );
  });

  await t.test('Hexadecimal inválido lanza un error controlado', () => {
    assert.throws(
      () => deriveAccentTokens('not-a-color', 'light'),
      /Color hexadecimal inválido/
    );
    assert.throws(
      () => deriveAccentTokens('#123', 'light'),
      /Color hexadecimal inválido/
    );
  });
});
