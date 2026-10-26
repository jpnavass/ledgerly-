// ============================================================================
// Endpoint Portal de Facturación Stripe — Ledgerly
// ============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { getStripeClient } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    const stripe = getStripeClient();
    const body = await request.json().catch(() => ({}));
    const { customer_id } = body;

    if (!customer_id) {
      return NextResponse.json(
        { error: 'Identificador de cliente Stripe requerido.' },
        { status: 400 }
      );
    }

    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const proto = request.headers.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https');
    const origin = request.headers.get('origin') || (host ? `${proto}://${host}` : process.env.APP_URL || 'https://ledgerlyr.vercel.app');

    const session = await stripe.billingPortal.sessions.create({
      customer: customer_id,
      return_url: `${origin}/ajustes`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al generar el portal de facturación';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

