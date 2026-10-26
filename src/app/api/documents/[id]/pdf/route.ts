// ============================================================================
// Endpoint Descarga de PDF Oficial — Presupuesto Express Enterprise
// ============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { getRepository } from '@/lib/repo';
import { generateDocumentPdf } from '@/lib/pdf/generate';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const repo = getRepository();
    const doc = await repo.findDocumentByTokenOrId(id);

    if (!doc) {
      return NextResponse.json({ error: 'Documento no encontrado.' }, { status: 404 });
    }

    if (!doc.org_id) {
      return NextResponse.json(
        { error: 'El documento no tiene una organización asignada.' },
        { status: 400 }
      );
    }

    const org = await repo.getOrganization(doc.org_id);
    if (!org) {
      return NextResponse.json({ error: 'Entidad emisora no encontrada.' }, { status: 404 });
    }

    const client = doc.client || (await repo.getClientById(doc.org_id, doc.client_id || ''));
    if (!client) {
      return NextResponse.json({ error: 'Cliente destinatario no encontrado.' }, { status: 404 });
    }

    const { buffer, pdfHash } = await generateDocumentPdf(doc, org, client);

    // Guardar hash en el documento si no lo tenía
    if (!doc.pdf_hash) {
      await repo.saveDocument(doc.org_id, {
        ...doc,
        pdf_hash: pdfHash,
        updated_at: new Date().toISOString(),
      });
    }

    const filename = `${doc.series || 'DOC'}_${doc.number || 'borrador'}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al generar el PDF oficial';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
