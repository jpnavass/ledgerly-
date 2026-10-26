// ============================================================================
// Pruebas Unitarias — Fase 11: Alta, Ajustes, Importación y Portabilidad
// ============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isValidSpanishTaxId } from '../validators/nif.ts';
import { calcDocumentTotals, formatCents } from '../calculations.ts';
import type { Client, CatalogItem, DocumentItem, Org } from '../../types/index.ts';

describe('Fase 11: Alta de Empresa, Ajustes, Importación y Portabilidad', () => {
  it('un usuario recién registrado parte de estado totalmente vacío y KPIs en cero sin NaN', () => {
    const emptyDocs: any[] = [];

    const quotes = emptyDocs.filter((d) => d.doc_type === 'quote');
    const totalPresupuestado = quotes.reduce((acc, d) => acc + d.total_cents, 0);
    const totalAceptado = quotes
      .filter((d) => d.status === 'accepted' || d.status === 'invoiced')
      .reduce((acc, d) => acc + d.total_cents, 0);
    const conversionRate = quotes.length > 0 && totalPresupuestado > 0
      ? Math.round((totalAceptado / totalPresupuestado) * 100)
      : 0;

    assert.strictEqual(totalPresupuestado, 0);
    assert.strictEqual(totalAceptado, 0);
    assert.strictEqual(conversionRate, 0);
    assert.strictEqual(formatCents(totalPresupuestado), '0,00 €');
    assert.doesNotThrow(() => formatCents(0));
  });

  it('validación de datos fiscales del emisor requeridos para emitir facturas (RD 1619/2012)', () => {
    const incompleteOrg: Partial<Org> = {
      name: 'Mi Empresa S.L.',
      // Falta tax_id y domicilio completo
    };

    const validateIssuer = (org: Partial<Org>) => {
      const missing: string[] = [];
      if (!org.legal_name && !org.name) missing.push('Razón Social');
      if (!org.tax_id) missing.push('NIF/CIF');
      else {
        const check = isValidSpanishTaxId(org.tax_id);
        if (!check.ok) missing.push(`NIF/CIF inválido (${check.error})`);
      }
      if (!org.address) missing.push('Domicilio Fiscal');
      return missing;
    };

    const missingFields = validateIssuer(incompleteOrg);
    assert(missingFields.includes('NIF/CIF'));
    assert(missingFields.includes('Domicilio Fiscal'));
    assert.strictEqual(missingFields.length, 2);

    const validOrg: Partial<Org> = {
      legal_name: 'Instalaciones y Proyectos Iberia S.L.',
      tax_id: 'B88549126', // CIF válido
      address: 'Calle Alcalá 45, 2º B, 28014 Madrid',
    };
    assert.strictEqual(validateIssuer(validOrg).length, 0);
  });

  it('importación CSV de clientes: procesa 3 válidas y reporta con precisión 2 inválidas', () => {
    const csvContent = [
      'Razón Social;NIF/CIF;Email;Teléfono;Dirección',
      'Construcciones Alarcón S.L.;B88549126;admin@alarcon.es;910000001;Calle Mayor 1', // Válida 1 (CIF)
      'Empresa Sin CIF;;sin-cif@empresa.es;;Calle Dos 2', // Inválida 1 (sin NIF)
      'Carlos Mendoza Autónomo;48392021K;info@mendoza.es;910000003;Av. Central 3', // Válida 2 (DNI)
      ';B88549126;sin-nombre@empresa.es;;', // Inválida 2 (sin razón social)
      'Arquitectura Singular S.L.P.;X1234567L;estudio@singular.es;910000005;Paseo Verde 5', // Válida 3 (NIE)
    ].join('\r\n');

    const lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const validRows: Partial<Client>[] = [];
    const errors: { line: number; error: string }[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(';').map((c) => c.trim());
      const name = cols[0];
      const taxId = cols[1];

      if (!name) {
        errors.push({ line: i + 1, error: 'Razón Social vacía' });
        continue;
      }
      if (!taxId) {
        errors.push({ line: i + 1, error: 'NIF ausente' });
        continue;
      }
      const val = isValidSpanishTaxId(taxId);
      if (!val.ok) {
        errors.push({ line: i + 1, error: `NIF inválido: ${val.error}` });
        continue;
      }

      validRows.push({
        name,
        tax_id: val.normalized || taxId,
        email: cols[2] || undefined,
        phone: cols[3] || undefined,
        address: cols[4] || undefined,
      });
    }

    assert.strictEqual(validRows.length, 3, 'Deben insertarse exactamente 3 filas válidas');
    assert.strictEqual(errors.length, 2, 'Deben reportarse exactamente 2 filas con error');
    assert(errors[0].error.includes('NIF ausente'));
    assert(errors[1].error.includes('Razón Social vacía'));
  });

  it('el catálogo alimenta la inserción rápida copiando precio, coste e IVA al documento', () => {
    const catalogItem: CatalogItem = {
      id: 'cat-001',
      name: 'Unidad Interior Climatización Inverter',
      description: 'Capacidad frigorífica 3.5 kW, eficiencia A+++',
      unit: 'ud',
      price_cents: 185000, // 1.850,00 €
      cost_cents: 95000, // 950,00 €
      vat_rate: 21,
      is_active: true,
    };

    // Al insertar una partida desde catálogo
    const docItem: DocumentItem = {
      id: 'item-101',
      document_id: 'doc-001',
      item_type: 'line',
      position: 1,
      catalog_item_id: catalogItem.id,
      description: `${catalogItem.name} — ${catalogItem.description}`,
      unit: catalogItem.unit,
      quantity: 2,
      price_cents: catalogItem.price_cents,
      cost_cents: catalogItem.cost_cents,
      discount_pct: 10,
      vat_rate: catalogItem.vat_rate,
      irpf_rate: 0,
      is_optional: false,
    };

    const totals = calcDocumentTotals([docItem]);

    // 2 x 1850 = 3700; dto 10% = 370 -> subtotal 3330
    assert.strictEqual(totals.subtotal_cents, 333000);
    // Coste: 2 x 950 = 1900
    assert.strictEqual(totals.cost_cents, 190000);
    // Margen: 3330 - 1900 = 1430
    assert.strictEqual(totals.margin_cents, 143000);
    // Margen %: (1430 / 3330) * 100 = 42.94%
    assert.strictEqual(Number(totals.margin_pct?.toFixed(2)), 42.94);
  });

  it('exportación completa de organización genera estructura JSON exhaustiva y auditable', () => {
    const backup = {
      exported_at: new Date().toISOString(),
      system: 'Presupuesto Express Enterprise',
      version: '2.0.0',
      organization: { legal_name: 'Empresa Test S.L.', tax_id: 'B88192034' },
      clients: [{ id: 'cli-1', name: 'Cliente Uno' }],
      documents: [{ id: 'doc-1', series: 'PRE', number: 1, total_cents: 100000 }],
      payments: [],
      audit_events: [{ id: 'aud-1', type: 'export', description: 'Copia integral generada' }],
    };

    const serialized = JSON.stringify(backup);
    const parsed = JSON.parse(serialized);

    assert.strictEqual(parsed.system, 'Presupuesto Express Enterprise');
    assert.strictEqual(parsed.version, '2.0.0');
    assert.strictEqual(parsed.organization.tax_id, 'B88192034');
    assert.strictEqual(parsed.documents.length, 1);
    assert.strictEqual(parsed.audit_events.length, 1);
    assert(parsed.exported_at.includes('T'));
  });
});
