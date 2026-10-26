// ============================================================================
// Endpoint Portal de Facturación Stripe — Presupuesto Express Enterprise
// ============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { getStripeClient } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    const stripe = getStripeClient();
    const body = await request.json();
    const { customer_id } = body;

    if (!customer_id) {
      return NextResponse.json(
        { error: 'Identificador de cliente Stripe requerido.' },
        { status: 400 }
      );
    }

    const appUrl = process.env.APP_URL || 'http://localhost:3000';

    const session = await stripe.billingPortal.sessions.create({
      customer: customer_id,
      return_url: `${appUrl}/ajustes`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al generar el portal de facturación';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
