// ============================================================================
// Dominio de Documentos Contractuales — Presupuesto Express Enterprise
// ============================================================================

import type { Document, DocumentItem, Client, Org, OrgSettings, DocType, DocStatus } from '../../types/index.ts';
import { calcDocumentTotals, roundHalfUp, type CalcLineInput } from '../calculations.ts';
import { assertCanTransition } from './state-machine.ts';
import { DEFAULT_SERIES } from './numbering.ts';

export class DocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentError';
  }
}

export interface CreateDraftParams {
  doc_type: DocType;
  client_id: string;
  client: Client;
  title: string;
  org_id: string;
  org_settings?: OrgSettings | null;
}

/**
 * Crea un borrador oficial completamente vacío, sin líneas preestablecidas ni números asignados.
 */
export function createDraftDocument(params: CreateDraftParams): Document {
  const { doc_type, client_id, client, title, org_id, org_settings } = params;

  if (!client_id || !client || client.id !== client_id) {
    throw new DocumentError(
      'No se puede crear un documento sin especificar un cliente registrado y válido.'
    );
  }

  const validityDays = org_settings?.default_validity_days || 30;
  const now = new Date();
  const validUntilDate = new Date(now.getTime() + validityDays * 24 * 3600 * 1000);
  const validUntil = validUntilDate.toISOString().slice(0, 10);

  const defaultTerms = org_settings?.default_terms_text || '';

  const draft: Document = {
    id: `doc-${crypto.randomUUID()}`,
    org_id,
    client_id,
    client,
    doc_type,
    series: null,
    number: null,
    version: 1,
    status: 'draft',
    title: title.trim() || `${doc_type.toUpperCase()}`,
    valid_until: validUntil,
    notes_public: defaultTerms,
    apply_surcharge: false,
    subtotal_cents: 0,
    discount_cents: 0,
    vat_cents: 0,
    irpf_cents: 0,
    total_cents: 0,
    items: [],
    currency: 'EUR',
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  return draft;
}

/**
 * Guarda o actualiza un borrador recalculando de forma obligatoria sus totales económicos.
 */
export function updateDraftDocument(
  doc: Document,
  updates: Partial<Document>
): Document {
  if (doc.status !== 'draft') {
    throw new DocumentError(
      `El documento no se encuentra en estado de borrador (estado actual: '${doc.status}'). Solo los borradores pueden ser editados.`
    );
  }

  const updatedDoc: Document = {
    ...doc,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  // Recalcular totales con el motor fiscal estricto
  const calcInputs: CalcLineInput[] = updatedDoc.items.map((item) => ({
    item_type: item.item_type,
    is_optional: item.is_optional,
    quantity: item.quantity,
    price_cents: item.price_cents,
    cost_cents: item.cost_cents,
    discount_pct: item.discount_pct,
    vat_rate: item.vat_rate,
    irpf_rate: item.irpf_rate,
  }));

  const totals = calcDocumentTotals(calcInputs, {
    apply_surcharge: Boolean(updatedDoc.apply_surcharge),
  });

  updatedDoc.subtotal_cents = totals.subtotal_cents;
  updatedDoc.discount_cents = totals.discount_cents;
  updatedDoc.vat_cents = totals.vat_cents;
  updatedDoc.surcharge_cents = totals.surcharge_cents;
  updatedDoc.irpf_cents = totals.irpf_cents;
  updatedDoc.total_cents = totals.total_cents;
  updatedDoc.vat_breakdown = totals.vat_breakdown;

  return updatedDoc;
}

export interface IssueDocumentValidationContext {
  doc: Document;
  client: Client;
  org: Org;
  series: string;
  nextNumber: number;
  todayIso?: string;
}

/**
 * Emite un documento validando todos los requisitos legales del RD 1619/2012.
 */
export function validateAndIssueDocument(ctx: IssueDocumentValidationContext): Document {
  const { doc, client, org, series, nextNumber, todayIso } = ctx;

  if (doc.status !== 'draft') {
    throw new DocumentError(
      `No se puede emitir un documento que no sea borrador (estado actual: '${doc.status}').`
    );
  }

  // 1. Validar datos fiscales del emisor
  if (!org.legal_name && !org.name) {
    throw new DocumentError('Falta la razón social o nombre legal del emisor en los ajustes de empresa.');
  }
  if (!org.tax_id) {
    throw new DocumentError('Falta el NIF/CIF oficial del emisor en los ajustes de empresa.');
  }
  if (!org.address || !org.postal_code || !org.city) {
    throw new DocumentError('El domicilio fiscal del emisor está incompleto.');
  }

  // 2. Validar datos fiscales del cliente destinatario
  if (!client.tax_id) {
    throw new DocumentError('El cliente no dispone de NIF/CIF/NIE fiscal para la emisión.');
  }
  if (!client.address || !client.postal_code || !client.city) {
    throw new DocumentError('El domicilio fiscal del cliente destinatario está incompleto.');
  }

  // 3. Validar partidas
  const nonOptionalLines = doc.items.filter(
    (i) => i.item_type === 'line' && !i.is_optional
  );

  if (nonOptionalLines.length === 0) {
    throw new DocumentError(
      'El documento debe contener al menos una partida no opcional para poder ser emitido.'
    );
  }

  // 4. Validar importes
  if (doc.doc_type !== 'credit_note' && doc.total_cents <= 0) {
    throw new DocumentError('El importe total del documento debe ser superior a cero.');
  }

  // 5. Determinar estado destino según máquina de estados
  const targetStatus: DocStatus =
    doc.doc_type === 'invoice' || doc.doc_type === 'credit_note' ? 'issued' : 'sent';

  assertCanTransition(doc.doc_type, doc.status, targetStatus);

  const issueDate = todayIso || new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  const isFinalTaxDocument = doc.doc_type === 'invoice' || doc.doc_type === 'credit_note';

  const issuedDoc: Document = {
    ...doc,
    series,
    number: nextNumber,
    issue_date: issueDate,
    status: targetStatus,
    locked_at: isFinalTaxDocument ? now : undefined,
    updated_at: now,
  };

  return issuedDoc;
}

/**
 * Crea una nueva versión de un documento no borrador (incrementa versión y mantiene trazabilidad).
 */
export function createNewDocumentVersion(original: Document): Document {
  if (original.status === 'draft') {
    throw new DocumentError('Un borrador ya es editable directamente sin necesidad de crear una versión.');
  }

  const now = new Date().toISOString();
  const newVersion: Document = {
    ...original,
    id: `doc-${crypto.randomUUID()}`,
    version: original.version + 1,
    status: 'draft',
    series: null,
    number: null,
    locked_at: undefined,
    pdf_url: undefined,
    pdf_hash: undefined,
    signature_data: undefined,
    converted_from: original.id,
    created_at: now,
    updated_at: now,
    items: original.items.map((item, idx) => ({
      ...item,
      id: `item-${crypto.randomUUID()}`,
      position: idx + 1,
    })),
  };

  return newVersion;
}

export interface ConvertDocumentOptions {
  source: Document;
  targetType: DocType;
  billedPercentage?: number; // 1-100 para facturación parcial
  orgSettings?: OrgSettings | null;
}

/**
 * Convierte un documento aceptado en un nuevo tipo documental (ej. Presupuesto -> Factura).
 */
export function convertDocument(options: ConvertDocumentOptions): {
  newDocument: Document;
  updatedSource: Document;
} {
  const { source, targetType, billedPercentage = 100, orgSettings } = options;

  // Reglas de conversión permitidas
  const allowedConversions: Record<DocType, DocType[]> = {
    quote: ['delivery_note', 'proforma', 'invoice'],
    delivery_note: ['invoice'],
    proforma: ['invoice'],
    invoice: [],
    credit_note: [],
  };

  const allowedTargets = allowedConversions[source.doc_type] || [];
  if (!allowedTargets.includes(targetType)) {
    throw new DocumentError(
      `No está permitida la conversión de '${source.doc_type}' a '${targetType}'.`
    );
  }

  if (source.status !== 'accepted') {
    throw new DocumentError(
      `Solo los documentos aceptados y firmados pueden convertirse (estado actual: '${source.status}').`
    );
  }

  const currentBilled = source.billed_percentage || 0;
  if (currentBilled + billedPercentage > 100) {
    throw new DocumentError(
      `El porcentaje acumulado facturado superaría el 100% (actual: ${currentBilled}%, intentado: ${billedPercentage}%).`
    );
  }

  const newDocId = `doc-${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  // Clonar líneas con nuevos IDs y recalcular si hay porcentaje parcial
  const factor = billedPercentage / 100;
  const clonedItems: DocumentItem[] = source.items.map((item, idx) => {
    const rawPrice = factor === 1 ? item.price_cents : roundHalfUp(item.price_cents * factor);
    return {
      ...item,
      id: `item-${crypto.randomUUID()}`,
      document_id: newDocId,
      position: idx + 1,
      price_cents: rawPrice,
    };
  });

  const convertedDoc: Document = {
    ...source,
    id: newDocId,
    doc_type: targetType,
    series: null,
    number: null,
    version: 1,
    status: 'draft',
    title: `${targetType.toUpperCase()} de ${source.title || source.id}`,
    converted_from: source.id,
    billed_percentage: undefined,
    items: clonedItems,
    locked_at: undefined,
    pdf_url: undefined,
    pdf_hash: undefined,
    signature_data: undefined,
    created_at: now,
    updated_at: now,
  };

  // Recalcular totales en el destino
  const recalculated = updateDraftDocument(convertedDoc, { items: clonedItems });

  // Actualizar origen: acumular porcentaje; si llega al 100%, pasa a invoiced
  const newBilledTotal = currentBilled + billedPercentage;
  let updatedSource: Document = {
    ...source,
    billed_percentage: newBilledTotal,
    updated_at: now,
  };

  if (newBilledTotal >= 100 && targetType === 'invoice') {
    assertCanTransition(source.doc_type, source.status, 'invoiced');
    updatedSource.status = 'invoiced';
  }

  return { newDocument: recalculated, updatedSource };
}

export interface CreateCreditNoteParams {
  original: Document;
  reason: string;
  method: 'differences' | 'substitution';
  series?: string;
  todayIso?: string;
}

/**
 * Genera una factura rectificativa conforme al RD 1619/2012 Art. 15.
 */
export function createCreditNoteDocument(params: CreateCreditNoteParams): {
  creditNote: Document;
  updatedOriginal: Document;
} {
  const { original, reason, method, series = 'REC', todayIso } = params;

  if (
    original.doc_type !== 'invoice' ||
    (original.status !== 'issued' &&
      original.status !== 'paid' &&
      original.status !== 'partially_paid')
  ) {
    throw new DocumentError(
      `Solo pueden rectificarse facturas emitidas o cobradas (estado actual: '${original.status}').`
    );
  }

  if (!reason || reason.trim().length < 5) {
    throw new DocumentError(
      'Debe especificarse el motivo legal de la rectificación (mínimo 5 caracteres).'
    );
  }

  const now = new Date().toISOString();
  const creditNoteId = `doc-${crypto.randomUUID()}`;

  // Para método 'differences', las partidas se invierten en importe negativo exacto
  let items: DocumentItem[];
  if (method === 'differences') {
    items = original.items.map((item, idx) => ({
      ...item,
      id: `item-${crypto.randomUUID()}`,
      document_id: creditNoteId,
      position: idx + 1,
      price_cents: -Math.abs(item.price_cents),
    }));
  } else {
    items = original.items.map((item, idx) => ({
      ...item,
      id: `item-${crypto.randomUUID()}`,
      document_id: creditNoteId,
      position: idx + 1,
    }));
  }

  const creditNote: Document = {
    ...original,
    id: creditNoteId,
    doc_type: 'credit_note',
    series: null,
    number: null,
    version: 1,
    status: 'draft',
    title: `Rectificativa de Factura ${original.series || 'FAC'}-${original.number || 0}`,
    rectifies_document_id: original.id,
    rectification_reason: reason.trim(),
    rectification_method: method,
    converted_from: original.id,
    locked_at: undefined,
    pdf_url: undefined,
    pdf_hash: undefined,
    signature_data: undefined,
    items,
    created_at: now,
    updated_at: now,
  };

  const recalculated = updateDraftDocument(creditNote, { items });

  let updatedOriginal = { ...original };
  // Si es sustitución total, la original queda anulada (void)
  if (method === 'substitution') {
    updatedOriginal = {
      ...original,
      status: 'void',
      updated_at: now,
    };
  }

  return { creditNote: recalculated, updatedOriginal };
}

/**
 * Revisa de forma perezosa si un presupuesto ha caducado.
 */
export function checkDocumentExpiry(doc: Document, todayIso?: string): Document {
  if (doc.doc_type !== 'quote') return doc;
  if (doc.status !== 'sent' && doc.status !== 'viewed') return doc;

  const today = todayIso || new Date().toISOString().slice(0, 10);
  if (doc.valid_until && doc.valid_until < today) {
    return {
      ...doc,
      status: 'expired',
      updated_at: new Date().toISOString(),
    };
  }

  return doc;
}
