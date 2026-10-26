// ============================================================================
// Endpoint Checkout Stripe — Presupuesto Express Enterprise
// ============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { getStripeClient, STRIPE_PRICES } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    const stripe = getStripeClient();
    const body = await request.json();
    const { plan, org_id } = body;

    if (!plan || (plan !== 'pro' && plan !== 'business')) {
      return NextResponse.json(
        { error: 'Plan no válido. Debe seleccionar "pro" o "business".' },
        { status: 400 }
      );
    }

    if (!org_id) {
      return NextResponse.json(
        { error: 'Identificador de organización requerido.' },
        { status: 400 }
      );
    }

    const planKey = plan as 'pro' | 'business';
    const priceId = STRIPE_PRICES[planKey];
    if (!priceId) {
      return NextResponse.json(
        {
          error: `Identificador de precio no configurado para el plan ${plan}. Verifique las variables de entorno STRIPE_PRICE_${plan.toUpperCase()}.`,
        },
        { status: 500 }
      );
    }

    const appUrl = process.env.APP_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      client_reference_id: org_id,
      metadata: {
        org_id,
        plan,
      },
      success_url: `${appUrl}/ajustes?stripe_status=success`,
      cancel_url: `${appUrl}/ajustes?stripe_status=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al procesar la sesión de pago';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
