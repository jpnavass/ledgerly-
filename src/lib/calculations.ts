// ============================================================================
// Motor de Cálculos Económicos y Cumplimiento Fiscal (RD 1619/2012)
// ============================================================================

import {
  assertCents,
  assertRate,
  roundHalfUp,
  formatCents,
  eurosToCents,
  centsToEuros,
  formatDocNumber,
  formatPercent,
} from './money.ts';

export {
  assertCents,
  assertRate,
  roundHalfUp,
  formatCents,
  eurosToCents,
  centsToEuros,
  formatDocNumber,
  formatPercent,
};

export class CalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalculationError';
  }
}

export type VatRate = 0 | 4 | 10 | 21;
export const ALLOWED_VAT_RATES: readonly VatRate[] = [0, 4, 10, 21];
export const SURCHARGE_BY_VAT: Record<VatRate, number> = {
  21: 5.2,
  10: 1.4,
  4: 0.5,
  0: 0,
};

export interface CalcLineInput {
  item_type: 'chapter' | 'line';
  is_optional: boolean;
  quantity: number; // decimales permitidos (máx. 3)
  price_cents: number; // entero seguro
  cost_cents?: number;
  discount_pct: number; // 0–100
  vat_rate: number;
  irpf_rate: number; // 0–100
}

export interface LineBreakdown {
  gross_cents: number;
  discount_cents: number;
  subtotal_cents: number;
  cost_cents: number;
}

export interface VatBreakdownRow {
  vat_rate: number;
  base_cents: number; // suma de subtotales de ese tramo
  vat_cents: number; // round(base * rate / 100) UNA vez por tramo
  surcharge_rate: number; // 0 si no aplica recargo
  surcharge_cents: number;
}

export interface DocumentTotals {
  subtotal_cents: number; // suma de subtotales netos de líneas
  discount_cents: number; // suma de descuentos de líneas
  vat_breakdown: VatBreakdownRow[];
  vat_cents: number;
  surcharge_cents: number;
  irpf_cents: number;
  total_cents: number; // subtotal + IVA + recargo - IRPF
  cost_cents: number;
  margin_cents: number; // subtotal - cost
  margin_pct: number | null; // null si subtotal = 0
  optional_total_cents: number; // partidas opcionales, informativo, NO suma al total
  chapters: Array<{ item_index: number; subtotal_cents: number }>;
}

/**
 * Valida minuciosamente una partida técnica antes de computar sus importes.
 */
function validateLineInput(line: CalcLineInput, index?: number): void {
  const lineRef = index !== undefined ? `en la partida #${index + 1}` : 'en la partida';

  if (!Number.isFinite(line.quantity) || Number.isNaN(line.quantity)) {
    throw new CalculationError(`La cantidad ${lineRef} no es un número válido.`);
  }

  // Comprobar que no exceda 3 decimales
  const qtyStr = line.quantity.toString();
  if (qtyStr.includes('.')) {
    const decimals = qtyStr.split('.')[1].length;
    if (decimals > 3) {
      throw new CalculationError(`La cantidad ${line.quantity} ${lineRef} excede el máximo permitido de 3 decimales.`);
    }
  }

  if (!Number.isSafeInteger(line.price_cents)) {
    throw new CalculationError(`El precio unitario en céntimos (${line.price_cents}) ${lineRef} debe ser un entero seguro.`);
  }

  if (line.cost_cents !== undefined && !Number.isSafeInteger(line.cost_cents)) {
    throw new CalculationError(`El coste en céntimos (${line.cost_cents}) ${lineRef} debe ser un entero seguro.`);
  }

  if (typeof line.discount_pct !== 'number' || line.discount_pct < 0 || line.discount_pct > 100) {
    throw new CalculationError(`El descuento (${line.discount_pct}%) ${lineRef} debe estar entre 0% y 100%.`);
  }

  if (line.item_type === 'line') {
    if (!ALLOWED_VAT_RATES.includes(line.vat_rate as VatRate)) {
      throw new CalculationError(
        `El tipo de IVA (${line.vat_rate}%) ${lineRef} no está permitido. Tipos vigentes: ${ALLOWED_VAT_RATES.join('%, ')}%.`
      );
    }
  }

  if (typeof line.irpf_rate !== 'number' || line.irpf_rate < 0 || line.irpf_rate > 100) {
    throw new CalculationError(`La retención de IRPF (${line.irpf_rate}%) ${lineRef} debe estar entre 0% y 100%.`);
  }
}

