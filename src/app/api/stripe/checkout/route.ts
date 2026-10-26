// ============================================================================
// Endpoint Checkout Stripe — Ledgerly
// ============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { getStripeClient, STRIPE_PRICES } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    const stripe = getStripeClient();
    const body = await request.json().catch(() => ({}));
    const { plan, org_id, customer_email } = body;

    if (!plan || (plan !== 'pro' && plan !== 'business')) {
      return NextResponse.json(
        { error: 'Plan no válido. Debe seleccionar "pro" o "business".' },
        { status: 400 }
      );
    }

    const orgId = org_id || 'org_ledgerly_primary';
    const planKey = plan as 'pro' | 'business';
    const envPriceId = STRIPE_PRICES[planKey];

    // Detect base URL dynamically from request headers or environment
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const proto = request.headers.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https');
    const origin = request.headers.get('origin') || (host ? `${proto}://${host}` : process.env.APP_URL || 'https://ledgerlyr.vercel.app');

    const isRealPriceId =
      Boolean(envPriceId && /^price_[0-9a-zA-Z]{14,}$/.test(envPriceId) && !envPriceId.includes('default'));

    const lineItem = isRealPriceId
      ? { price: envPriceId!, quantity: 1 }
      : {
          price_data: {
            currency: 'eur',
            product_data: {
              name: plan === 'pro' ? 'Ledgerly Pro' : 'Ledgerly Business',
              description: plan === 'pro'
                ? 'Plan Profesional: hasta 100 documentos/mes, 5 usuarios, firma eIDAS y Veri*factu'
                : 'Plan Enterprise: documentos ilimitados, 25 usuarios, soporte prioritario',
            },
            unit_amount: plan === 'pro' ? 1900 : 4900,
            recurring: { interval: 'month' as const },
          },
          quantity: 1,
        };

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [lineItem],
      customer_email: customer_email || undefined,
      client_reference_id: orgId,
      metadata: {
        org_id: orgId,
        plan,
      },
      success_url: `${origin}/ajustes?stripe_status=success`,
      cancel_url: `${origin}/ajustes?stripe_status=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al procesar la sesión de pago';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

