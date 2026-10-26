// ============================================================================
// Máquina de Estados del Ciclo de Vida Documental — Presupuesto Express
// ============================================================================

import type { DocType, DocStatus } from '../../types/index.ts';
import { DOC_TYPE_LABELS, DOC_STATUS_LABELS } from '../../types/index.ts';

export class InvalidTransitionError extends Error {
  public readonly docType: DocType;
  public readonly from: DocStatus;
  public readonly to: DocStatus;

  constructor(docType: DocType, from: DocStatus, to: DocStatus) {
    const typeLabel = DOC_TYPE_LABELS[docType] || docType;
    const fromLabel = DOC_STATUS_LABELS[from] || from;
    const toLabel = DOC_STATUS_LABELS[to] || to;
    super(
      `Transición de estado no válida para ${typeLabel}: no es posible pasar de '${fromLabel}' a '${toLabel}'.`
    );
    this.name = 'InvalidTransitionError';
    this.docType = docType;
    this.from = from;
    this.to = to;
  }
}

/**
 * Matriz estricta de transiciones de estado permitidas por tipo documental.
 */
const ALLOWED_TRANSITIONS: Record<DocType, Partial<Record<DocStatus, readonly DocStatus[]>>> = {
  quote: {
    draft: ['sent'],
    sent: ['viewed', 'accepted', 'rejected', 'expired'],
    viewed: ['accepted', 'rejected', 'expired'],
    accepted: ['invoiced'],
    // rejected y expired no transitan: requieren crear una nueva versión
  },
  proforma: {
    draft: ['sent'],
    sent: ['accepted', 'rejected'],
    accepted: ['invoiced'],
  },
  delivery_note: {
    draft: ['sent'],
    sent: ['accepted', 'rejected'],
    accepted: ['invoiced'],
  },
  invoice: {
    draft: ['issued'],
    issued: ['paid', 'partially_paid', 'void'],
    partially_paid: ['paid', 'void'],
    // void y paid son terminales (salvo rectificativa)
  },
  credit_note: {
    draft: ['issued'],
    issued: ['paid', 'partially_paid', 'void'],
    partially_paid: ['paid', 'void'],
  },
};

/**
 * Evalúa de forma pura si una transición de estado está permitida para un tipo de documento.
 */
export function canTransition(docType: DocType, from: DocStatus, to: DocStatus): boolean {
  const typeTransitions = ALLOWED_TRANSITIONS[docType];
  if (!typeTransitions) return false;
  const allowed = typeTransitions[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

/**
 * Lanza InvalidTransitionError si la transición no está permitida.
 */
export function assertCanTransition(docType: DocType, from: DocStatus, to: DocStatus): void {
  if (!canTransition(docType, from, to)) {
    throw new InvalidTransitionError(docType, from, to);
  }
}
