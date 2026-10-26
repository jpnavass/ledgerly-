// ============================================================================
// Reglas y Formato de Numeración Oficial y Series — Presupuesto Express
// ============================================================================

import type { DocType } from '../../types/index.ts';

export interface SeriesConfig {
  prefix: string;
  reset_yearly: boolean;
  min_digits?: number;
}

export const DEFAULT_SERIES: Record<DocType, SeriesConfig> = {
  quote: { prefix: 'PRE', reset_yearly: true, min_digits: 4 },
  delivery_note: { prefix: 'ALB', reset_yearly: true, min_digits: 4 },
  proforma: { prefix: 'PRO', reset_yearly: true, min_digits: 4 },
  invoice: { prefix: 'FAC', reset_yearly: true, min_digits: 4 },
  credit_note: { prefix: 'REC', reset_yearly: true, min_digits: 4 },
};

/**
 * Formatea un número correlativo con su serie oficial (ej. "FAC-0001" o "FAC-2027-0001").
 * No trunca si el número excede la longitud mínima.
 */
export function formatFullDocumentNumber(
  series: string,
  num: number,
  fiscalYear?: number,
  includeYear: boolean = false,
  minDigits: number = 4
): string {
  if (!Number.isSafeInteger(num) || num <= 0) {
    throw new RangeError(`El número de documento debe ser un entero positivo seguro: recibido ${num}`);
  }

  const paddedNum = num.toString().padStart(minDigits, '0');

  if (includeYear && fiscalYear) {
    return `${series}-${fiscalYear}-${paddedNum}`;
  }

  return `${series}-${paddedNum}`;
}

/**
 * Valida que una serie cumpla con la normativa de facturación española.
 * No puede estar vacía, debe ser alfanumérica y en mayúsculas.
 */
export function validateSeriesPrefix(prefix: string): boolean {
  if (!prefix || typeof prefix !== 'string') return false;
  const clean = prefix.trim();
  if (clean.length < 1 || clean.length > 10) return false;
  return /^[A-Z0-9_-]+$/.test(clean);
}

/**
 * Gestor atómico de contadores en memoria (para pruebas y simulaciones de concurrencia).
 */
export class InMemoryCounterManager {
  private counters = new Map<string, number>();

  /**
   * Obtiene de forma atómica y sin huecos el siguiente número de la serie.
   */
  async nextNumber(orgId: string, docType: DocType, series: string, year: number): Promise<number> {
    const key = `${orgId}:${docType}:${series}:${year}`;
    const current = this.counters.get(key) || 0;
    const next = current + 1;
    this.counters.set(key, next);
    return next;
  }

  reset(): void {
    this.counters.clear();
  }
}
