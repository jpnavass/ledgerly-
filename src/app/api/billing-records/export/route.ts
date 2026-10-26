// ============================================================================
// Endpoint Exportación Oficial de Registros de Facturación — Presupuesto Express
// ============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { getRepository } from '@/lib/repo';
import { COMPLIANCE_CONFIG } from '@/lib/compliance/config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');
    const fiscalYear = searchParams.get('year') || '2027';

    if (!orgId) {
      return NextResponse.json(
        { error: 'Identificador de organización (org_id) requerido.' },
        { status: 400 }
      );
    }

    const repo = getRepository();
    const org = await repo.getOrganization(orgId);
    if (!org) {
      return NextResponse.json({ error: 'Organización no encontrada.' }, { status: 404 });
    }

    const documents = await repo.getDocuments(orgId, {
      from_date: `${fiscalYear}-01-01`,
      to_date: `${fiscalYear}-12-31`,
    });

    const exportPayload = {
      entidad_emisora: {
        razon_social: org.legal_name || org.name,
        nif: org.tax_id,
        domicilio: org.address,
        ejercicio_fiscal: fiscalYear,
      },
      software_certificacion: COMPLIANCE_CONFIG.producer,
      fecha_exportacion: new Date().toISOString(),
      total_registros: documents.length,
      documentos: documents.map((doc) => ({
        id: doc.id,
        tipo: doc.doc_type,
        serie: doc.series,
        numero: doc.number,
        fecha_expedicion: doc.issue_date,
        total_centimos: doc.total_cents,
        iva_centimos: doc.vat_cents,
        desglose_iva: doc.vat_breakdown,
        estado: doc.status,
      })),
    };

    return new NextResponse(JSON.stringify(exportPayload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="registros_facturacion_${org.tax_id}_${fiscalYear}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al exportar registros';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
