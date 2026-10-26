import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

describe('Seguridad, Inmutabilidad y Limpieza de Código (Fase 12)', () => {
  it('No deben existir secretos de servidor ni claves maestras en el código cliente o estático', () => {
    const sensitiveEnvNames = [
      'SUPABASE_' + 'SERVICE_' + 'ROLE_' + 'KEY',
      'STRIPE_' + 'SECRET_' + 'KEY',
      'STRIPE_' + 'WEBHOOK_' + 'SECRET',
      'RESEND_' + 'API_' + 'KEY',
      'AEAT_' + 'CERT_' + 'PASSWORD',
      'CERT_' + 'ENCRYPTION_' + 'KEY',
    ];

    const staticDir = path.join(projectRoot, '.next', 'static');
    if (fs.existsSync(staticDir)) {
      function checkBundle(dir: string) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            checkBundle(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('.js')) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            for (const secret of sensitiveEnvNames) {
              assert.strictEqual(
                content.includes(secret + '='),
                false,
                `Posible fuga de variable sensible en bundle cliente: ${entry.name}`
              );
            }
          }
        }
      }
      checkBundle(staticDir);
    }
  });

  it('Almacenamiento local solo puede ser accedido en lib/repo/local.ts', () => {
    const srcDir = path.join(projectRoot, 'src');
    const violations: string[] = [];
    const storageCall = ['local', 'Storage.'].join('');

    function scan(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scan(full);
        } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
          const normalized = full.replace(/\\/g, '/');
          if (normalized.endsWith('src/lib/repo/local.ts')) continue;
          const content = fs.readFileSync(full, 'utf-8');
          if (content.includes(storageCall)) {
            violations.push(normalized);
          }
        }
      }
    }
    scan(srcDir);
    assert.deepStrictEqual(violations, [], `Acceso a almacenamiento encontrado fuera de local.ts: ${violations.join(', ')}`);
  });

  it('Generación aleatoria no criptográfica no debe utilizarse en src/lib/', () => {
    const libDir = path.join(projectRoot, 'src', 'lib');
    const violations: string[] = [];
    const unsafeRandom = ['Math.', 'random'].join('');

    function scan(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scan(full);
        } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
          const content = fs.readFileSync(full, 'utf-8');
          if (content.includes(unsafeRandom)) {
            violations.push(full.replace(/\\/g, '/'));
          }
        }
      }
    }
    scan(libDir);
    assert.deepStrictEqual(violations, [], `Generación aleatoria no segura encontrada en src/lib/: ${violations.join(', ')}`);
  });

  it('Cero menciones a términos restringidos o modelos generativos en producción', () => {
    const forbidden = [
      ['inteligencia', 'artificial'].join(' '),
      ['co', 'pilot'].join(''),
      ['chat', 'gpt'].join(''),
      ['open', 'ai'].join(''),
      ['anthro', 'pic'].join(''),
      ['clau', 'de'].join(''),
      ['gemi', 'ni'].join(''),
      ['anti', 'gravity'].join(''),
      ['asistente', 'virtual'].join(' '),
    ];

    const scanDirs = [
      path.join(projectRoot, 'src'),
      path.join(projectRoot, 'public'),
    ];

    const violations: string[] = [];

    for (const d of scanDirs) {
      if (!fs.existsSync(d)) continue;
      function scan(dir: string) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            scan(full);
          } else if (entry.isFile() && /\.(ts|tsx|css|json)$/.test(entry.name)) {
            const content = fs.readFileSync(full, 'utf-8').toLowerCase();
            for (const term of forbidden) {
              if (content.includes(term.toLowerCase())) {
                violations.push(`${full}: ${term}`);
              }
            }
          }
        }
      }
      scan(d);
    }

    assert.deepStrictEqual(violations, [], `Términos no permitidos encontrados: ${violations.join(', ')}`);
  });
});
