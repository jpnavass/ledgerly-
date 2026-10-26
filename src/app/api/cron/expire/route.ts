// ============================================================================
// Endpoint Cron: Caducidad Automática de Presupuestos — Presupuesto Express
// Revisa presupuestos ('sent', 'viewed') y transiciona a 'expired' si vencidos
// ============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { getRepository } from '@/lib/repo';
import { processExpiredQuotes } from '@/lib/domain/cron-expire';

export async function GET(request: NextRequest) {
  return handleExpire(request);
}

export async function POST(request: NextRequest) {
  return handleExpire(request);
}

async function handleExpire(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id') || undefined;
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || cronSecret.trim().length === 0) {
      return NextResponse.json(
        { error: 'CRON_SECRET no configurado en el servidor (fallo cerrado).' },
        { status: 500 }
      );
    }

    const today = searchParams.get('today') || undefined;
    const repo = getRepository();

    const result = await processExpiredQuotes({
      repo,
      orgId,
      todayIso: today,
      cronSecret,
      authorizationHeader: authHeader,
    });

    if (result.unauthorized) {
      return NextResponse.json(
        { error: 'No autorizado para ejecutar el proceso cron de caducidad.' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      ok: true,
      organizations_count: result.organizationsCount,
      processed_count: result.processedCount,
      expired_count: result.expiredCount,
      expired_ids: result.expiredIds,
      evaluated_date: result.evaluatedDate,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Error procesando la caducidad de presupuestos.' },
      { status: 500 }
    );
  }
}
