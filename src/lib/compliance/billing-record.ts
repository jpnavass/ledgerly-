// ============================================================================
// Registro de Facturación Inalterable (Ley Antifraude / RD 1007/2023)
// ============================================================================

import type { BillingRecord, Document, Org } from '../../types/index.ts';
import { sha256Hex } from './hash.ts';
import { COMPLIANCE_CONFIG } from './config.ts';

export interface BillingRecordPayloadInputs {
  taxId: string;
  seriesNumber: string;
  issueDate: string; // YYYY-MM-DD
  invoiceType: string; // 'F1' ordinaria, 'R1' rectificativa por diferencias, etc.
  vatCents: number;
  totalCents: number;
  previousHash: string;
  generatedAtIso: string;
}

/**
 * Formatea la cadena canónica oficial para el cálculo de la huella del registro de facturación
 * conforme a la especificación técnica oficial de la Agencia Tributaria.
 */
export function formatAeatHashPayload(inputs: BillingRecordPayloadInputs): string {
  const {
    taxId,
    seriesNumber,
    issueDate,
    invoiceType,
    vatCents,
    totalCents,
    previousHash,
    generatedAtIso,
  } = inputs;

  // Fecha en formato DD-MM-YYYY exigido por la AEAT
  const parts = issueDate.split('-');
  const formattedDate =
    parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : issueDate;

  // Importes en formato decimal 0.00 con punto
  const vatEuros = (vatCents / 100).toFixed(2);
  const totalEuros = (totalCents / 100).toFixed(2);

  return (
    `IDEmisorFactura=${taxId}` +
    `&NumSerieFactura=${seriesNumber}` +
    `&FechaExpedicionFactura=${formattedDate}` +
    `&TipoFactura=${invoiceType}` +
    `&CuotaTotal=${vatEuros}` +
    `&ImporteTotal=${totalEuros}` +
    `&Huella=${previousHash}` +
    `&FechaHoraHusoGenRegistro=${generatedAtIso}`
  );
}

/**
 * Construye y firma con huella encadenada un registro de alta de facturación.
 */
export async function buildBillingRecord(
  doc: Document,
  org: Org,
  previousRecord?: BillingRecord | null,
  nowIso?: string
): Promise<BillingRecord> {
  const generatedAt = nowIso || new Date().toISOString();
  const seriesNumber = `${doc.series || 'FAC'}-${doc.number || 0}`;
  const previousHash = previousRecord?.hash || '';
  const invoiceType = doc.doc_type === 'credit_note' ? 'R1' : 'F1';

  const rawPayload = formatAeatHashPayload({
    taxId: org.tax_id,
    seriesNumber,
    issueDate: doc.issue_date || generatedAt.slice(0, 10),
    invoiceType,
    vatCents: doc.vat_cents,
    totalCents: doc.total_cents,
    previousHash,
    generatedAtIso: generatedAt,
  });

  const rawHash = await sha256Hex(rawPayload);
  const hash = rawHash.toUpperCase();

  const qrPayload =
    `https://sede.agenciatributaria.gob.es/qr/validador?` +
    `nif=${encodeURIComponent(org.tax_id)}` +
    `&num=${encodeURIComponent(seriesNumber)}` +
    `&fecha=${encodeURIComponent(doc.issue_date || '')}` +
    `&total=${(doc.total_cents / 100).toFixed(2)}` +
    `&hash=${hash.slice(0, 16)}`;

  const record: BillingRecord = {
    id: `rec-${crypto.randomUUID()}`,
    org_id: org.id,
    document_id: doc.id,
    record_type: 'alta',
    series: doc.series || 'FAC',
    number: doc.number || 0,
    issue_date: doc.issue_date || generatedAt.slice(0, 10),
    total_cents: doc.total_cents,
    vat_cents: doc.vat_cents,
    previous_hash: previousHash,
    hash,
    generated_at: generatedAt,
    software_version: COMPLIANCE_CONFIG.producer.software_version,
    qr_payload: qrPayload,
  };

  return record;
}

/**
 * Formatea la cadena canónica oficial para el registro de anulación según especificación técnica AEAT.
 */
