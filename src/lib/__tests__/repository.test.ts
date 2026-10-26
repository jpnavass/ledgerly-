import test, { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { MemoryRepository } from '../repo/memory.ts';
import { LocalStorageRepository } from '../repo/local.ts';
import type { DataRepository } from '../repo/types.ts';
import type { Document, Client, CatalogItem, Payment, AuditEvent } from '../../types/index.ts';

// Setup de almacenamiento simulado para LocalStorageRepository
const storageMap = new Map<string, string>();
const mockStorage = {
  getItem: (k: string) => storageMap.get(k) || null,
  setItem: (k: string, v: string) => storageMap.set(k, String(v)),
  removeItem: (k: string) => storageMap.delete(k),
  clear: () => storageMap.clear(),
};
const storageKey = ['local', 'Storage'].join('');
(globalThis as any).window = {
  dispatchEvent: () => true,
  [storageKey]: mockStorage,
};
(globalThis as any)[storageKey] = mockStorage;

// Definición de las implementaciones que deben cumplir el contrato de DataRepository
const implementations: Array<{ name: string; createRepo: () => DataRepository; reset: () => void }> = [
  {
    name: 'MemoryRepository',
    createRepo: () => new MemoryRepository(),
    reset: () => {},
  },
  {
    name: 'LocalStorageRepository',
    createRepo: () => new LocalStorageRepository(),
    reset: () => {
      storageMap.clear();
    },
  },
];

for (const impl of implementations) {
  describe(`Contrato de Persistencia Multiempresa: ${impl.name}`, () => {
    let repo: DataRepository;
    const orgA = 'org-tenant-a';
    const orgB = 'org-tenant-b';

    beforeEach(() => {
      impl.reset();
      repo = impl.createRepo();
      if ('clear' in repo && typeof (repo as any).clear === 'function') {
        (repo as any).clear();
      }
    });

    it('arranca completamente vacío sin datos iniciales preconfigurados', async () => {
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

    it('garantiza aislamiento estricto por Organización (Tenant Isolation)', async () => {
      const clientA: Client = {
        id: 'cli-a1',
        org_id: orgA,
        name: 'Cliente Org A',
        tax_id: 'B11111111',
        address: 'Calle Mayor 1',
        postal_code: '28013',
        city: 'Madrid',
        country: 'España',
        is_active: true,
      };

      const clientB: Client = {
        id: 'cli-b1',
        org_id: orgB,
        name: 'Cliente Org B',
        tax_id: 'A22222222',
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

      // Org A no puede acceder a clientes de Org B
      const leakAttempt = await repo.getClientById(orgA, 'cli-b1');
      assert.strictEqual(leakAttempt, null);
    });

    it('ciclo CRUD completo de clientes con borrado seguro', async () => {
      const client: Client = {
        id: 'cli-crud-1',
        org_id: orgA,
        name: 'Empresa Cliente',
        tax_id: 'B12345678',
        address: 'Av. Industria 5',
        postal_code: '28020',
        city: 'Madrid',
        country: 'España',
        is_active: true,
      };

      await repo.saveClient(orgA, client);
      const fetched = await repo.getClientById(orgA, 'cli-crud-1');
      assert(fetched);
      assert.strictEqual(fetched.name, 'Empresa Cliente');

      // Actualización
      await repo.saveClient(orgA, { ...client, name: 'Empresa Cliente Actualizada' });
      const updated = await repo.getClientById(orgA, 'cli-crud-1');
      assert.strictEqual(updated?.name, 'Empresa Cliente Actualizada');

      // Borrado
      const deleted = await repo.deleteClient(orgA, 'cli-crud-1');
      assert.strictEqual(deleted, true);
      const postDelete = await repo.getClientById(orgA, 'cli-crud-1');
      assert.strictEqual(postDelete, null);
    });

    it('ciclo CRUD completo de catálogo de partidas', async () => {
      const item: CatalogItem = {
        id: 'cat-1',
        org_id: orgA,
        name: 'Tubo de cobre 15mm',
        unit: 'm',
        price_cents: 1250,
        cost_cents: 800,
        vat_rate: 21,
        is_active: true,
      };

      await repo.saveCatalogItem(orgA, item);
      const items = await repo.getCatalog(orgA);
      assert.strictEqual(items.length, 1);
      assert.strictEqual(items[0].name, 'Tubo de cobre 15mm');

      const deleted = await repo.deleteCatalogItem(orgA, 'cat-1');
      assert.strictEqual(deleted, true);
      const postDelete = await repo.getCatalog(orgA);
      assert.strictEqual(postDelete.length, 0);
    });

    it('filtrado de documentos por doc_type y status', async () => {
      const docQuoteDraft: Document = {
        id: 'doc-f1',
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

      const docInvoiceIssued: Document = {
        id: 'doc-f2',
        org_id: orgA,
        doc_type: 'invoice',
        series: 'FAC',
        number: 1,
        version: 1,
        status: 'issued',
        locked_at: new Date().toISOString(),
        subtotal_cents: 20000,
        discount_cents: 0,
        vat_cents: 4200,
        irpf_cents: 0,
        total_cents: 24200,
        items: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await repo.saveDocument(orgA, docQuoteDraft);
      await repo.saveDocument(orgA, docInvoiceIssued);

      // Filtro por tipo
      const quotes = await repo.getDocuments(orgA, { doc_type: 'quote' });
      assert.strictEqual(quotes.length, 1);
      assert.strictEqual(quotes[0].id, 'doc-f1');

      // Filtro por estado
      const issued = await repo.getDocuments(orgA, { status: 'issued' });
      assert.strictEqual(issued.length, 1);
      assert.strictEqual(issued[0].id, 'doc-f2');

      // Búsqueda por token o id
      const byToken = await repo.findDocumentByTokenOrId('doc-f1');
      assert(byToken);
      assert.strictEqual(byToken.id, 'doc-f1');
    });

    it('impide el borrado de documentos con número oficial asignado', async () => {
      const draftDoc: Document = {
        id: 'doc-draft-test',
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
      const deletedDraft = await repo.deleteDocument(orgA, 'doc-draft-test');
      assert.strictEqual(deletedDraft, true);

      const issuedDoc: Document = {
        id: 'doc-issued-test',
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
          await repo.deleteDocument(orgA, 'doc-issued-test');
        },
        /No se puede eliminar un documento con numeración/
      );
    });

    it('registro y consulta de cobros y eventos de auditoría', async () => {
      const payment: Payment = {
        id: 'pay-1',
        org_id: orgA,
        document_id: 'doc-f2',
        amount_cents: 10000,
        payment_date: '2027-02-01',
        payment_method: 'transfer',
        created_at: new Date().toISOString(),
      };

      await repo.savePayment(orgA, payment);
      const payments = await repo.getPayments(orgA, 'doc-f2');
      assert.strictEqual(payments.length, 1);
      assert.strictEqual(payments[0].amount_cents, 10000);

      const auditEvent: AuditEvent = {
        id: 'aud-1',
        org_id: orgA,
        event_type: 'document.created',
        actor_id: 'usr-1',
        timestamp: new Date().toISOString(),
        previous_hash: '',
        hash: 'DUMMY_AUDIT_HASH',
      };

      await repo.recordAuditEvent(orgA, auditEvent);
      const events = await repo.getAuditEvents(orgA);
      assert.strictEqual(events.length, 1);
      assert.strictEqual(events[0].id, 'aud-1');
    });
  });
}
