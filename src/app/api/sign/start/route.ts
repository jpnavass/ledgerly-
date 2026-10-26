// ============================================================================
// Endpoint Iniciar Sesión de Firma / Visualización — Presupuesto Express
// ============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { getRepository } from '@/lib/repo';
import { sha256Hex } from '@/lib/compliance/hash';
import { assertCanSignDocument, assertEmailServiceConfigured } from '@/lib/domain/signing';
import { issueOtpForToken } from '@/lib/domain/otp-store';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, requestOtp } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token de acceso requerido.' }, { status: 400 });
    }

    const tokenHash = await sha256Hex(token);
    const repo = getRepository();

    // Buscar documento por el hash del token público o id
    const doc = (await repo.findDocumentByTokenOrId(tokenHash)) || (await repo.findDocumentByTokenOrId(token));

    if (!doc) {
      return NextResponse.json(
        { error: 'El enlace de acceso no es válido o ha sido revocado.' },
        { status: 404 }
      );
    }

    if (!doc.org_id) {
      return NextResponse.json(
        { error: 'El documento no tiene una organización asignada.' },
        { status: 400 }
      );
    }

    // Validar si admite firma y si el servicio de correo está operativo
    assertCanSignDocument(doc);
    assertEmailServiceConfigured();

    // Registrar visualización (viewed) si estaba en sent
    if (doc.status === 'sent') {
      const updated = {
        ...doc,
        status: 'viewed' as const,
        updated_at: new Date().toISOString(),
      };
      await repo.saveDocument(doc.org_id, updated);
    }

    let otpIssued = false;
    if (requestOtp && doc.client?.email) {
      issueOtpForToken(tokenHash, doc.client.email);
      otpIssued = true;
    }

    return NextResponse.json({
      success: true,
      document: {
        id: doc.id,
        title: doc.title,
        doc_type: doc.doc_type,
        series: doc.series,
        number: doc.number,
        total_cents: doc.total_cents,
        valid_until: doc.valid_until,
        client: doc.client,
        items: doc.items,
        status: doc.status,
      },
      otpIssued,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al procesar la sesión de firma';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
