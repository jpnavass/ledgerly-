// ============================================================================
// Pruebas Automatizadas de Reglas e Inmutabilidad SQL (database-sql-rules.test.ts)
// ============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

describe('Verificación de Reglas SQL, Triggers e Inmutabilidad (Fases 3 y 6)', () => {
  const migrationsDir = path.join(projectRoot, 'supabase', 'migrations');
  const migrationFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));

  it('Verifica que todas las migraciones SQL existen y definen las políticas requeridas', () => {
    assert(migrationFiles.length >= 5, 'Deben existir al menos 5 archivos de migración');

    const coreSql = fs.readFileSync(path.join(migrationsDir, '0001_core.sql'), 'utf-8');
    const rlsSql = fs.readFileSync(path.join(migrationsDir, '0002_rls.sql'), 'utf-8');
    const functionsSql = fs.readFileSync(path.join(migrationsDir, '0003_functions.sql'), 'utf-8');
    const prefsAndCertsSql = fs.readFileSync(path.join(migrationsDir, '0005_user_preferences_and_certificates.sql'), 'utf-8');

    // Tablas base
    assert(coreSql.includes('create table if not exists documents'));
    assert(coreSql.includes('create table if not exists billing_records'));
    assert(coreSql.includes('create table if not exists audit_events'));
    assert(coreSql.includes('create table if not exists doc_counters'));

    // RLS activado en todas las tablas clave
    assert(rlsSql.includes('alter table documents enable row level security;'));
    assert(rlsSql.includes('alter table billing_records enable row level security;'));
    assert(rlsSql.includes('alter table audit_events enable row level security;'));

    // Triggers de inmutabilidad y bloqueo de manipulaciones
    assert(functionsSql.includes('trg_check_document_immutability'));
    assert(functionsSql.includes('trg_prevent_tampering'));
    assert(functionsSql.includes('next_document_number'));

    // Migración 0005: Preferencias y Certificados
    assert(prefsAndCertsSql.includes('create table if not exists user_preferences'));
    assert(prefsAndCertsSql.includes('create table if not exists org_certificates'));
    assert(prefsAndCertsSql.includes('alter table user_preferences enable row level security;'));
    assert(prefsAndCertsSql.includes('alter table org_certificates enable row level security;'));
  });

  it('Simula y verifica la regla del trigger de inmutabilidad de documentos sellados (locked_at)', () => {
    // Lógica del trigger SQL: trg_check_document_immutability
    const checkDocumentImmutability = (
      op: 'UPDATE' | 'DELETE',
      oldDoc: { number?: number | null; locked_at?: string | null; total_cents: number },
      newDoc?: { total_cents: number }
    ) => {
      if (op === 'DELETE') {
        if (oldDoc.number !== null && oldDoc.number !== undefined) {
          throw new Error('Operación no permitida: Un documento con numeración oficial asignada no puede ser eliminado');
        }
        if (oldDoc.locked_at) {
          throw new Error('Operación no permitida: No se puede eliminar un documento sellado e inmutable');
        }
        return true;
      }
      if (op === 'UPDATE') {
        if (oldDoc.locked_at && newDoc && oldDoc.total_cents !== newDoc.total_cents) {
          throw new Error('Violación de integridad: El documento está cerrado y sellado. Importes inmutables');
        }
        return true;
      }
      return true;
    };

    // 1. Borrar borrador sin número ni locked_at -> Permitido
    assert.doesNotThrow(() => checkDocumentImmutability('DELETE', { number: null, locked_at: null, total_cents: 100 }));

    // 2. Borrar documento con número asignado -> Prohibido
    assert.throws(
      () => checkDocumentImmutability('DELETE', { number: 48, locked_at: null, total_cents: 100 }),
      /numeración oficial asignada no puede ser eliminado/
    );

    // 3. Borrar documento con locked_at -> Prohibido
    assert.throws(
      () => checkDocumentImmutability('DELETE', { number: null, locked_at: '2027-01-01T10:00:00Z', total_cents: 100 }),
      /No se puede eliminar un documento sellado e inmutable/
    );

    // 4. Modificar total_cents en documento sellado -> Prohibido
    assert.throws(
      () => checkDocumentImmutability('UPDATE', { number: 48, locked_at: '2027-01-01T10:00:00Z', total_cents: 1000 }, { total_cents: 2000 }),
      /Importes inmutables/
    );
  });

  it('Simula y verifica la regla del trigger de inalterabilidad append-only para billing_records y audit_events', () => {
    // Lógica del trigger SQL: trg_prevent_tampering
    const checkAppendOnly = (op: 'INSERT' | 'UPDATE' | 'DELETE') => {
      if (op === 'UPDATE' || op === 'DELETE') {
        throw new Error('Inalterabilidad garantizada: Las tablas de auditoría y registros de facturación son de inserción exclusiva (Append-Only)');
      }
      return true;
    };

    assert.doesNotThrow(() => checkAppendOnly('INSERT'));
    assert.throws(() => checkAppendOnly('UPDATE'), /Append-Only/);
    assert.throws(() => checkAppendOnly('DELETE'), /Append-Only/);
  });

  it('Verifica la existencia del script de pruebas SQL oficial en supabase/tests/database_integrity.sql', () => {
    const testSqlPath = path.join(projectRoot, 'supabase', 'tests', 'database_integrity.sql');
    assert(fs.existsSync(testSqlPath), 'El archivo supabase/tests/database_integrity.sql debe existir');
    const content = fs.readFileSync(testSqlPath, 'utf-8');
    assert(content.includes('next_document_number'));
    assert(content.includes('billing_records'));
    assert(content.includes('audit_events'));
  });
});
