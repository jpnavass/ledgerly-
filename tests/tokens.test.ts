import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { wcagContrast } from '../src/lib/theme/contrast.ts';

function extractCssVariables(block: string): Record<string, string> {
  const vars: Record<string, string> = {};
  const regex = /--([a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;
  let match;
  while ((match = regex.exec(block)) !== null) {
    vars[`--${match[1]}`] = match[2].trim();
  }
  return vars;
}

test('FASE 10: Validación Estricta de Tokens Semánticos (tokens.test.ts)', async (t) => {
  const tokensPath = path.resolve(process.cwd(), 'src/styles/tokens.css');

  await t.test('El archivo src/styles/tokens.css existe y no está vacío', () => {
    assert.ok(fs.existsSync(tokensPath), 'tokens.css debe existir');
    const content = fs.readFileSync(tokensPath, 'utf8');
    assert.ok(content.length > 500, 'tokens.css debe contener definiciones sustanciales');
  });

  const content = fs.readFileSync(tokensPath, 'utf8');

  // Extraer bloques
  const rootLightMatch = content.match(/:root\s*\{([\s\S]*?)\n\}/);
  assert.ok(rootLightMatch, 'Debe existir el bloque :root base (claro)');
  const lightVars = extractCssVariables(rootLightMatch[1]);

  const mediaDarkMatch = content.match(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)\s*\{([\s\S]*?)\n\s*\}\s*\}/);
  assert.ok(mediaDarkMatch, 'Debe existir el bloque @media dark');
  const mediaDarkVars = extractCssVariables(mediaDarkMatch[1]);

  const explicitDarkMatch = content.match(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/);
  assert.ok(explicitDarkMatch, 'Debe existir el bloque :root[data-theme="dark"]');
  const explicitDarkVars = extractCssVariables(explicitDarkMatch[1]);

  await t.test('El bloque @media dark y el selector [data-theme="dark"] declaran exactamente las mismas variables y valores', () => {
    const mediaKeys = Object.keys(mediaDarkVars).sort();
    const explicitKeys = Object.keys(explicitDarkVars).sort();

    assert.deepStrictEqual(mediaKeys, explicitKeys, 'Las claves declaradas en ambos bloques oscuros deben ser idénticas');

    for (const key of mediaKeys) {
      assert.strictEqual(
        mediaDarkVars[key],
        explicitDarkVars[key],
        `El valor de ${key} debe coincidir en ambos bloques oscuros (media: "${mediaDarkVars[key]}", explicit: "${explicitDarkVars[key]}")`
      );
    }
  });

  await t.test('Todos los tokens semánticos esenciales existen tanto en modo claro como en modo oscuro', () => {
    const requiredTokens = [
      '--bg-app',
      '--bg-surface',
      '--bg-surface-2',
      '--bg-elevated',
      '--border-subtle',
      '--border-default',
      '--border-input',
      '--text-primary',
      '--text-secondary',
      '--text-tertiary',
      '--accent',
      '--accent-hover',
      '--accent-fg',
      '--on-accent',
      '--accent-subtle',
      '--success-fg',
      '--success-bg',
      '--warning-fg',
      '--warning-bg',
      '--danger-fg',
      '--danger-bg',
      '--info-fg',
      '--info-bg',
    ];

    for (const token of requiredTokens) {
      assert.ok(lightVars[token], `Token ${token} debe existir en el tema claro`);
      assert.ok(explicitDarkVars[token], `Token ${token} debe existir en el tema oscuro`);
    }
  });

  await t.test('Ningún color de texto semántico tiene ratio < 4.5:1 contra su superficie', () => {
    // Modo Claro
    const lightSurface = lightVars['--bg-surface'];
    const lightTextPrimaryRatio = wcagContrast(lightVars['--text-primary'], lightSurface);
    const lightTextSecondaryRatio = wcagContrast(lightVars['--text-secondary'], lightSurface);
    const lightTextTertiaryRatio = wcagContrast(lightVars['--text-tertiary'], lightSurface);

    assert.ok(lightTextPrimaryRatio >= 4.5, `Claro: text-primary debe cumplir >= 4.5:1 (obtenido: ${lightTextPrimaryRatio})`);
    assert.ok(lightTextSecondaryRatio >= 4.5, `Claro: text-secondary debe cumplir >= 4.5:1 (obtenido: ${lightTextSecondaryRatio})`);
    assert.ok(lightTextTertiaryRatio >= 4.5, `Claro: text-tertiary debe cumplir >= 4.5:1 (obtenido: ${lightTextTertiaryRatio})`);

    // Modo Oscuro
    const darkSurface = explicitDarkVars['--bg-surface'];
    const darkTextPrimaryRatio = wcagContrast(explicitDarkVars['--text-primary'], darkSurface);
    const darkTextSecondaryRatio = wcagContrast(explicitDarkVars['--text-secondary'], darkSurface);
    const darkTextTertiaryRatio = wcagContrast(explicitDarkVars['--text-tertiary'], darkSurface);

    assert.ok(darkTextPrimaryRatio >= 4.5, `Oscuro: text-primary debe cumplir >= 4.5:1 (obtenido: ${darkTextPrimaryRatio})`);
    assert.ok(darkTextSecondaryRatio >= 4.5, `Oscuro: text-secondary debe cumplir >= 4.5:1 (obtenido: ${darkTextSecondaryRatio})`);
    assert.ok(darkTextTertiaryRatio >= 4.5, `Oscuro: text-tertiary debe cumplir >= 4.5:1 (obtenido: ${darkTextTertiaryRatio})`);
  });

  await t.test('Los bordes de inputs tienen ratio >= 3:1 contra --bg-app o --bg-surface (WCAG 2.1 Non-text contrast)', () => {
    // Modo Claro
    const lightBorderRatio = Math.max(
      wcagContrast(lightVars['--border-input'], lightVars['--bg-surface']),
      wcagContrast(lightVars['--border-input'], lightVars['--bg-app'])
    );
    assert.ok(lightBorderRatio >= 3.0, `Claro: border-input debe tener ratio >= 3:1 (obtenido: ${lightBorderRatio})`);

    // Modo Oscuro
    const darkBorderRatio = Math.max(
      wcagContrast(explicitDarkVars['--border-input'], explicitDarkVars['--bg-surface']),
      wcagContrast(explicitDarkVars['--border-input'], explicitDarkVars['--bg-app'])
    );
    assert.ok(darkBorderRatio >= 3.0, `Oscuro: border-input debe tener ratio >= 3:1 (obtenido: ${darkBorderRatio})`);
  });
});