/**
 * Realiza el cálculo desglosado de una única línea.
 * Única fuente de verdad de la aritmética de partida.
 */
export function calcLineBreakdown(line: CalcLineInput, index?: number): LineBreakdown {
  validateLineInput(line, index);

  if (line.item_type === 'chapter') {
    return {
      gross_cents: 0,
      discount_cents: 0,
      subtotal_cents: 0,
      cost_cents: 0,
    };
  }

  const qtyMillis = Math.round(line.quantity * 1000);
  const gross_cents = roundHalfUp((qtyMillis * line.price_cents) / 1000);
  const discount_cents = roundHalfUp((gross_cents * line.discount_pct) / 100);
  const subtotal_cents = gross_cents - discount_cents;
  const cost_cents = line.cost_cents !== undefined ? roundHalfUp((qtyMillis * line.cost_cents) / 1000) : 0;

  return {
    gross_cents,
    discount_cents,
    subtotal_cents,
    cost_cents,
  };
}

/**
 * Funciones de conveniencia para cálculos individuales de partida (reutilizan calcLineBreakdown)
 */
export function calcLineSubtotal(quantity: number, price_cents: number, discount_pct = 0): number {
  const line: CalcLineInput = {
    item_type: 'line',
    is_optional: false,
    quantity,
    price_cents,
    discount_pct,
    vat_rate: 21,
    irpf_rate: 0,
  };
  return calcLineBreakdown(line).subtotal_cents;
}

export function calcLineVat(base_cents: number, vat_rate: number): number {
  if (!ALLOWED_VAT_RATES.includes(vat_rate as VatRate)) {
    throw new CalculationError(`Tipo de IVA no válido: ${vat_rate}%`);
  }
  return roundHalfUp((base_cents * vat_rate) / 100);
}

export function calcLineIrpf(base_cents: number, irpf_rate: number): number {
  if (irpf_rate < 0 || irpf_rate > 100) {
    throw new CalculationError(`Tipo de IRPF no válido: ${irpf_rate}%`);
  }
  return roundHalfUp((base_cents * irpf_rate) / 100);
}

export function calcLineTotal(
  quantity: number,
  price_cents: number,
  discount_pct = 0,
  vat_rate = 21,
  irpf_rate = 0
): {
  subtotal_cents: number;
  vat_cents: number;
  irpf_cents: number;
  total_cents: number;
} {
  const line: CalcLineInput = {
    item_type: 'line',
    is_optional: false,
    quantity,
    price_cents,
    discount_pct,
    vat_rate,
    irpf_rate,
  };
  const breakdown = calcLineBreakdown(line);
  const vat_cents = roundHalfUp((breakdown.subtotal_cents * vat_rate) / 100);
  const irpf_cents = roundHalfUp((breakdown.subtotal_cents * irpf_rate) / 100);
  const total_cents = breakdown.subtotal_cents + vat_cents - irpf_cents;

  return {
    subtotal_cents: breakdown.subtotal_cents,
    vat_cents,
    irpf_cents,
    total_cents,
  };
}

/**
 * Computa los totales completos de un documento oficial según RD 1619/2012:
 * 1. Calcula cada partida mediante `calcLineBreakdown`.
 * 2. Agrupa bases por tipo impositivo y calcula la cuota IVA UNA VEZ por tipo.
 * 3. Aplica recargo de equivalencia si `apply_surcharge` es verdadero.
 * 4. Agrupa bases por tasa de IRPF y calcula la retención sobre la base acumulada.
 * 5. Agrupa subtotales de partidas por capítulo.
 * 6. Excluye partidas opcionales del total contractual (informándolas en `optional_total_cents`).
 * 7. Calcula margen comercial en céntimos y porcentaje.
 */
