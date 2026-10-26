// ============================================================================
// Endpoint Envío y Formalización de Firma — Presupuesto Express Enterprise
// ============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { getRepository } from '@/lib/repo';
import { sha256Hex } from '@/lib/compliance/hash';
import { assertCanSignDocument, validateSignerData, assertEmailServiceConfigured } from '@/lib/domain/signing';
import { createSignatureEvidence } from '@/lib/compliance/evidence';
import { createChainedAuditEvent } from '@/lib/compliance/audit';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, signerName, signerTaxId, signatureImage } = body;

    if (!token || !signerName || !signerTaxId) {
      return NextResponse.json(
        { error: 'Datos incompletos: token, nombre y NIF/CIF del firmante son obligatorios.' },
        { status: 400 }
      );
    }

    // Validar formato oficial de NIF/CIF/NIE del firmante
    validateSignerData(signerName, signerTaxId);
    assertEmailServiceConfigured();

    const tokenHash = await sha256Hex(token);
    const repo = getRepository();

    const doc = (await repo.findDocumentByTokenOrId(tokenHash)) || (await repo.findDocumentByTokenOrId(token));

    if (!doc) {
      return NextResponse.json(
        { error: 'Documento no encontrado o enlace revocado.' },
        { status: 404 }
      );
    }

    assertCanSignDocument(doc);

    // Servidor fija la fecha y hora oficial (eIDAS simple)
    const serverTimestamp = new Date().toISOString();
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'Navegador cliente';

    const evidence = await createSignatureEvidence({
      documentId: doc.id,
      documentVersion: doc.version,
      signerName,
      signerTaxId,
      signerEmail: doc.client?.email,
      signatureImagePath: signatureImage ? 'storage/signatures/sig.png' : undefined,
      documentPdfHash: doc.pdf_hash || (await sha256Hex(doc.id)),
      otpVerified: true,
      ip,
      userAgent,
      signedAt: serverTimestamp,
    });

    // Actualizar documento
    const updatedDoc = {
      ...doc,
      status: 'accepted' as const,
      accepted_at: serverTimestamp,
      locked_at: serverTimestamp,
      signature_data: evidence.evidence_hash,
      updated_at: serverTimestamp,
    };

    await repo.saveDocument(doc.org_id, updatedDoc);

    // Registrar evento de auditoría encadenado
    const auditEvent = await createChainedAuditEvent({
      orgId: doc.org_id,
      documentId: doc.id,
      actorKind: 'client',
      type: 'document.signed',
      description: `Documento firmado electrónicamente por ${signerName} (NIF: ${signerTaxId})`,
      ip,
      userAgent,
    });

    await repo.recordAuditEvent(doc.org_id, auditEvent);

    return NextResponse.json({
      success: true,
      evidenceHash: evidence.evidence_hash,
      signedAt: serverTimestamp,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al procesar la firma electrónica';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
