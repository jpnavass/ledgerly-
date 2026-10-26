// ============================================================================
// Paquete de Evidencias Criptográficas de Firma — Reglamento eIDAS
// ============================================================================

import type { DocumentSignature } from '../../types/index.ts';
import { sha256Hex, canonicalize } from './hash.ts';

export interface EvidencePackageInputs {
  documentId: string;
  documentVersion: number;
  signerName: string;
  signerTaxId: string;
  signerEmail?: string;
  signatureImagePath?: string;
  documentPdfHash: string;
  otpVerified: boolean;
  ip?: string;
  userAgent?: string;
  signedAt: string; // Timestamp fijado por el servidor
}

/**
 * Genera el paquete de evidencias de firma electrónica con huella SHA-256 canónica.
 */
export async function createSignatureEvidence(
  inputs: EvidencePackageInputs
): Promise<DocumentSignature> {
  const canonicalString = canonicalize({
    document_id: inputs.documentId,
    document_version: inputs.documentVersion,
    signer_name: inputs.signerName.trim(),
    signer_tax_id: inputs.signerTaxId.trim().toUpperCase(),
    signer_email: inputs.signerEmail?.trim().toLowerCase() || null,
    document_pdf_hash: inputs.documentPdfHash,
    otp_verified: inputs.otpVerified,
    ip: inputs.ip || '0.0.0.0',
    user_agent: inputs.userAgent || 'Desconocido',
    signed_at: inputs.signedAt,
  });

  const evidenceHash = await sha256Hex(canonicalString);

  const signature: DocumentSignature = {
    id: `sig-${crypto.randomUUID()}`,
    document_id: inputs.documentId,
    document_version: inputs.documentVersion,
    signer_name: inputs.signerName.trim(),
    signer_tax_id: inputs.signerTaxId.trim().toUpperCase(),
    signer_email: inputs.signerEmail?.trim().toLowerCase(),
    signature_image_path: inputs.signatureImagePath,
    document_pdf_hash: inputs.documentPdfHash,
    otp_verified: inputs.otpVerified,
    ip: inputs.ip,
    user_agent: inputs.userAgent,
    signed_at: inputs.signedAt,
    evidence_hash: evidenceHash,
  };

  return signature;
}

/**
 * Verifica la autenticidad e inalterabilidad del paquete de evidencias.
 */
export async function verifySignatureEvidence(
  signature: DocumentSignature,
  expectedPdfHash?: string
): Promise<{ ok: boolean; reason?: string }> {
  // 1. Si se aporta hash esperado del PDF, comprobar coincidencia
  if (expectedPdfHash && signature.document_pdf_hash !== expectedPdfHash) {
    return {
      ok: false,
      reason: 'El hash del documento PDF almacenado difiere del hash registrado en el momento de la firma.',
    };
  }

  // 2. Recalcular la huella canónica del paquete
  const canonicalString = canonicalize({
    document_id: signature.document_id,
    document_version: signature.document_version,
    signer_name: signature.signer_name,
    signer_tax_id: signature.signer_tax_id,
    signer_email: signature.signer_email || null,
    document_pdf_hash: signature.document_pdf_hash,
    otp_verified: signature.otp_verified,
    ip: signature.ip || '0.0.0.0',
    user_agent: signature.user_agent || 'Desconocido',
    signed_at: signature.signed_at,
  });

  const recomputedHash = await sha256Hex(canonicalString);

  if (recomputedHash !== signature.evidence_hash) {
    return {
      ok: false,
      reason: 'La huella de evidencia no coincide: el registro de firma ha sido manipulado.',
    };
  }

  return { ok: true };
}