export function calcDocumentTotals(
  items: CalcLineInput[],
  options: { apply_surcharge?: boolean } = {}
): DocumentTotals {
  const { apply_surcharge = false } = options;

  let subtotal_cents = 0;
  let discount_cents = 0;
  let cost_cents = 0;
  let optional_total_cents = 0;

  // Agrupación de bases por tipo impositivo de IVA
  const vatBases = new Map<VatRate, number>();
  for (const rate of ALLOWED_VAT_RATES) {
    vatBases.set(rate, 0);
  }

  // Agrupación de bases por tipo impositivo de IRPF
  const irpfBases = new Map<number, number>();

  // Seguimiento de capítulos
  const chapters: Array<{ item_index: number; subtotal_cents: number }> = [];
  let currentChapterIndex = -1;
  let currentChapterSubtotal = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const breakdown = calcLineBreakdown(item, i);

    if (item.item_type === 'chapter') {
      if (currentChapterIndex !== -1) {
        chapters.push({
          item_index: currentChapterIndex,
          subtotal_cents: currentChapterSubtotal,
        });
      }
      currentChapterIndex = i;
      currentChapterSubtotal = 0;
      continue;
    }

    if (item.is_optional) {
      // Partida opcional: no suma al total contractual ni capítulos
      const optVat = roundHalfUp((breakdown.subtotal_cents * item.vat_rate) / 100);
      const optIrpf = roundHalfUp((breakdown.subtotal_cents * item.irpf_rate) / 100);
      optional_total_cents += breakdown.subtotal_cents + optVat - optIrpf;
      continue;
    }

    // Partida ordinaria
    subtotal_cents += breakdown.subtotal_cents;
    discount_cents += breakdown.discount_cents;
    cost_cents += breakdown.cost_cents;
    currentChapterSubtotal += breakdown.subtotal_cents;

    // Acumular base para IVA
    const currentVatBase = vatBases.get(item.vat_rate as VatRate) || 0;
    vatBases.set(item.vat_rate as VatRate, currentVatBase + breakdown.subtotal_cents);

    // Acumular base para IRPF
    if (item.irpf_rate > 0) {
      const currentIrpfBase = irpfBases.get(item.irpf_rate) || 0;
      irpfBases.set(item.irpf_rate, currentIrpfBase + breakdown.subtotal_cents);
    }
  }

  // Guardar el último capítulo si existe
  if (currentChapterIndex !== -1) {
    chapters.push({
      item_index: currentChapterIndex,
      subtotal_cents: currentChapterSubtotal,
    });
  }

  // Cálculo de cuotas de IVA y Recargo de Equivalencia por tipo sobre base acumulada
  const vat_breakdown: VatBreakdownRow[] = [];
  let vat_cents = 0;
  let surcharge_cents = 0;

  for (const rate of ALLOWED_VAT_RATES) {
    const base = vatBases.get(rate) || 0;
    if (base !== 0 || items.some((it) => it.item_type === 'line' && !it.is_optional && it.vat_rate === rate)) {
      const quota = roundHalfUp((base * rate) / 100);
      vat_cents += quota;

      let surchargeQuota = 0;
      const surchargeRate = apply_surcharge ? SURCHARGE_BY_VAT[rate] : 0;
      if (surchargeRate > 0) {
        surchargeQuota = roundHalfUp((base * surchargeRate) / 100);
        surcharge_cents += surchargeQuota;
      }

      vat_breakdown.push({
        vat_rate: rate,
        base_cents: base,
        vat_cents: quota,
        surcharge_rate: surchargeRate,
        surcharge_cents: surchargeQuota,
      });
    }
  }

  // Cálculo de cuota IRPF sobre base acumulada por tramo
  let irpf_cents = 0;
  for (const [rate, base] of irpfBases.entries()) {
    irpf_cents += roundHalfUp((base * rate) / 100);
  }

  // Total contractual oficial: Subtotal neto + IVA + Recargo - IRPF
  const total_cents = subtotal_cents + vat_cents + surcharge_cents - irpf_cents;

  // Cálculo de margen comercial
  const margin_cents = subtotal_cents - cost_cents;
  const margin_pct = subtotal_cents !== 0 ? Math.round(((margin_cents / subtotal_cents) * 10000)) / 100 : null;

  return {
    subtotal_cents,
    discount_cents,
    vat_breakdown,
    vat_cents,
    surcharge_cents,
    irpf_cents,
    total_cents,
    cost_cents,
    margin_cents,
    margin_pct,
    optional_total_cents,
    chapters,
  };
}

export function calcDocumentMargin(subtotalCents: number, costCents: number): { margin_cents: number; margin_pct: number | null } {
  const margin_cents = subtotalCents - costCents;
  const margin_pct = subtotalCents !== 0 ? Math.round(((margin_cents / subtotalCents) * 10000)) / 100 : null;
  return { margin_cents, margin_pct };
}

