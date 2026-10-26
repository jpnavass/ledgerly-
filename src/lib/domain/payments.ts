// ============================================================================
// Dominio de Tesorería, Hitos de Cobro y Pagos — Presupuesto Express
// ============================================================================

import type { Payment, DocStatus } from '../../types/index.ts';

export class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentError';
  }
}

export interface MilestoneSpec {
  label: string;
  percentage?: number; // 0 - 100
  amount_cents?: number;
  due_days?: number;
}

/**
 * Reparte los hitos de cobro utilizando el método del resto para garantizar
 * que la suma de todos los importes en céntimos sea EXACTAMENTE igual a totalCents.
 */
export function buildMilestones(
  totalCents: number,
  specs: readonly MilestoneSpec[],
  issueDateIso?: string,
  documentId: string = ''
): Payment[] {
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0) {
    throw new PaymentError(`El importe total debe ser un entero positivo en céntimos: recibido ${totalCents}`);
  }

  if (specs.length === 0) {
    throw new PaymentError('Debe definirse al menos un hito de cobro.');
  }

  // Comprobar si se definen por porcentaje
  const usePercentage = specs.some((s) => s.percentage !== undefined);

  if (usePercentage) {
    const sumPct = specs.reduce((acc, s) => acc + (s.percentage || 0), 0);
    // Tolerancia para porcentajes como 33.33 + 33.33 + 33.34 = 100
    if (Math.abs(sumPct - 100) > 0.05) {
      throw new PaymentError(
        `La suma de porcentajes de los hitos (${sumPct.toFixed(2)}%) debe ser exactamente el 100%.`
      );
    }
  }

  const baseDate = issueDateIso ? new Date(issueDateIso) : new Date();

  // Calcular importes provisionales redondeando hacia abajo
  let allocatedCents = 0;
  const rawAmounts: number[] = [];

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    let cents: number;
    if (spec.amount_cents !== undefined) {
      cents = spec.amount_cents;
    } else {
      const pct = spec.percentage || 0;
      cents = Math.floor((totalCents * pct) / 100);
    }
    rawAmounts.push(cents);
    allocatedCents += cents;
  }

  // Método del resto: repartir la diferencia céntimo a céntimo desde el último hito
  let remainder = totalCents - allocatedCents;
  if (remainder !== 0) {
    let idx = specs.length - 1;
    while (remainder > 0) {
      rawAmounts[idx] += 1;
      remainder -= 1;
      idx = (idx - 1 + specs.length) % specs.length;
    }
    while (remainder < 0) {
      rawAmounts[idx] -= 1;
      remainder += 1;
      idx = (idx - 1 + specs.length) % specs.length;
    }
  }

  // Construir pagos definitivos
  const payments: Payment[] = [];
  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    const dueDate = new Date(baseDate.getTime() + (spec.due_days || 0) * 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);

    payments.push({
      id: `pay-${crypto.randomUUID()}`,
      document_id: documentId,
      label: spec.label,
      percentage: spec.percentage,
      amount_cents: rawAmounts[i],
      due_date: dueDate,
      status: 'pending',
      created_at: new Date().toISOString(),
    });
  }

  return payments;
}

export interface RegisterPaymentOptions {
  paidAtIso?: string;
  method?: string;
  amountCents?: number; // Para cobros parciales de un hito
}

/**
 * Registra un cobro parcial o total sobre una lista de pagos,
 * validando que no se sobrecobre y recalculando el estado del documento.
 */
