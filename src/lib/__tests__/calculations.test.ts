import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  calcLineBreakdown,
  calcLineSubtotal,
  calcLineVat,
  calcLineIrpf,
  calcLineTotal,
  calcDocumentTotals,
  CalculationError,
  type CalcLineInput,
} from '../calculations.ts';

describe('FASE 1: Motor de Cálculos Económicos y Cumplimiento Fiscal (calculations.ts)', () => {
  it('Calcula partida con cantidad fraccionaria: 1,5 x 3.333 con 10% de descuento', () => {
    // 1,5 × 3.333 = 4.999,5 -> bruto 5.000 (half-up)
    // Descuento 10%: round(5000 * 0.1) = 500
    // Subtotal: 5.000 - 500 = 4.500
    const line: CalcLineInput = {
      item_type: 'line',
      is_optional: false,
      quantity: 1.5,
      price_cents: 3333,
      discount_pct: 10,
      vat_rate: 21,
      irpf_rate: 0,
    };
    const breakdown = calcLineBreakdown(line);
    assert.strictEqual(breakdown.gross_cents, 5000);
    assert.strictEqual(breakdown.discount_cents, 500);
    assert.strictEqual(breakdown.subtotal_cents, 4500);

    const docTotals = calcDocumentTotals([line]);
    assert.strictEqual(docTotals.subtotal_cents, 4500);
    assert.strictEqual(docTotals.vat_cents, 945); // 4500 * 0.21 = 945
    assert.strictEqual(docTotals.total_cents, 5445); // 4500 + 945 = 5445
  });

  it('Calcula 3 x 1.999 al 21%: subtotal 5.997, IVA 1.259, total 7.256', () => {
    // 3 * 1999 = 5997
    // IVA 21%: round(5997 * 0.21) = round(1259.37) = 1259
    // Total: 5997 + 1259 = 7256
    const line: CalcLineInput = {
      item_type: 'line',
      is_optional: false,
      quantity: 3,
      price_cents: 1999,
      discount_pct: 0,
      vat_rate: 21,
      irpf_rate: 0,
    };
    const docTotals = calcDocumentTotals([line]);
    assert.strictEqual(docTotals.subtotal_cents, 5997);
    assert.strictEqual(docTotals.vat_cents, 1259);
    assert.strictEqual(docTotals.total_cents, 7256);
  });

  it('Demuestra la regla fiscal RD 1619/2012: IVA calculado por tipo sobre suma de bases', () => {
    // Tres líneas de 1 × 12 céntimos al 21%
    // Si se sumase el IVA por línea: round(12 * 0.21) = 3 céntimos por línea -> 3 * 3 = 9 céntimos (INCORRECTO)
    // Según RD 1619/2012 (por tipo): Base = 36 céntimos. Cuota = round(36 * 0.21) = round(7.56) = 8 céntimos (CORRECTO)
    const items: CalcLineInput[] = [
      { item_type: 'line', is_optional: false, quantity: 1, price_cents: 12, discount_pct: 0, vat_rate: 21, irpf_rate: 0 },
      { item_type: 'line', is_optional: false, quantity: 1, price_cents: 12, discount_pct: 0, vat_rate: 21, irpf_rate: 0 },
      { item_type: 'line', is_optional: false, quantity: 1, price_cents: 12, discount_pct: 0, vat_rate: 21, irpf_rate: 0 },
    ];
    const totals = calcDocumentTotals(items);
    assert.strictEqual(totals.subtotal_cents, 36);
    assert.strictEqual(totals.vat_cents, 8);
    assert.strictEqual(totals.total_cents, 44);
  });

  it('Desglosa correctamente documento multitasa (10% y 21%)', () => {
    const items: CalcLineInput[] = [
      { item_type: 'line', is_optional: false, quantity: 1, price_cents: 10000, discount_pct: 0, vat_rate: 10, irpf_rate: 0 },
      { item_type: 'line', is_optional: false, quantity: 1, price_cents: 20000, discount_pct: 0, vat_rate: 21, irpf_rate: 0 },
    ];
    const totals = calcDocumentTotals(items);
    assert.strictEqual(totals.subtotal_cents, 30000);
    assert.strictEqual(totals.vat_breakdown.length, 2); // 10% y 21% presentes en el documento

    const row10 = totals.vat_breakdown.find((r) => r.vat_rate === 10);
    const row21 = totals.vat_breakdown.find((r) => r.vat_rate === 21);

    assert.strictEqual(row10?.base_cents, 10000);
    assert.strictEqual(row10?.vat_cents, 1000);
    assert.strictEqual(row21?.base_cents, 20000);
    assert.strictEqual(row21?.vat_cents, 4200);

    assert.strictEqual(totals.vat_cents, 5200);
    assert.strictEqual(totals.total_cents, 35200);
  });

  it('Calcula retención IRPF (15%) y Recargo de Equivalencia (5,2%)', () => {
    const items: CalcLineInput[] = [
      { item_type: 'line', is_optional: false, quantity: 1, price_cents: 100000, discount_pct: 0, vat_rate: 21, irpf_rate: 15 },
    ];
    const totals = calcDocumentTotals(items, { apply_surcharge: true });
    assert.strictEqual(totals.subtotal_cents, 100000);
    assert.strictEqual(totals.vat_cents, 21000); // 21%
    assert.strictEqual(totals.surcharge_cents, 5200); // 5.2%
    assert.strictEqual(totals.irpf_cents, 15000); // 15%
    // Total = 100000 + 21000 + 5200 - 15000 = 111200
    assert.strictEqual(totals.total_cents, 111200);
  });

  it('Excluye partidas opcionales del total contractual e informa en optional_total_cents', () => {
    const items: CalcLineInput[] = [
      { item_type: 'line', is_optional: false, quantity: 1, price_cents: 50000, discount_pct: 0, vat_rate: 21, irpf_rate: 0 },
      { item_type: 'line', is_optional: true, quantity: 2, price_cents: 20000, discount_pct: 0, vat_rate: 21, irpf_rate: 0 },
    ];
    const totals = calcDocumentTotals(items);
    assert.strictEqual(totals.subtotal_cents, 50000);
    assert.strictEqual(totals.total_cents, 60500); // 50000 + 21% IVA = 60500
    // Opcional: 2 * 20000 = 40000 + 21% IVA (8400) = 48400
    assert.strictEqual(totals.optional_total_cents, 48400);
  });

  it('Gestiona capítulos y agrupa sus subtotales en chapters', () => {
    const items: CalcLineInput[] = [
      { item_type: 'chapter', is_optional: false, quantity: 0, price_cents: 0, discount_pct: 0, vat_rate: 0, irpf_rate: 0 },
      { item_type: 'line', is_optional: false, quantity: 2, price_cents: 1000, discount_pct: 0, vat_rate: 21, irpf_rate: 0 },
      { item_type: 'chapter', is_optional: false, quantity: 0, price_cents: 0, discount_pct: 0, vat_rate: 0, irpf_rate: 0 },
      { item_type: 'line', is_optional: false, quantity: 3, price_cents: 2000, discount_pct: 0, vat_rate: 21, irpf_rate: 0 },
    ];
    const totals = calcDocumentTotals(items);
    assert.strictEqual(totals.chapters.length, 2);
    assert.strictEqual(totals.chapters[0].subtotal_cents, 2000);
    assert.strictEqual(totals.chapters[1].subtotal_cents, 6000);
    assert.strictEqual(totals.subtotal_cents, 8000);
  });

  it('Soporta importes negativos para facturas rectificativas manteniendo coherencia', () => {
    const items: CalcLineInput[] = [
      { item_type: 'line', is_optional: false, quantity: 1, price_cents: -100000, discount_pct: 0, vat_rate: 21, irpf_rate: 0 },
    ];
    const totals = calcDocumentTotals(items);
    assert.strictEqual(totals.subtotal_cents, -100000);
    assert.strictEqual(totals.vat_cents, -21000);
    assert.strictEqual(totals.total_cents, -121000);
  });

  it('Calcula margen comercial y porcentaje exacto', () => {
    // Venta: 185.000 cts, Coste: 95.000 cts
    // Margen: 90.000 cts. % = (90000 / 185000) * 100 = 48.6486... -> 48.65%
    const items: CalcLineInput[] = [
      {
        item_type: 'line',
        is_optional: false,
        quantity: 1,
        price_cents: 185000,
        cost_cents: 95000,
        discount_pct: 0,
        vat_rate: 21,
        irpf_rate: 0,
      },
    ];
    const totals = calcDocumentTotals(items);
    assert.strictEqual(totals.cost_cents, 95000);
    assert.strictEqual(totals.margin_cents, 90000);
    assert.strictEqual(totals.margin_pct, 48.65);
  });

  it('Lanza CalculationError ante entradas inválidas o tasas no reglamentarias', () => {
    assert.throws(
      () =>
        calcDocumentTotals([
          { item_type: 'line', is_optional: false, quantity: 1, price_cents: 100, discount_pct: 0, vat_rate: 7, irpf_rate: 0 },
        ]),
      CalculationError
    );

    assert.throws(
      () =>
        calcDocumentTotals([
          { item_type: 'line', is_optional: false, quantity: 1.1234, price_cents: 100, discount_pct: 0, vat_rate: 21, irpf_rate: 0 },
        ]),
      CalculationError
    );

    assert.throws(
      () =>
        calcDocumentTotals([
          { item_type: 'line', is_optional: false, quantity: 1, price_cents: 100, discount_pct: 120, vat_rate: 21, irpf_rate: 0 },
        ]),
      CalculationError
    );
  });

  it('Propiedad matemática: para 1.000 documentos sintéticos, todos los totales son enteros seguros y cuadran', () => {
    // Prueba de propiedad con generador pseudoaleatorio determinista LCG
    let seed = 123456789;
    const lcg = () => {
      seed = (1103515245 * seed + 12345) % 2147483648;
      return seed / 2147483648;
    };

    const allowedVats = [0, 4, 10, 21];

    for (let d = 0; d < 1000; d++) {
      const numLines = 1 + Math.floor(lcg() * 5);
      const items: CalcLineInput[] = [];

      for (let l = 0; l < numLines; l++) {
        const qty = 1 + Math.floor(lcg() * 10);
        const price = Math.floor(lcg() * 100000);
        const disc = Math.floor(lcg() * 30);
        const vat = allowedVats[Math.floor(lcg() * allowedVats.length)];
        const irpf = lcg() > 0.5 ? 15 : 0;

        items.push({
          item_type: 'line',
          is_optional: false,
          quantity: qty,
          price_cents: price,
          discount_pct: disc,
          vat_rate: vat,
          irpf_rate: irpf,
        });
      }

      const totals = calcDocumentTotals(items, { apply_surcharge: lcg() > 0.5 });

      assert.ok(Number.isSafeInteger(totals.subtotal_cents));
      assert.ok(Number.isSafeInteger(totals.discount_cents));
      assert.ok(Number.isSafeInteger(totals.vat_cents));
      assert.ok(Number.isSafeInteger(totals.surcharge_cents));
      assert.ok(Number.isSafeInteger(totals.irpf_cents));
      assert.ok(Number.isSafeInteger(totals.total_cents));

      // Ecuación tributaria exacta:
      const expectedTotal = totals.subtotal_cents + totals.vat_cents + totals.surcharge_cents - totals.irpf_cents;
      assert.strictEqual(totals.total_cents, expectedTotal);
    }
  });
});
