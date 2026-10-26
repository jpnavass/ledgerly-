import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseUiPreferences,
  DEFAULT_UI_PREFERENCES,
  type UiPreferences,
} from '../src/lib/theme/types.ts';
import { resolveMode } from '../src/lib/theme/resolve.ts';
import {
  serializeUiCookie,
  parseUiCookie,
  UI_COOKIE_NAME,
} from '../src/lib/theme/cookie.ts';

test('FASE 10: Preferencias de Tema, Resolución y Cookie (theme.test.ts)', async (t) => {
  await t.test('parseUiPreferences con null, undefined, cadena vacía o JSON malformado devuelve siempre valores por defecto', () => {
    assert.deepStrictEqual(parseUiPreferences(null), DEFAULT_UI_PREFERENCES);
    assert.deepStrictEqual(parseUiPreferences(undefined), DEFAULT_UI_PREFERENCES);
    assert.deepStrictEqual(parseUiPreferences(''), DEFAULT_UI_PREFERENCES);
    assert.deepStrictEqual(parseUiPreferences('   '), DEFAULT_UI_PREFERENCES);
    assert.deepStrictEqual(parseUiPreferences('{ invalid json '), DEFAULT_UI_PREFERENCES);
    assert.deepStrictEqual(parseUiPreferences({ mode: 'invalid_mode', font_scale: 99 }), DEFAULT_UI_PREFERENCES);
  });

  await t.test('resolveMode resuelve modo del sistema y modo explícito de forma pura y determinista', () => {
    const systemPrefs: UiPreferences = { ...DEFAULT_UI_PREFERENCES, mode: 'system' };
    assert.strictEqual(resolveMode(systemPrefs, true), 'dark');
    assert.strictEqual(resolveMode(systemPrefs, false), 'light');

    const darkPrefs: UiPreferences = { ...DEFAULT_UI_PREFERENCES, mode: 'dark' };
    assert.strictEqual(resolveMode(darkPrefs, false), 'dark');
    assert.strictEqual(resolveMode(darkPrefs, true), 'dark');

    const lightPrefs: UiPreferences = { ...DEFAULT_UI_PREFERENCES, mode: 'light' };
    assert.strictEqual(resolveMode(lightPrefs, true), 'light');
    assert.strictEqual(resolveMode(lightPrefs, false), 'light');
  });

  await t.test('Cookie pe_ui serializada y deserializada preserva íntegramente todos los campos', () => {
    const customPrefs: UiPreferences = {
      mode: 'dark',
      accent: 'esmeralda',
      density: 'compact',
      font_scale: 110,
      high_contrast: true,
    };

    const cookieVal = serializeUiCookie(customPrefs);
    assert.ok(typeof cookieVal === 'string');

    // Deserializar encabezado Cookie completo
    const fullHeader = `session=abc123xyz; ${UI_COOKIE_NAME}=${cookieVal}; other=foo`;
    const parsed = parseUiCookie(fullHeader);

    assert.deepStrictEqual(parsed, customPrefs);
  });

  await t.test('parseUiCookie gestiona encabezados nulos o sin la cookie pe_ui', () => {
    assert.deepStrictEqual(parseUiCookie(null), DEFAULT_UI_PREFERENCES);
    assert.deepStrictEqual(parseUiCookie(''), DEFAULT_UI_PREFERENCES);
    assert.deepStrictEqual(parseUiCookie('session=abc'), DEFAULT_UI_PREFERENCES);
  });
});