export function formatAeatCancellationPayload(inputs: {
  taxId: string;
  seriesNumber: string;
  issueDate: string;
  previousHash: string;
  generatedAtIso: string;
}): string {
  const parts = inputs.issueDate.split('-');
  const formattedDate =
    parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : inputs.issueDate;

  return (
    `IDEmisorFacturaAnulada=${inputs.taxId}` +
    `&NumSerieFacturaAnulada=${inputs.seriesNumber}` +
    `&FechaExpedicionFacturaAnulada=${formattedDate}` +
    `&Huella=${inputs.previousHash}` +
    `&FechaHoraHusoGenRegistro=${inputs.generatedAtIso}`
  );
}

/**
 * Construye y firma con huella encadenada un registro de anulación de facturación.
 */
export async function buildCancellationRecord(
  doc: Document,
  org: Org,
  previousRecord?: BillingRecord | null,
  nowIso?: string
): Promise<BillingRecord> {
  const generatedAt = nowIso || new Date().toISOString();
  const seriesNumber = `${doc.series || 'FAC'}-${doc.number || 0}`;
  const previousHash = previousRecord?.hash || '';

  const rawPayload = formatAeatCancellationPayload({
    taxId: org.tax_id,
    seriesNumber,
    issueDate: doc.issue_date || generatedAt.slice(0, 10),
    previousHash,
    generatedAtIso: generatedAt,
  });

  const rawHash = await sha256Hex(rawPayload);
  const hash = rawHash.toUpperCase();

  const record: BillingRecord = {
    id: `rec-${crypto.randomUUID()}`,
    org_id: org.id,
    document_id: doc.id,
    record_type: 'anulacion',
    series: doc.series || 'FAC',
    number: doc.number || 0,
    issue_date: doc.issue_date || generatedAt.slice(0, 10),
    total_cents: doc.total_cents,
    vat_cents: doc.vat_cents,
    previous_hash: previousHash,
    hash,
    generated_at: generatedAt,
    software_version: COMPLIANCE_CONFIG.producer.software_version,
    qr_payload: '',
  };

  return record;
}

/**
 * Verifica la integridad criptográfica completa de la cadena encadenada de registros de facturación.
 * Si detecta alteración o rotura de eslabones, informa del índice del primer registro comprometido.
 */
export async function verifyBillingChain(
  records: readonly BillingRecord[],
  taxId: string
): Promise<{ ok: boolean; firstBrokenIndex?: number; reason?: string }> {
  for (let i = 0; i < records.length; i++) {
    const current = records[i];

    // 1. Comprobar enlace con el registro anterior
    if (i === 0) {
      if (current.previous_hash !== '') {
        return { ok: false, firstBrokenIndex: 0, reason: 'El primer registro debe tener huella anterior vacía' };
      }
    } else {
      const prev = records[i - 1];
      if (current.previous_hash !== prev.hash) {
        return {
          ok: false,
          firstBrokenIndex: i,
          reason: `Huella anterior no coincide con el hash del registro previo en índice ${i}`,
        };
      }
    }

    // 2. Recalcular y verificar la huella del propio registro
    let expectedPayload: string;
    if (current.record_type === 'alta') {
      expectedPayload = formatAeatHashPayload({
        taxId,
        seriesNumber: `${current.series}-${current.number}`,
        issueDate: current.issue_date,
        invoiceType: 'F1',
        vatCents: current.vat_cents,
        totalCents: current.total_cents,
        previousHash: current.previous_hash,
        generatedAtIso: current.generated_at,
      });
    } else {
      expectedPayload = formatAeatCancellationPayload({
        taxId,
        seriesNumber: `${current.series}-${current.number}`,
        issueDate: current.issue_date,
        previousHash: current.previous_hash,
        generatedAtIso: current.generated_at,
      });
    }

    const calculatedHash = (await sha256Hex(expectedPayload)).toUpperCase();
    if (calculatedHash !== current.hash.toUpperCase()) {
      return {
        ok: false,
        firstBrokenIndex: i,
        reason: `Huella digital alterada o manipulada en el registro de índice ${i}`,
      };
    }
  }

  return { ok: true };
}

