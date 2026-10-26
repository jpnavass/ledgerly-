#!/usr/bin/env node
/**
 * scripts/report.mjs
 * Genera un informe de auditoría verificable desde el repositorio real.
 * Ejecuta los tests con el reporter JSON, lista archivos versionados y
 * ejecuta los grep de criterios de aceptación del prompt v2.
 *
 * Uso: node scripts/report.mjs
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function run(cmd, opts = {}) {
  const r = spawnSync(cmd, { shell: true, encoding: 'utf8', cwd: ROOT, ...opts });
  return { stdout: (r.stdout || '').trim(), stderr: (r.stderr || '').trim(), code: r.status };
}

function hr(char = '─', n = 72) {
  return char.repeat(n);
}

function section(title) {
  console.log('\n' + hr('═'));
  console.log(`  ${title}`);
  console.log(hr('═'));
}

// ─────────────────────────────────────────────────────────────────────────────
// 0. INFORMACIÓN DEL PROYECTO
// ─────────────────────────────────────────────────────────────────────────────
const now = new Date().toISOString();
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

section('0. INFORMACIÓN DEL PROYECTO');
console.log(`  Nombre      : ${pkg.name}`);
console.log(`  Versión     : ${pkg.version}`);
console.log(`  Node        : ${process.version}`);
console.log(`  Fecha       : ${now}`);
console.log(`  Directorio  : ${ROOT}`);

// ─────────────────────────────────────────────────────────────────────────────
// 1. VERSIONES DE DEPENDENCIAS (package.json)
// ─────────────────────────────────────────────────────────────────────────────
section('1. VERSIONES DE DEPENDENCIAS (package.json)');
const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
const KEY_DEPS = ['next', 'react', 'typescript', 'zod', '@react-pdf/renderer', 'qrcode', 'stripe', 'resend', '@supabase/supabase-js', '@supabase/ssr', '@tanstack/react-query', 'lucide-react'];
for (const dep of KEY_DEPS) {
  console.log(`  ${dep.padEnd(30)} : ${allDeps[dep] || '— no declarado —'}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ARCHIVOS VERSIONADOS
// ─────────────────────────────────────────────────────────────────────────────
section('2. ARCHIVOS VERSIONADOS (git ls-files src scripts supabase docs tests)');
const lsFiles = run('git ls-files src scripts supabase docs tests');
if (lsFiles.code !== 0) {
  console.log('  [ERROR] ' + lsFiles.stderr);
} else {
  const files = lsFiles.stdout.split('\n').filter(Boolean);
  console.log(`  Total: ${files.length} archivos`);
  console.log('');
  for (const f of files) {
    console.log('  ' + f);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ESTADO GIT
// ─────────────────────────────────────────────────────────────────────────────
section('3. ESTADO GIT (git status -s)');
const status = run('git status -s');
if (status.stdout) {
  console.log(status.stdout);
} else {
  console.log('  Árbol de trabajo limpio — sin cambios pendientes.');
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. HISTORIAL DE COMMITS
// ─────────────────────────────────────────────────────────────────────────────
section('4. HISTORIAL DE COMMITS (git log --oneline -10)');
const gitLog = run('git log --oneline -10');
console.log(gitLog.stdout || '  [Sin commits]');

// ─────────────────────────────────────────────────────────────────────────────
// 5. TESTS
// ─────────────────────────────────────────────────────────────────────────────
section('5. TESTS (node --test con reporter JSON)');

const testCmd = [
  'node',
  '--experimental-strip-types',
  '--test',
  '--test-reporter=./scripts/json-reporter.mjs',
  '"tests/**/*.test.ts"',
  '"src/**/__tests__/*.test.ts"',
].join(' ');

const testResult = run(testCmd);

const testEvents = [];
let parseErrors = 0;
const rawLines = testResult.stdout.split('\n').filter(Boolean);

for (const line of rawLines) {
  try {
    testEvents.push(JSON.parse(line));
  } catch {
    parseErrors++;
  }
}

// Contar pruebas hoja reales (details.type !== 'suite')
const leafPassEvents = testEvents.filter(e => e.type === 'test:pass' && e.data?.details?.type !== 'suite');
const leafFailEvents = testEvents.filter(e => e.type === 'test:fail' && e.data?.details?.type !== 'suite');
const totalPass = leafPassEvents.length;
const totalFail = leafFailEvents.length;
const totalTests = totalPass + totalFail;

// Agrupar por archivo
const fileMap = new Map();
for (const ev of leafPassEvents.concat(leafFailEvents)) {
  const file = ev.data?.file || 'desconocido';
  if (!fileMap.has(file)) {
    fileMap.set(file, { pass: [], fail: [] });
  }
  const entry = fileMap.get(file);
  if (ev.type === 'test:pass') entry.pass.push(ev.data.name);
  else entry.fail.push(ev.data.name);
}