export function registerPayment(
  payments: readonly Payment[],
  paymentId: string,
  totalDocCents: number,
  options: RegisterPaymentOptions = {}
): {
  updatedPayments: Payment[];
  documentStatus: DocStatus;
  totalPaidCents: number;
  pendingCents: number;
} {
  const target = payments.find((p) => p.id === paymentId);
  if (!target) {
    throw new PaymentError('Hito de pago no encontrado.');
  }

  if (target.status === 'completed') {
    throw new PaymentError('Este hito de cobro ya fue liquidado previamente.');
  }

  const payAmount = options.amountCents ?? target.amount_cents;
  if (payAmount <= 0 || payAmount > target.amount_cents) {
    throw new PaymentError(
      `Importe de cobro no válido (${payAmount} céntimos). No puede superar el pendiente del hito (${target.amount_cents} céntimos).`
    );
  }

  const paidAt = options.paidAtIso || new Date().toISOString();
  const method = options.method || 'transferencia';

  const isFullPayment = payAmount === target.amount_cents;

  const updatedPayments = payments.map((p) => {
    if (p.id !== paymentId) return p;
    return {
      ...p,
      amount_cents: payAmount,
      paid_at: paidAt,
      method,
      status: 'completed' as const,
    };
  });

  // Si fue cobro parcial del hito, crear hito con el resto pendiente
  if (!isFullPayment) {
    const remainingCents = target.amount_cents - payAmount;
    updatedPayments.push({
      id: `pay-${crypto.randomUUID()}`,
      document_id: target.document_id,
      label: `${target.label || 'Pago'} (Restante)`,
      amount_cents: remainingCents,
      due_date: target.due_date,
      status: 'pending',
      created_at: paidAt,
    });
  }

  // Calcular total cobrado
  const totalPaidCents = updatedPayments
    .filter((p) => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount_cents, 0);

  if (totalPaidCents > totalDocCents) {
    throw new PaymentError(
      `Sobrecobro detectado: el total cobrado acumulado (${totalPaidCents}) excede el total de la factura (${totalDocCents}).`
    );
  }

  const pendingCents = totalDocCents - totalPaidCents;
  let documentStatus: DocStatus;

  if (totalPaidCents === totalDocCents) {
    documentStatus = 'paid';
  } else if (totalPaidCents > 0) {
    documentStatus = 'partially_paid';
  } else {
    documentStatus = 'issued';
  }

  return {
    updatedPayments,
    documentStatus,
    totalPaidCents,
    pendingCents,
  };
}

/**
 * Genera el Libro de Facturas Emitidas en formato CSV oficial español:
 * - Separador punto y coma (;)
 * - Codificación UTF-8 con BOM (\uFEFF)
 * - Importes en formato decimal español con coma (1234,56)
 * - Campos de texto correctamente entrecomillados y escapados
 */
export function exportInvoicesToCsv(
  invoices: readonly {
    series: string | null;
    number: number | null | undefined;
    issue_date?: string;
    client_name?: string;
    client_tax_id?: string;
    subtotal_cents: number;
    vat_cents: number;
    total_cents: number;
    status: string;
  }[]
): string {
  const BOM = '\uFEFF';
  const headers = [
    'Serie y Número',
    'Fecha Expedición',
    'Destinatario',
    'NIF/CIF',
    'Base Imponible (€)',
    'Cuota IVA (€)',
    'Total (€)',
    'Estado',
  ];

  const escapeField = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return '""';
    const str = val.toString().replace(/"/g, '""');
    return `"${str}"`;
  };

  const formatEuroCsv = (cents: number): string => {
    const abs = Math.abs(cents);
    const sign = cents < 0 ? '-' : '';
    const euros = Math.trunc(abs / 100);
    const dec = (abs % 100).toString().padStart(2, '0');
    return `${sign}${euros},${dec}`;
  };

  const rows = [headers.map(escapeField).join(';')];

  for (const inv of invoices) {
    const fullNum = inv.series ? `${inv.series}-${inv.number || 0}` : 'BORRADOR';
    const row = [
      escapeField(fullNum),
      escapeField(inv.issue_date || ''),
      escapeField(inv.client_name || ''),
      escapeField(inv.client_tax_id || ''),
      escapeField(formatEuroCsv(inv.subtotal_cents)),
      escapeField(formatEuroCsv(inv.vat_cents)),
      escapeField(formatEuroCsv(inv.total_cents)),
      escapeField(inv.status),
    ];
    rows.push(row.join(';'));
  }

  return BOM + rows.join('\r\n');
}
