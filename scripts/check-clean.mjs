import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Términos prohibidos (comprobación sin distinguir mayúsculas)
const FORBIDDEN_LITERAL_TERMS = [
  'mock-data',
  'mock_',
  'lorem',
  'ejemplo',
  'inteligencia artificial',
  'copilot',
  'chatgpt',
  'openai',
  'anthropic',
  'claude',
  'gemini',
  'antigravity',
  'prompt',
  'org-001',
];

// Expresiones regulares con límites de palabra Unicode para no romper palabras con tildes (ej. método)
const FORBIDDEN_REGEX_TERMS = [
  { name: 'TODO', regex: /(?<![\p{L}\p{N}_])TODO(?![\p{L}\p{N}_])/u },
  { name: 'FIXME', regex: /(?<![\p{L}\p{N}_])FIXME(?![\p{L}\p{N}_])/iu },
  { name: 'demo', regex: /(?<![\p{L}\p{N}_])demo(?![\p{L}\p{N}_])/iu },
  { name: 'IA (aislada)', regex: /(?<![\p{L}\p{N}_])IA(?![\p{L}\p{N}_])/u },
];

const SCAN_TARGETS = ['src', 'supabase', 'public', 'README.md'];
const violations = [];

function checkFileContent(filePath, relativePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lowerContent = content.toLowerCase();

  // 1. Comprobación de literales
  for (const term of FORBIDDEN_LITERAL_TERMS) {
    if (lowerContent.includes(term.toLowerCase())) {
      violations.push({
        file: relativePath,
        term,
        reason: `Término prohibido encontrado: "${term}"`,
      });
    }
  }

  // 2. Comprobación de expresiones regulares (TODO, FIXME, demo, \bIA\b)
  for (const { name, regex } of FORBIDDEN_REGEX_TERMS) {
    if (regex.test(content)) {
      violations.push({
        file: relativePath,
        term: name,
        reason: `Patrón prohibido detectado: "${name}"`,
      });
    }
  }

  // 3. Math.random en src/lib/
  const normalizedPath = relativePath.replace(/\\/g, '/');
  if (normalizedPath.startsWith('src/lib/')) {
    if (content.includes('Math.random')) {
      violations.push({
        file: relativePath,
        term: 'Math.random',
        reason: 'Uso de Math.random prohibido en src/lib/ (debe usarse crypto seguro)',
      });
    }
  }

  // 4. localStorage fuera de lib/repo/local.ts
  if (content.includes('localStorage')) {
    const isAllowedLocalRepo = normalizedPath.endsWith('lib/repo/local.ts');
    if (!isAllowedLocalRepo) {
      violations.push({
        file: relativePath,
        term: 'localStorage',
        reason: 'Uso de localStorage prohibido fuera de lib/repo/local.ts',
      });
    }
  }
}

function scanPath(target) {
  const fullPath = path.join(projectRoot, target);
  if (!fs.existsSync(fullPath)) return;

  const stat = fs.statSync(fullPath);
  if (stat.isFile()) {
    checkFileContent(fullPath, target);
    return;
  }

  const entries = fs.readdirSync(fullPath, { withFileTypes: true });
  for (const entry of entries) {
    const childRelative = path.join(target, entry.name);
    const childFull = path.join(projectRoot, childRelative);

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') {
        continue;
      }
      scanPath(childRelative);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.md', '.sql'].includes(ext)) {
        checkFileContent(childFull, childRelative);
      }
    }
  }
}

for (const target of SCAN_TARGETS) {
  scanPath(target);
}

if (violations.length > 0) {
  console.error('[check-clean] FALLO: Se han encontrado infracciones en los archivos escaneados:');
  for (const v of violations) {
    console.error(`  - ${v.file}: ${v.reason}`);
  }
  process.exit(1);
} else {
  console.log('[check-clean] ÉXITO: 0 términos prohibidos, 0 datos de ejemplo, 0 Math.random en lib, y localStorage estrictamente aislado.');
  process.exit(0);
}
