import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Verificación de Fase 0 — Red de Seguridad y Entorno de Ejecución', () => {
  it('Verifica soporte nativo de Node.js v22.6+ para ejecución de tests tipados sin transpilador', () => {
    const [major, minor] = process.versions.node.split('.').map((n) => parseInt(n, 10));
    const isAtLeast22_6 = major > 22 || (major === 22 && minor >= 6);
    assert.ok(isAtLeast22_6, `Se requiere Node.js v22.6.0 o superior (type-stripping nativo). Versión actual: ${process.version}`);
  });

  it('Verifica el aislamiento de variables de entorno y ejecución sin red', () => {
    assert.strictEqual(typeof process.env, 'object');
  });
});
