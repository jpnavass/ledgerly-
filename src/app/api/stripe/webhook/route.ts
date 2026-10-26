// ============================================================================
// Endpoint Webhook de Stripe — Presupuesto Express Enterprise
// ============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { getStripeClient } from '@/lib/stripe';
import { processStripeEvent, type WebhookRepositoryTarget } from '@/lib/stripe-webhook';
import { getRepository } from '@/lib/repo';
import type { License } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const stripe = getStripeClient();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return NextResponse.json(
        { error: 'STRIPE_WEBHOOK_SECRET no configurado en el servidor.' },
        { status: 500 }
      );
    }

    const signature = request.headers.get('stripe-signature');
    if (!signature) {
      return NextResponse.json(
        { error: 'Falta la cabecera stripe-signature.' },
        { status: 400 }
      );
    }

    const payload = await request.text();
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Firma de webhook inválida';
      return NextResponse.json({ error: `Firma no válida: ${msg}` }, { status: 400 });
    }

    // Adaptador de persistencia para el webhook
    const repo = getRepository();
    const webhookRepo: WebhookRepositoryTarget = {
      async findLicenseByOrgId(orgId: string): Promise<License | null> {
        return await repo.getLicense(orgId);
      },
      async findLicenseBySubscriptionId(subId: string): Promise<License | null> {
        return await repo.getLicenseBySubscriptionId(subId);
      },
      async saveLicense(license: License): Promise<void> {
        await repo.saveLicense(license);
      },
    };

    const result = await processStripeEvent(event, webhookRepo);

    return NextResponse.json({
      received: true,
      processed: result.processed,
      reason: result.reason,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno al procesar el webhook';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
