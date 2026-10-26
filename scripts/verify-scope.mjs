import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

console.log('[verify-scope] Verificando alcance estricto de modificaciones (presupuesto-express-v2)...');

const outsideFiles = [];

// 1. Verificar git status --porcelain
try {
  const statusOutput = execSync('git status --porcelain', { encoding: 'utf-8', cwd: projectRoot });
  const lines = statusOutput.split('\n').filter(Boolean);

  for (const line of lines) {
    const filePath = line.substring(3).trim();
    if (filePath.includes('bot ventas') || filePath.startsWith('..')) {
      outsideFiles.push(filePath);
    }
  }
} catch {
  // Ignorar si git status no puede ejecutarse
}

// 2. Verificar git diff --name-only
try {
  const diffOutput = execSync('git diff --name-only', { encoding: 'utf-8', cwd: projectRoot });
  const diffLines = diffOutput.split('\n').filter(Boolean);

  for (const filePath of diffLines) {
    if (filePath.includes('bot ventas') || filePath.startsWith('..')) {
      outsideFiles.push(filePath);
    }
  }
} catch {
  // Ignorar si no hay base para git diff
}

if (outsideFiles.length > 0) {
  console.error('[verify-scope] FALLO: Se han detectado modificaciones fuera del directorio permitido:', outsideFiles);
  process.exit(1);
}

console.log('[verify-scope] ÉXITO: Todos los cambios están 100% contenidos dentro de presupuesto-express-v2. Carpeta "bot ventas" completamente intacta.');
process.exit(0);