console.log(`  Código de salida del proceso de tests  : ${testResult.code}`);
console.log(`  Eventos JSON parseados                 : ${testEvents.length}`);
console.log(`  Errores de parse de líneas JSON        : ${parseErrors}`);
console.log(`  Tests ejecutables pasados (hojas)      : ${totalPass}`);
console.log(`  Tests ejecutables fallados             : ${totalFail}`);
console.log(`  Total tests ejecutados                 : ${totalTests}`);

console.log('\n  ── Detalle por archivo ──');
let idx = 0;
for (const [filePath, data] of fileMap.entries()) {
  idx++;
  const relPath = path.relative(ROOT, filePath);
  console.log(`\n  [${idx}] ${relPath}`);
  console.log(`      Tests: ${data.pass.length} ok, ${data.fail.length} fallo(s)`);
  for (const name of data.pass) {
    console.log(`        ✓ ${name}`);
  }
  for (const name of data.fail) {
    console.log(`        ✗ ${name}`);
  }
}

if (leafFailEvents.length > 0) {
  console.log('\n  ── Tests FALLADOS ──');
  for (const ev of leafFailEvents) {
    const d = ev.data;
    console.log(`  ✗ ${d.name}`);
    if (d.details?.error) {
      console.log(`    Error: ${d.details.error.message || d.details.error}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. SCRIPTS DE LIMPIEZA Y ALCANCE
// ─────────────────────────────────────────────────────────────────────────────
section('6. SCRIPTS DE LIMPIEZA Y ALCANCE');
const checkClean = run('node scripts/check-clean.mjs');
console.log(`  check-clean → código ${checkClean.code}`);
if (checkClean.stdout) console.log('  ' + checkClean.stdout.replace(/\n/g, '\n  '));
if (checkClean.stderr) console.log('  STDERR: ' + checkClean.stderr.replace(/\n/g, '\n  '));

const verifyScope = run('node scripts/verify-scope.mjs');
console.log(`  verify-scope → código ${verifyScope.code}`);
if (verifyScope.stdout) console.log('  ' + verifyScope.stdout.replace(/\n/g, '\n  '));
if (verifyScope.stderr) console.log('  STDERR: ' + verifyScope.stderr.replace(/\n/g, '\n  '));

// ─────────────────────────────────────────────────────────────────────────────
// 7. GREP DE CRITERIOS DE ACEPTACIÓN
// ─────────────────────────────────────────────────────────────────────────────
section('7. GREP DE CRITERIOS DE ACEPTACIÓN');

const greps = [
  { desc: 'mock-data | MOCK_ | org-001 | Math.random en src/',  cmd: 'git grep -n --count -iE "mock-data|MOCK_|org-001|Math\\.random" -- "src/**"', expectZero: true },
  { desc: 'doc_id | sort_order | PaymentRecord en src/',         cmd: 'git grep -n --count -E "doc_id|sort_order|PaymentRecord" -- "src/**"', expectZero: true },
  { desc: 'pdf-lib (biblioteca prohibida) en src/',              cmd: 'git grep -n --count -i "pdf-lib" -- "src/**"', expectZero: true },
  { desc: 'geolocation (no está en el prompt) en src/',          cmd: 'git grep -n --count -i "geolocation" -- "src/**"', expectZero: true },
  { desc: 'avanzada|cualificad|sello de tiempo|sellado en src/', cmd: 'git grep -n --count -iE "avanzada|cualificad|sello de tiempo|sellado" -- "src/**"', expectZero: true },
  { desc: 'IA (aislada) en src/',                                cmd: 'git grep -n --count -E "\\bIA\\b" -- "src/**"', expectZero: true },
  { desc: 'localStorage fuera de lib/repo/local.ts',            cmd: 'git grep -n --count "localStorage" -- "src/**" ":(exclude)src/lib/repo/local.ts"', expectZero: true },
  { desc: 'roundHalfToEven (no debe existir)',                   cmd: 'git grep -n --count "roundHalfToEven" -- "src/**"', expectZero: true },
  { desc: 'roundHalfUp (debe existir)',                          cmd: 'git grep -n --count "roundHalfUp" -- "src/**"', expectZero: false },
];

for (const g of greps) {
  const r = run(g.cmd);
  const found = r.code === 0;

  if (g.expectZero) {
    const marker = found ? '⚠️  COINCIDENCIAS (no permitido)' : '✅ Sin coincidencias';
    console.log(`\n  ${marker}`);
    console.log(`  Búsqueda: ${g.desc}`);
    if (found && r.stdout) {
      const lines = r.stdout.split('\n').slice(0, 20);
      for (const l of lines) console.log('    ' + l);
    }
  } else {
    const marker = found ? '✅ Encontrado (requerido)' : '❌ NO ENCONTRADO (error)';
    console.log(`\n  ${marker}`);
    console.log(`  Búsqueda: ${g.desc}`);
    if (found && r.stdout) {
      const lines = r.stdout.split('\n').slice(0, 10);
      for (const l of lines) console.log('    ' + l);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. TIPOS Y NOMBRES DEL DOMINIO
// ─────────────────────────────────────────────────────────────────────────────
section('8. TIPOS Y NOMBRES DEL DOMINIO (verificación en src/types/index.ts)');

const typesPath = path.join(ROOT, 'src/types/index.ts');
const typesContent = fs.readFileSync(typesPath, 'utf8');

function checkContains(label, pattern) {
  const ok = pattern.test(typesContent);
  console.log(`  ${ok ? '✅' : '❌'} ${label}`);
  return ok;
}

checkContains("DocType incluye 'quote'",         /['"]quote['"]/);
checkContains("DocType incluye 'credit_note'",   /['"]credit_note['"]/);
checkContains("DocType incluye 'delivery_note'", /['"]delivery_note['"]/);
checkContains("DocStatus incluye 'void'",        /['"]void['"]/);
checkContains("DocStatus incluye 'issued'",      /['"]issued['"]/);
checkContains("UserRole incluye 'owner'",        /['"]owner['"]/);
checkContains("UserRole incluye 'employee'",     /['"]employee['"]/);
checkContains("PlanType incluye 'free'",         /['"]free['"]/);
checkContains("PlanType incluye 'pro'",          /['"]pro['"]/);
checkContains("PlanType incluye 'business'",     /['"]business['"]/);

const signingPath = path.join(ROOT, 'src/lib/domain/signing.ts');
const signingContent = fs.readFileSync(signingPath, 'utf8');
const otpOk = /maxAttempts:\s*5/.test(signingContent);
console.log(`  ${otpOk ? '✅' : '❌'} OTP maxAttempts === 5 (signing.ts)`);

const generatePath = path.join(ROOT, 'src/lib/pdf/generate.ts');
const generateContent = fs.readFileSync(generatePath, 'utf8');
const pdfOk = generateContent.includes('@react-pdf/renderer');
const pdfLibBad = generateContent.includes('pdf-lib');
console.log(`  ${pdfOk ? '✅' : '❌'} PDF usa @react-pdf/renderer`);
console.log(`  ${!pdfLibBad ? '✅' : '❌'} PDF NO usa pdf-lib`);

const moneyPath = path.join(ROOT, 'src/lib/money.ts');
const moneyContent = fs.readFileSync(moneyPath, 'utf8');
const halfUpOk = /export function roundHalfUp/.test(moneyContent);
const halfEvenBad = /roundHalfToEven/.test(moneyContent);
console.log(`  ${halfUpOk ? '✅' : '❌'} roundHalfUp definido en money.ts`);
console.log(`  ${!halfEvenBad ? '✅' : '❌'} roundHalfToEven NO existe en money.ts`);

const themeTypesPath = path.join(ROOT, 'src/lib/theme/types.ts');
const themeTypesContent = fs.readFileSync(themeTypesPath, 'utf8');
const hasAliases = /['"]blue['"]|['"]emerald['"]|['"]graphite['"]|['"]burgundy['"]/.test(themeTypesContent);
console.log(`  ${!hasAliases ? '✅' : '⚠️ '} ThemeAccent sin alias ingleses (blue/emerald/graphite/burgundy)`);

const fontScaleIntOk = /100\s*\|\s*110\s*\|\s*125/.test(themeTypesContent);
const fontScaleDecBad = /font_scale:\s*number.*\[1,\s*1\.1/.test(themeTypesContent);
console.log(`  ${fontScaleIntOk ? '✅' : '⚠️ '} font_scale tipo 100|110|125 (integers según prompt)`);
console.log(`  ${fontScaleDecBad ? '⚠️ ' : '✅'} font_scale no usa decimales [1, 1.1, 1.25]`);

// ─────────────────────────────────────────────────────────────────────────────
// 9. FIN DEL INFORME
// ─────────────────────────────────────────────────────────────────────────────
section('9. FIN DEL INFORME');
console.log(`  Generado el : ${new Date().toISOString()}`);
console.log(`  Tests       : ${testResult.code === 0 && totalFail === 0 ? '✅ Todos pasados' : '❌ HAY FALLOS'}`);
console.log(`  check-clean : ${checkClean.code === 0 ? '✅' : '❌ FALLO'}`);
console.log(`  verify-scope: ${verifyScope.code === 0 ? '✅' : '❌ FALLO'}`);
console.log('');
console.log('  NOTAS: Este script no interpreta ni resume los resultados.');
console.log('  Todo lo anterior procede directamente del sistema de archivos,');
console.log('  git y el runner de Node.js. Ningún resultado es inventado.\n');
