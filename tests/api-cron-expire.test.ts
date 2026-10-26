// ============================================================================
// Pruebas Unitarias — Proceso Cron de Caducidad de Presupuestos
// ============================================================================

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { processExpiredQuotes } from '../src/lib/domain/cron-expire.ts';
import { MemoryRepository } from '../src/lib/repo/memory.ts';
import type { Document, Org, Client } from '../src/types/index.ts';

describe('Proceso Cron de Caducidad de Presupuestos (cron-expire.ts)', () => {
  let memoryRepo: MemoryRepository;
  const orgId = 'org-cron-test';

  const testOrg: Org = {
    id: orgId,
    name: 'Org Cron Test S.L.',
    tax_id: 'B12345678',
    address: 'Calle Cron 1',
    postal_code: '28001',
    city: 'Madrid',
    country: 'España',
  };

  const testClient: Client = {
    id: 'cli-cron-1',
    name: 'Cliente Cron S.A.',
    tax_id: 'A87654321',
    address: 'Av. Siempre Viva',
    postal_code: '28002',
    city: 'Madrid',
    country: 'España',
  };

  beforeEach(async () => {
    memoryRepo = new MemoryRepository();
    await memoryRepo.saveOrganization(testOrg);
    await memoryRepo.saveClient(orgId, testClient);
  });

  it('bloquea ejecución no autorizada si CRON_SECRET está configurado y el token no coincide', async () => {
    // 1. Petición sin autorización
    const resNoAuth = await processExpiredQuotes({
      repo: memoryRepo,
      orgId,
      cronSecret: 'super-secret-key',
      authorizationHeader: null,
    });
    assert.strictEqual(resNoAuth.ok, false);
    assert.strictEqual(resNoAuth.unauthorized, true);

    // 2. Petición con token incorrecto
    const resBadToken = await processExpiredQuotes({
      repo: memoryRepo,
      orgId,
      cronSecret: 'super-secret-key',
      authorizationHeader: 'Bearer token-invalido',
    });
    assert.strictEqual(resBadToken.ok, false);
    assert.strictEqual(resBadToken.unauthorized, true);

    // 3. Petición con token correcto
    const resAuth = await processExpiredQuotes({
      repo: memoryRepo,
      orgId,
      cronSecret: 'super-secret-key',
      authorizationHeader: 'Bearer super-secret-key',
    });
    assert.strictEqual(resAuth.ok, true);
    assert.strictEqual(resAuth.unauthorized, false);
  });

  it('identifica y expira presupuestos vencidos en estado sent y viewed, dejando intactos los vigentes', async () => {
    // 1. Presupuesto 1: vencido ('sent', valid_until: '2027-01-01')
    const expiredQuote: Document = {
      id: 'quote-expired-1',
      org_id: orgId,
      doc_type: 'quote',
      series: 'PRE',
      number: 1,
      version: 1,
      status: 'sent',
      valid_until: '2027-01-01',
      subtotal_cents: 10000,
      vat_cents: 2100,
      discount_cents: 0,
      irpf_cents: 0,
      total_cents: 12100,
      items: [],
      created_at: '2026-12-01T00:00:00Z',
      updated_at: '2026-12-01T00:00:00Z',
    };

    // 2. Presupuesto 2: vencido ('viewed', valid_until: '2027-01-10')
    const viewedExpiredQuote: Document = {
      id: 'quote-expired-2',
      org_id: orgId,
      doc_type: 'quote',
      series: 'PRE',
      number: 2,
      version: 1,
      status: 'viewed',
      valid_until: '2027-01-10',
      subtotal_cents: 20000,
      vat_cents: 4200,
      discount_cents: 0,
      irpf_cents: 0,
      total_cents: 24200,
      items: [],
      created_at: '2026-12-05T00:00:00Z',
      updated_at: '2026-12-05T00:00:00Z',
    };

    // 3. Presupuesto 3: vigente ('sent', valid_until: '2027-03-01')
    const activeQuote: Document = {
      id: 'quote-active-3',
      org_id: orgId,
      doc_type: 'quote',
      series: 'PRE',
      number: 3,
      version: 1,
      status: 'sent',
      valid_until: '2027-03-01',
      subtotal_cents: 15000,
      vat_cents: 3150,
      discount_cents: 0,
      irpf_cents: 0,
      total_cents: 18150,
      items: [],
      created_at: '2027-01-15T00:00:00Z',
      updated_at: '2027-01-15T00:00:00Z',
    };

    await memoryRepo.saveDocument(orgId, expiredQuote);
    await memoryRepo.saveDocument(orgId, viewedExpiredQuote);
    await memoryRepo.saveDocument(orgId, activeQuote);

    // Ejecutar con fecha 2027-02-01
    const res = await processExpiredQuotes({
      repo: memoryRepo,
      orgId,
      todayIso: '2027-02-01',
    });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.processedCount, 3);
    assert.strictEqual(res.expiredCount, 2);
    assert.ok(res.expiredIds.includes('quote-expired-1'));
    assert.ok(res.expiredIds.includes('quote-expired-2'));
    assert.ok(!res.expiredIds.includes('quote-active-3'));

    // Verificar en el repositorio que se persistió el cambio de estado
    const doc1 = await memoryRepo.getDocumentById(orgId, 'quote-expired-1');
    const doc2 = await memoryRepo.getDocumentById(orgId, 'quote-expired-2');
    const doc3 = await memoryRepo.getDocumentById(orgId, 'quote-active-3');

    assert.strictEqual(doc1?.status, 'expired');
    assert.strictEqual(doc2?.status, 'expired');
    assert.strictEqual(doc3?.status, 'sent'); // El vigente no debe cambiar
  });

  it('itera todas las organizaciones vía Repository cuando no se especifica orgId', async () => {
    const orgAlpha: Org = {
      id: 'org-alpha',
      name: 'Alpha Construcciones S.L.',
      tax_id: 'B11111111',
      address: 'Calle A 1',
      postal_code: '28001',
      city: 'Madrid',
      country: 'España',
    };

    const orgBeta: Org = {
      id: 'org-beta',
      name: 'Beta Reformas S.L.',
      tax_id: 'B22222222',
      address: 'Calle B 2',
      postal_code: '08001',
      city: 'Barcelona',
      country: 'España',
    };

    await memoryRepo.saveOrganization(orgAlpha);
    await memoryRepo.saveOrganization(orgBeta);

    // Presupuesto vencido en Org Alpha
    const quoteAlpha: Document = {
      id: 'quote-alpha-1',
      org_id: 'org-alpha',
      doc_type: 'quote',
      series: 'PRE',
      number: 10,
      version: 1,
      status: 'sent',
      valid_until: '2027-01-01',
      subtotal_cents: 5000,
      vat_cents: 1050,
      discount_cents: 0,
      irpf_cents: 0,
      total_cents: 6050,
      items: [],
      created_at: '2026-12-01T00:00:00Z',
      updated_at: '2026-12-01T00:00:00Z',
    };

    // Presupuesto vencido en Org Beta
    const quoteBeta: Document = {
      id: 'quote-beta-1',
      org_id: 'org-beta',
      doc_type: 'quote',
      series: 'PRE',
      number: 20,
      version: 1,
      status: 'viewed',
      valid_until: '2027-01-05',
      subtotal_cents: 8000,
      vat_cents: 1680,
      discount_cents: 0,
      irpf_cents: 0,
      total_cents: 9680,
      items: [],
      created_at: '2026-12-01T00:00:00Z',
      updated_at: '2026-12-01T00:00:00Z',
    };

    await memoryRepo.saveDocument('org-alpha', quoteAlpha);
    await memoryRepo.saveDocument('org-beta', quoteBeta);

    // Ejecución del cron sin especificar orgId (modo global SaaS)
    const result = await processExpiredQuotes({
      repo: memoryRepo,
      todayIso: '2027-02-01',
    });

    assert.strictEqual(result.ok, true);
    // Debe haber encontrado las organizaciones existentes (testOrg + orgAlpha + orgBeta = 3)
    assert.strictEqual(result.organizationsCount, 3);
    assert.ok(result.expiredIds.includes('quote-alpha-1'));
    assert.ok(result.expiredIds.includes('quote-beta-1'));

    // Comprobar persistencia en cada organización
    const storedAlpha = await memoryRepo.getDocumentById('org-alpha', 'quote-alpha-1');
    const storedBeta = await memoryRepo.getDocumentById('org-beta', 'quote-beta-1');
    assert.strictEqual(storedAlpha?.status, 'expired');
    assert.strictEqual(storedBeta?.status, 'expired');
  });
});
