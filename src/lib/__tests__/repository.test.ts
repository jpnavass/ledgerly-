import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MemoryRepository } from '../repo/memory.ts';
import type { Document, Client, CatalogItem, Payment, AuditEvent } from '../../types/index.ts';

describe('FASE 3: Contrato de Repositorios y Persistencia Multiempresa', () => {
  const repo = new MemoryRepository();
  const orgA = 'org-tenant-a';
  const orgB = 'org-tenant-b';

  it('Arranca completamente vacío sin datos iniciales preconfigurados', async () => {
    repo.clear();
    const docs = await repo.getDocuments(orgA);
    const clients = await repo.getClients(orgA);
    const catalog = await repo.getCatalog(orgA);
    const payments = await repo.getPayments(orgA);
    const audit = await repo.getAuditEvents(orgA);

    assert.strictEqual(docs.length, 0);
    assert.strictEqual(clients.length, 0);
    assert.strictEqual(catalog.length, 0);
    assert.strictEqual(payments.length, 0);
    assert.strictEqual(audit.length, 0);
  });

  it('Garantiza aislamiento estricto por Organización (Tenant Isolation)', async () => {
    repo.clear();

    const clientA: Client = {
      id: 'cli-a1',
      org_id: orgA,
      name: 'Cliente Confidencial Org A',
      tax_id: 'B-88549126',
      address: 'Calle Mayor 1',
      postal_code: '28013',
      city: 'Madrid',
      country: 'España',
      is_active: true,
    };

    const clientB: Client = {
      id: 'cli-b1',
      org_id: orgB,
      name: 'Cliente Confidencial Org B',
      tax_id: 'A-12345674',
      address: 'Calle Real 2',
      postal_code: '08001',
      city: 'Barcelona',
      country: 'España',
      is_active: true,
    };

    await repo.saveClient(orgA, clientA);
    await repo.saveClient(orgB, clientB);

    const listA = await repo.getClients(orgA);
    const listB = await repo.getClients(orgB);

    assert.strictEqual(listA.length, 1);
    assert.strictEqual(listA[0].id, 'cli-a1');

    assert.strictEqual(listB.length, 1);
    assert.strictEqual(listB[0].id, 'cli-b1');

    // Org A no puede consultar directamente el id de Org B
    const leakAttempt = await repo.getClientById(orgA, 'cli-b1');
    assert.strictEqual(leakAttempt, null);
  });

  it('Impide el borrado de documentos con número oficial asignado', async () => {
    repo.clear();

    const draftDoc: Document = {
      id: 'doc-draft-1',
      org_id: orgA,
      doc_type: 'quote',
      series: null,
      number: null,
      version: 1,
      status: 'draft',
      subtotal_cents: 10000,
      discount_cents: 0,
      vat_cents: 2100,
      irpf_cents: 0,
      total_cents: 12100,
      items: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await repo.saveDocument(orgA, draftDoc);
    const deletedDraft = await repo.deleteDocument(orgA, 'doc-draft-1');
    assert.strictEqual(deletedDraft, true);

    const issuedDoc: Document = {
      id: 'doc-issued-1',
      org_id: orgA,
      doc_type: 'invoice',
      series: 'FAC',
      number: 1,
      version: 1,
      status: 'issued',
      locked_at: new Date().toISOString(),
      subtotal_cents: 50000,
      discount_cents: 0,
      vat_cents: 10500,
      irpf_cents: 0,
      total_cents: 60500,
      items: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await repo.saveDocument(orgA, issuedDoc);

    await assert.rejects(
      async () => {
        await repo.deleteDocument(orgA, 'doc-issued-1');
      },
      /No se puede eliminar un documento con numeración oficial asignada/
    );
  });
});
