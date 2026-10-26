// ============================================================================
// Pruebas Unitarias — Tesorería, Hitos de Cobro y Exportación CSV (payments.test.ts)
// ============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMilestones,
  registerPayment,
  exportInvoicesToCsv,
  PaymentError,
  type MilestoneSpec,
} from '../domain/payments.ts';
import type { Payment } from '../../types/index.ts';

describe('Tesorería, Hitos y Cobros (payments.ts)', () => {
  it('método del resto: 3 hitos de 33.33%, 33.33% y 33.34% sobre 100,00 € suman exactamente 10.000 céntimos', () => {
    const specs: MilestoneSpec[] = [
      { label: 'Anticipo inicio', percentage: 33.33, due_days: 0 },
      { label: 'Certificación intermedia', percentage: 33.33, due_days: 30 },
      { label: 'Entrega y fin de obra', percentage: 33.34, due_days: 60 },
    ];

    const milestones = buildMilestones(10000, specs);
    assert.strictEqual(milestones.length, 3);

    const sum = milestones.reduce((acc, m) => acc + m.amount_cents, 0);
    assert.strictEqual(sum, 10000);
    assert.strictEqual(milestones[0].amount_cents, 3333);
    assert.strictEqual(milestones[1].amount_cents, 3333);
    assert.strictEqual(milestones[2].amount_cents, 3334);
  });

  it('propiedad matemática: en 1.000 combinaciones pseudoaleatorias con semilla determinista la suma de hitos coincide al céntimo', () => {
    // Generador pseudoaleatorio congruencial lineal LCG con semilla fija
    let seed = 123456789;
    const lcg = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    for (let test = 0; test < 1000; test++) {
      // Importe entre 10,00 € (1.000 céntimos) y 50.000,00 € (5.000.000 céntimos)
      const totalCents = Math.floor(1000 + lcg() * 4999000);

      // Entre 2 y 5 hitos con porcentajes que suman 100%
      const numMilestones = 2 + Math.floor(lcg() * 4); // 2, 3, 4 o 5
      const rawWeights = Array.from({ length: numMilestones }, () => 1 + lcg() * 10);
      const sumWeights = rawWeights.reduce((a, b) => a + b, 0);

      const pcts = rawWeights.map((w) => Number(((w / sumWeights) * 100).toFixed(2)));
      const currentSum = pcts.reduce((a, b) => a + b, 0);
      const diff = Number((100 - currentSum).toFixed(2));
      pcts[pcts.length - 1] = Number((pcts[pcts.length - 1] + diff).toFixed(2));

      const specs: MilestoneSpec[] = pcts.map((pct, idx) => ({
        label: `Hito ${idx + 1}`,
        percentage: pct,
        due_days: idx * 15,
      }));

      const result = buildMilestones(totalCents, specs);
      const actualSum = result.reduce((acc, m) => acc + m.amount_cents, 0);

      assert.strictEqual(
        actualSum,
        totalCents,
        `Iteración ${test}: suma de hitos (${actualSum}) debe coincidir con totalCents (${totalCents})`
      );
    }
  });

  it('cobro parcial transita factura a partially_paid y liquidación final a paid', () => {
    const totalInvoiceCents = 100000; // 1.000,00 €
    const initialPayments: Payment[] = [
      {
        id: 'p-1',
        document_id: 'doc-fac-1',
        label: 'Certificación 1',
        amount_cents: 100000,
        status: 'pending',
      },
    ];

    // 1. Cobro parcial de 400,00 € (40.000 céntimos)
    const step1 = registerPayment(initialPayments, 'p-1', totalInvoiceCents, {
      amountCents: 40000,
      method: 'transferencia',
    });

    assert.strictEqual(step1.documentStatus, 'partially_paid');
    assert.strictEqual(step1.totalPaidCents, 40000);
    assert.strictEqual(step1.pendingCents, 60000);

    // Debe haberse creado el hito restante pendiente
    const remainingHito = step1.updatedPayments.find(
      (p) => p.status === 'pending' && p.amount_cents === 60000
    );
    assert(remainingHito);

    // 2. Cobro del resto (60.000 céntimos)
    const step2 = registerPayment(step1.updatedPayments, remainingHito.id, totalInvoiceCents, {
      amountCents: 60000,
      method: 'transferencia',
    });

    assert.strictEqual(step2.documentStatus, 'paid');
    assert.strictEqual(step2.totalPaidCents, 100000);
    assert.strictEqual(step2.pendingCents, 0);
  });

  it('sobrecobro por encima del pendiente es rechazado de forma estricta', () => {
    const totalInvoiceCents = 50000;
    const payments: Payment[] = [
      {
        id: 'p-single',
        document_id: 'doc-fac-2',
        label: 'Pago único',
        amount_cents: 50000,
        status: 'pending',
      },
    ];

    // Cobrar 50.001 céntimos sobre 50.000
    assert.throws(
      () =>
        registerPayment(payments, 'p-single', totalInvoiceCents, {
          amountCents: 50001,
        }),
      (err: Error) => err instanceof PaymentError && err.message.includes('No puede superar el pendiente')
    );
  });

  it('exportación de facturas a CSV: codifica UTF-8 con BOM, separador punto y coma y escapa saltos y comillas', () => {
    const sampleInvoices = [
      {
        series: 'FAC',
        number: 1,
        issue_date: '2027-02-15',
        client_name: 'Constructora "El Roble", S.A.\nSucursal Centro',
        client_tax_id: 'A28012345',
        subtotal_cents: 100000,
        vat_cents: 21000,
        total_cents: 121000,
        status: 'issued',
      },
    ];

    const csv = exportInvoicesToCsv(sampleInvoices);

    // Empieza por Byte Order Mark (BOM) UTF-8
    assert.strictEqual(csv.charCodeAt(0), 0xfeff);

    // Usa punto y coma como separador
    assert(csv.includes(';'));

    // Formato español de moneda (con coma decimal)
    assert(csv.includes('"1000,00"'));
    assert(csv.includes('"210,00"'));
    assert(csv.includes('"1210,00"'));

    // Comillas dobles escapadas (""El Roble"")
    assert(csv.includes('""El Roble""'));
  });

  it('cobertura de ramas: buildMilestones valida importes positivos, specs no vacíos, suma 100% e importes fijos', () => {
    // Total no válido
    assert.throws(() => buildMilestones(0, [{ label: 'Único', percentage: 100 }]), PaymentError);
    assert.throws(() => buildMilestones(-500, [{ label: 'Único', percentage: 100 }]), PaymentError);

    // Specs vacíos
    assert.throws(() => buildMilestones(1000, []), PaymentError);

    // Suma porcentajes incorrecta (distinta de 100)
    assert.throws(
      () =>
        buildMilestones(1000, [
          { label: 'H1', percentage: 50 },
          { label: 'H2', percentage: 40 },
        ]),
      PaymentError
    );

    // Hitos por importe fijo y fecha por defecto
    const fixedMilestones = buildMilestones(1000, [
      { label: 'Señal', amount_cents: 300, due_days: 0 },
      { label: 'Entrega', amount_cents: 700, due_days: 15 },
    ]);
    assert.strictEqual(fixedMilestones.length, 2);
    assert.strictEqual(fixedMilestones[0].amount_cents, 300);
    assert.strictEqual(fixedMilestones[1].amount_cents, 700);
  });

  it('cobertura de ramas: registerPayment valida hito inexistente, hito ya cobrado, cobro parcial y sobrecobro', () => {
    const p1 = {
      id: 'p-branch-1',
      document_id: 'doc-1',
      label: 'Hito 1',
      amount_cents: 10000,
      due_date: '2027-03-01',
      status: 'pending' as const,
    };
    const p2 = {
      id: 'p-branch-2',
      document_id: 'doc-1',
      label: 'Hito 2',
      amount_cents: 10000,
      due_date: '2027-03-15',
      status: 'completed' as const,
      paid_at: '2027-03-01',
    };

    // Hito inexistente
    assert.throws(() => registerPayment([p1], 'p-fantasma', 20000), /no encontrado/);

    // Hito ya completado
    assert.throws(() => registerPayment([p2], 'p-branch-2', 20000), /ya fue liquidado/);

    // Importe 0 o negativo
    assert.throws(() => registerPayment([p1], 'p-branch-1', 20000, { amountCents: 0 }), PaymentError);
    assert.throws(() => registerPayment([p1], 'p-branch-1', 20000, { amountCents: -50 }), PaymentError);

    // Cobro parcial de un hito: genera resto y actualiza estado a partially_paid
    const resPartial = registerPayment([p1], 'p-branch-1', 10000, { amountCents: 4000 });
    assert.strictEqual(resPartial.documentStatus, 'partially_paid');
    assert.strictEqual(resPartial.totalPaidCents, 4000);
    assert.strictEqual(resPartial.pendingCents, 6000);
    assert.strictEqual(resPartial.updatedPayments.length, 2);
    assert.strictEqual(resPartial.updatedPayments[1].amount_cents, 6000);

    // Sobrecobro que excede totalDocCents
    assert.throws(
      () =>
        registerPayment([p1], 'p-branch-1', 5000, { amountCents: 10000 }),
      /Sobrecobro detectado/
    );
  });

  it('cobertura de ramas: exportInvoicesToCsv maneja borradores sin serie e importes negativos rectificativos', () => {
    const mixedInvoices = [
      {
        series: null,
        number: null,
        issue_date: undefined,
        client_name: undefined,
        client_tax_id: undefined,
        subtotal_cents: 0,
        vat_cents: 0,
        total_cents: 0,
        status: 'draft',
      },
      {
        series: 'REC',
        number: 5,
        issue_date: '2027-03-01',
        client_name: 'Cliente Rectificado',
        client_tax_id: 'B99999999',
        subtotal_cents: -10000,
        vat_cents: -2100,
        total_cents: -12100,
        status: 'issued',
      },
    ];

    const csv = exportInvoicesToCsv(mixedInvoices);
    assert(csv.includes('"BORRADOR"'));
    assert(csv.includes('"-100,00"'));
    assert(csv.includes('"-21,00"'));
    assert(csv.includes('"-121,00"'));
  });
});
