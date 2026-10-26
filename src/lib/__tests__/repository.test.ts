import test, { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { MemoryRepository } from '../repo/memory.ts';
import { LocalStorageRepository, safeGetStorage, safeSetStorage } from '../repo/local.ts';
import type { DataRepository } from '../repo/types.ts';
import type { Document, Client, CatalogItem, Payment, AuditEvent, Org, OrgSettings, License, Membership } from '../../types/index.ts';

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

    it('búsqueda de texto, filtrado por cliente y paginación en getDocuments', async () => {
      const doc1: Document = {
        id: 'doc-search-1',
        org_id: orgA,
        client_id: 'cli-search-1',
        title: 'Reforma Integral Cocina',
        doc_type: 'quote',
        series: 'PRE',
        number: 101,
        version: 1,
        status: 'draft',
        subtotal_cents: 1000,
        discount_cents: 0,
        vat_cents: 210,
        irpf_cents: 0,
        total_cents: 1210,
        items: [],
        created_at: '2027-01-01T10:00:00Z',
        updated_at: '2027-01-01T10:00:00Z',
      };

      const doc2: Document = {
        id: 'doc-search-2',
        org_id: orgA,
        client_id: 'cli-search-1',
        title: 'Instalación Climatización Baño',
        doc_type: 'quote',
        series: 'PRE',
        number: 102,
        version: 1,
        status: 'sent',
        subtotal_cents: 2000,
        discount_cents: 0,
        vat_cents: 420,
        irpf_cents: 0,
        total_cents: 2420,
        items: [],
        created_at: '2027-01-02T10:00:00Z',
        updated_at: '2027-01-02T10:00:00Z',
      };

      const doc3: Document = {
        id: 'doc-search-3',
        org_id: orgA,
        client_id: 'cli-search-2',
        title: 'Pintura Exterior Fachada',
        doc_type: 'invoice',
        series: 'FAC',
        number: 50,
        version: 1,
        status: 'draft',
        subtotal_cents: 3000,
        discount_cents: 0,
        vat_cents: 630,
        irpf_cents: 0,
        total_cents: 3630,
        items: [],
        created_at: '2027-01-03T10:00:00Z',
        updated_at: '2027-01-03T10:00:00Z',
      };

      await repo.saveDocument(orgA, doc1);
      await repo.saveDocument(orgA, doc2);
      await repo.saveDocument(orgA, doc3);

      // Búsqueda por título
      const resCocina = await repo.getDocuments(orgA, { search: 'Cocina' });
      assert.strictEqual(resCocina.length, 1);
      assert.strictEqual(resCocina[0].id, 'doc-search-1');

      // Búsqueda por serie
      const resPre = await repo.getDocuments(orgA, { search: 'pre' });
      assert.strictEqual(resPre.length, 2);

      // Búsqueda por número
      const resNum = await repo.getDocuments(orgA, { search: '50' });
      assert.strictEqual(resNum.length, 1);
      assert.strictEqual(resNum[0].id, 'doc-search-3');

      // Filtrado por client_id
      const resClient = await repo.getDocuments(orgA, { client_id: 'cli-search-1' });
      assert.strictEqual(resClient.length, 2);

      // Paginación: page 1 limit 2 (ordenado desc por fecha)
      const page1 = await repo.getDocuments(orgA, { page: 1, limit: 2 });
      assert.strictEqual(page1.length, 2);
      assert.strictEqual(page1[0].id, 'doc-search-3');
      assert.strictEqual(page1[1].id, 'doc-search-2');

      const page2 = await repo.getDocuments(orgA, { page: 2, limit: 2 });
      assert.strictEqual(page2.length, 1);
      assert.strictEqual(page2[0].id, 'doc-search-1');
    });

    it('casos de error y borrado de elementos inexistentes en todos los métodos', async () => {
      // Borrado de documento inexistente
      const delDocNonExistent = await repo.deleteDocument(orgA, 'doc-does-not-exist');
      assert.strictEqual(delDocNonExistent, false);

      // Borrado de cliente inexistente
      const delCliNonExistent = await repo.deleteClient(orgA, 'cli-does-not-exist');
      assert.strictEqual(delCliNonExistent, false);

      // Borrado de partida de catálogo inexistente
      const delCatNonExistent = await repo.deleteCatalogItem(orgA, 'cat-does-not-exist');
      assert.strictEqual(delCatNonExistent, false);

      // Borrado de miembro inexistente
      const delMemNonExistent = await repo.deleteMember(orgA, 'mem-does-not-exist');
      assert.strictEqual(delMemNonExistent, false);

      // Búsqueda de documento por token o ID inexistente
      const byTokenNull = await repo.findDocumentByTokenOrId('non-existent-token-or-id');
      assert.strictEqual(byTokenNull, null);
    });

    it('gestión de miembros, organizaciones, ajustes y licencias', async () => {
      // 1. Miembros de organización
      const member: Membership = {
        id: 'mem-1',
        org_id: orgA,
        user_id: 'usr-123',
        role: 'employee',
        created_at: new Date().toISOString(),
      };
      await repo.saveMember(member);
      const members = await repo.getMembers(orgA);
      assert.strictEqual(members.length, 1);
      assert.strictEqual(members[0].role, 'employee');

      const deletedMem = await repo.deleteMember(orgA, 'mem-1');
      assert.strictEqual(deletedMem, true);
      const membersAfter = await repo.getMembers(orgA);
      assert.strictEqual(membersAfter.length, 0);

      // 2. Organización y getAllOrganizations
      const org: Org = {
        id: 'org-test-multi',
        name: 'Multi Org Test S.L.',
        tax_id: 'B99998888',
        address: 'Calle Industria 1',
        postal_code: '28001',
        city: 'Madrid',
        country: 'España',
      };
      await repo.saveOrganization(org);
      const fetchedOrg = await repo.getOrganization('org-test-multi');
      assert.strictEqual(fetchedOrg?.name, 'Multi Org Test S.L.');

      const allOrgs = await repo.getAllOrganizations();
      assert.ok(allOrgs.some((o) => o.id === 'org-test-multi'));

      // 3. Ajustes de Organización
      const settings: OrgSettings = {
        org_id: orgA,
        default_vat_rate: 21,
        default_irpf_rate: 15,
        default_validity_days: 30,
        default_payment_terms_days: 15,
        surcharge_enabled: false,
        theme: 'light',
      };
      await repo.saveOrgSettings(orgA, settings);
      const fetchedSettings = await repo.getOrgSettings(orgA);
      assert.strictEqual(fetchedSettings?.default_irpf_rate, 15);

      // 4. Licencias
      const license: License = {
        id: 'lic-branch-1',
        org_id: orgA,
        plan: 'pro',
        valid_until: '2028-01-01T00:00:00Z',
        is_active: true,
        stripe_subscription_id: 'sub-stripe-branch-test',
      };
      await repo.saveLicense(license);

      const licByOrg = await repo.getLicense(orgA);
      assert.strictEqual(licByOrg?.plan, 'pro');

      const licBySub = await repo.getLicenseBySubscriptionId('sub-stripe-branch-test');
      assert.strictEqual(licBySub?.org_id, orgA);

      const licNotFound = await repo.getLicenseBySubscriptionId('sub-not-found');
      assert.strictEqual(licNotFound, null);
    });
  });
}

describe('Mecanismos de Fallback de Almacenamiento Local (local.ts)', () => {
  it('safeGetStorage devuelve el valor de reserva ante JSON corrupto o entorno SSR', () => {
    storageMap.set('corrupt_key', '{ not-valid-json ]');
    const fallbackVal = { default: true };
    const val = safeGetStorage('corrupt_key', fallbackVal);
    assert.deepStrictEqual(val, fallbackVal);
  });

  it('safeSetStorage maneja excepciones de cuota en almacenamiento del navegador sin propagar caída', () => {
    const errorStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {},
      clear: () => {},
    };
    (globalThis as any).window[storageKey] = errorStorage;
    assert.doesNotThrow(() => {
      safeSetStorage('test_key', { foo: 'bar' });
    });
    // Restaurar mockStorage
    (globalThis as any).window[storageKey] = mockStorage;
  });
});
