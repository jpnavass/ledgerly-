// ============================================================================
// Procesamiento de Eventos Webhook de Stripe — Presupuesto Express Enterprise
// ============================================================================

import type Stripe from 'stripe';
import type { License, PlanType } from '../types/index.ts';

// Almacén en memoria de eventos procesados para garantizar idempotencia
const processedEventIds = new Set<string>();

export interface WebhookRepositoryTarget {
  findLicenseByOrgId(orgId: string): Promise<License | null>;
  findLicenseBySubscriptionId(subId: string): Promise<License | null>;
  saveLicense(license: License): Promise<void>;
}

/**
 * Limpia el registro de idempotencia (útil para pruebas unitarias).
 */
export function resetProcessedWebhookEvents(): void {
  processedEventIds.clear();
}

/**
 * Procesa un evento verificado de Stripe con garantía de idempotencia por event.id.
 */
export async function processStripeEvent(
  event: Stripe.Event,
  repo: WebhookRepositoryTarget
): Promise<{ processed: boolean; reason?: string }> {
  // 1. Garantía de idempotencia: el mismo event.id dos veces no se procesa
  if (processedEventIds.has(event.id)) {
    return { processed: false, reason: 'duplicate_event' };
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId = session.client_reference_id || session.metadata?.org_id;
      const plan = (session.metadata?.plan as PlanType) || 'pro';
      const customerId =
        typeof session.customer === 'string' ? session.customer : session.customer?.id;
      const subscriptionId =
        typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id;

      if (!orgId) {
        return { processed: false, reason: 'missing_org_id_in_session' };
      }

      const existingLicense = await repo.findLicenseByOrgId(orgId);
      const validUntil = new Date(Date.now() + 32 * 24 * 3600 * 1000).toISOString();

      const updatedLicense: License = {
        id: existingLicense?.id || `lic-${orgId}`,
        org_id: orgId,
        plan: plan,
        valid_until: validUntil,
        is_active: true,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
      };

      await repo.saveLicense(updatedLicense);
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const subId = subscription.id;
      const existingLicense = await repo.findLicenseBySubscriptionId(subId);

      if (existingLicense) {
        const isActive = subscription.status === 'active';
        const validUntil = new Date(
          (subscription as unknown as { current_period_end?: number }).current_period_end
            ? (subscription as unknown as { current_period_end: number }).current_period_end * 1000
            : Date.now() + 30 * 24 * 3600 * 1000
        ).toISOString();

        await repo.saveLicense({
          ...existingLicense,
          is_active: isActive,
          valid_until: validUntil,
        });
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const subId = subscription.id;
      const existingLicense = await repo.findLicenseBySubscriptionId(subId);

      if (existingLicense) {
        await repo.saveLicense({
          ...existingLicense,
          plan: 'free',
          is_active: false,
        });
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const subId =
        typeof (invoice as unknown as { subscription?: string | { id: string } }).subscription === 'string'
          ? (invoice as unknown as { subscription: string }).subscription
          : (invoice as unknown as { subscription?: { id: string } }).subscription?.id;

      if (subId) {
        const existingLicense = await repo.findLicenseBySubscriptionId(subId);
        if (existingLicense) {
          await repo.saveLicense({
            ...existingLicense,
            is_active: false,
          });
        }
      }
      break;
    }

    default:
      // Eventos no manejados
      break;
  }

  // Registrar el ID del evento tras procesamiento exitoso
  processedEventIds.add(event.id);
  return { processed: true };
}
