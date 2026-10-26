// ============================================================================
// Generador de Documentos PDF Oficiales — Presupuesto Express Enterprise
// ============================================================================

import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { DocumentPdf } from './document-pdf.ts';
import { sha256Hex } from '../compliance/hash.ts';
import { buildQrVerificationUrl, generateQrDataUrl } from '../compliance/qr.ts';
import type { Document, Org, Client } from '../../types/index.ts';

export interface GeneratePdfResult {
  buffer: Buffer;
  pdfHash: string;
}

/**
 * Renderiza el documento a un búfer binario de PDF A4 y calcula su huella SHA-256 exacta.
 */
export async function generateDocumentPdf(
  doc: Document,
  org: Org,
  client: Client,
  billingRecordHash?: string
): Promise<GeneratePdfResult> {
  let qrDataUrl: string | undefined;

  const effectiveHash = billingRecordHash || doc.billing_record_hash || '';

  const isFinalInvoice = doc.doc_type === 'invoice' || doc.doc_type === 'credit_note';
  if (isFinalInvoice) {
    const seriesNumber = `${doc.series || 'FAC'}-${doc.number || 1}`;
    const qrUrl = buildQrVerificationUrl({
      taxId: org.tax_id,
      seriesNumber,
      issueDate: doc.issue_date || doc.created_at.slice(0, 10),
      totalCents: doc.total_cents,
      hash: effectiveHash || doc.pdf_hash || doc.id,
      isVerifactu: false,
    });
    qrDataUrl = await generateQrDataUrl(qrUrl);
  }

  const element = React.createElement(DocumentPdf, {
    document: doc,
    organization: org,
    client,
    qrDataUrl,
    billingRecordHash: effectiveHash,
  });

  const buffer = await renderToBuffer(element as any);
  const pdfHash = await sha256Hex(new Uint8Array(buffer));

  return { buffer, pdfHash };
}
