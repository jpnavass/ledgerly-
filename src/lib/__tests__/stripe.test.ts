// ============================================================================
// Pruebas Unitarias — Webhooks de Stripe (stripe.test.ts)
// ============================================================================

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type Stripe from 'stripe';
import {
  processStripeEvent,
  constructWebhookEvent,
  resetProcessedWebhookEvents,
  type WebhookRepositoryTarget,
} from '../stripe-webhook.ts';
import type { License } from '../../types/index.ts';

describe('Webhooks de Stripe: Idempotencia y Actualización de Licencias', () => {
  let storedLicenses: Map<string, License>;
  let mockRepo: WebhookRepositoryTarget;

  beforeEach(() => {
    resetProcessedWebhookEvents();
    storedLicenses = new Map();

    mockRepo = {
      async findLicenseByOrgId(orgId: string): Promise<License | null> {
        return storedLicenses.get(orgId) || null;
      },
      async findLicenseBySubscriptionId(subId: string): Promise<License | null> {
        for (const lic of storedLicenses.values()) {
          if (lic.stripe_subscription_id === subId) {
            return lic;
          }
        }
        return null;
      },
      async saveLicense(license: License): Promise<void> {
        storedLicenses.set(license.org_id, license);
      },
    };
  });

  it('procesa checkout.session.completed y activa la licencia pro', async () => {
    const mockEvent = {
      id: 'evt_test_checkout_001',
      type: 'checkout.session.completed',
      data: {
        object: {
          client_reference_id: 'org-empresa-1',
          customer: 'cus_stripe_123',
          subscription: 'sub_stripe_abc',
          metadata: {
            org_id: 'org-empresa-1',
            plan: 'pro',
          },
        },
      },
    } as unknown as Stripe.Event;

    const res = await processStripeEvent(mockEvent, mockRepo);
    assert.strictEqual(res.processed, true);

    const saved = storedLicenses.get('org-empresa-1');
    assert(saved);
    assert.strictEqual(saved.plan, 'pro');
    assert.strictEqual(saved.is_active, true);
    assert.strictEqual(saved.stripe_customer_id, 'cus_stripe_123');
    assert.strictEqual(saved.stripe_subscription_id, 'sub_stripe_abc');
  });

  it('garantiza idempotencia: el mismo event.id dos veces solo tiene un efecto y la segunda se marca como duplicado', async () => {
    const mockEvent = {
      id: 'evt_idempotent_test_999',
      type: 'checkout.session.completed',
      data: {
        object: {
          client_reference_id: 'org-empresa-2',
          customer: 'cus_stripe_456',
          subscription: 'sub_stripe_def',
          metadata: {
            org_id: 'org-empresa-2',
            plan: 'business',
          },
        },
      },
    } as unknown as Stripe.Event;

    // Primer procesamiento
    const firstRun = await processStripeEvent(mockEvent, mockRepo);
    assert.strictEqual(firstRun.processed, true);

    // Segundo procesamiento con el mismo ID
    const secondRun = await processStripeEvent(mockEvent, mockRepo);
    assert.strictEqual(secondRun.processed, false);
    assert.strictEqual(secondRun.reason, 'duplicate_event');
  });

  it('procesa customer.subscription.deleted y revierte la licencia a inactiva y plan free', async () => {
    // Preparar licencia existente
    storedLicenses.set('org-empresa-3', {
      id: 'lic-3',
      org_id: 'org-empresa-3',
      plan: 'pro',
      valid_until: new Date(Date.now() + 100000).toISOString(),
      is_active: true,
      stripe_subscription_id: 'sub_to_cancel',
    });

    const cancelEvent = {
      id: 'evt_cancel_001',
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_to_cancel',
        },
      },
    } as unknown as Stripe.Event;

    const res = await processStripeEvent(cancelEvent, mockRepo);
    assert.strictEqual(res.processed, true);

    const updated = storedLicenses.get('org-empresa-3');
    assert(updated);
    assert.strictEqual(updated.is_active, false);
    assert.strictEqual(updated.plan, 'free');
  });

  it('procesa invoice.payment_failed y desactiva la suscripción', async () => {
    storedLicenses.set('org-empresa-4', {
      id: 'lic-4',
      org_id: 'org-empresa-4',
      plan: 'pro',
      valid_until: new Date(Date.now() + 100000).toISOString(),
      is_active: true,
      stripe_subscription_id: 'sub_payment_failed',
    });

    const failedInvoiceEvent = {
      id: 'evt_fail_001',
      type: 'invoice.payment_failed',
      data: {
        object: {
          subscription: 'sub_payment_failed',
        },
      },
    } as unknown as Stripe.Event;

    const res = await processStripeEvent(failedInvoiceEvent, mockRepo);
    assert.strictEqual(res.processed, true);

    const updated = storedLicenses.get('org-empresa-4');
    assert(updated);
    assert.strictEqual(updated.is_active, false);
  });

  it('checkout.session.completed sin org_id devuelve fallo controlado con reason missing_org_id_in_session', async () => {
    const mockEvent = {
      id: 'evt_no_org_001',
      type: 'checkout.session.completed',
      data: {
        object: {
          customer: 'cus_no_org',
          subscription: 'sub_no_org',
          metadata: {},
        },
      },
    } as unknown as Stripe.Event;

    const res = await processStripeEvent(mockEvent, mockRepo);
    assert.strictEqual(res.processed, false);
    assert.strictEqual(res.reason, 'missing_org_id_in_session');
  });

  it('procesa customer.subscription.updated actualizando estado y fecha de vigencia', async () => {
    storedLicenses.set('org-empresa-5', {
      id: 'lic-5',
      org_id: 'org-empresa-5',
      plan: 'pro',
      valid_until: new Date(Date.now() + 100000).toISOString(),
      is_active: false,
      stripe_subscription_id: 'sub_active_again',
    });

    const updateEvent = {
      id: 'evt_sub_upd_1',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_active_again',
          status: 'active',
          current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
        },
      },
    } as unknown as Stripe.Event;

    const res = await processStripeEvent(updateEvent, mockRepo);
    assert.strictEqual(res.processed, true);
    const updated = storedLicenses.get('org-empresa-5');
    assert(updated);
    assert.strictEqual(updated.is_active, true);

    // Si la suscripción no existe en el repositorio, no lanza excepción
    const updateUnknown = {
      id: 'evt_sub_upd_unknown',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_does_not_exist',
          status: 'canceled',
        },
      },
    } as unknown as Stripe.Event;
    const resUnknown = await processStripeEvent(updateUnknown, mockRepo);
    assert.strictEqual(resUnknown.processed, true);
  });

  it('procesa invoice.payment_failed con subscription como objeto o nula sin fallar', async () => {
    storedLicenses.set('org-empresa-6', {
      id: 'lic-6',
      org_id: 'org-empresa-6',
      plan: 'business',
      valid_until: new Date(Date.now() + 100000).toISOString(),
      is_active: true,
      stripe_subscription_id: 'sub_object_id',
    });

    // 1. Subscription como objeto { id: '...' }
    const objEvent = {
      id: 'evt_fail_obj_1',
      type: 'invoice.payment_failed',
      data: {
        object: {
          subscription: { id: 'sub_object_id' },
        },
      },
    } as unknown as Stripe.Event;
    const resObj = await processStripeEvent(objEvent, mockRepo);
    assert.strictEqual(resObj.processed, true);
    assert.strictEqual(storedLicenses.get('org-empresa-6')?.is_active, false);

    // 2. Invoice sin subscription
    const noSubEvent = {
      id: 'evt_fail_no_sub',
      type: 'invoice.payment_failed',
      data: {
        object: {},
      },
    } as unknown as Stripe.Event;
    const resNoSub = await processStripeEvent(noSubEvent, mockRepo);
    assert.strictEqual(resNoSub.processed, true);
  });

  it('eventos no manejados ejecutan la rama default y se registran sin error', async () => {
    const unhandledEvent = {
      id: 'evt_unhandled_type_999',
      type: 'payment_intent.succeeded',
      data: { object: {} },
    } as unknown as Stripe.Event;

    const res = await processStripeEvent(unhandledEvent, mockRepo);
    assert.strictEqual(res.processed, true);
  });

  it('valida firma de webhook exitosa y de firma inválida rechazada', () => {
    const fakeStripe = {
      webhooks: {
        constructEvent(payload: string, signature: string, secret: string) {
          if (signature !== 'valid_sig') {
            throw new Error('No signatures found matching the expected signature for payload');
          }
          return { id: 'evt_1', type: 'checkout.session.completed' };
        },
      },
    } as unknown as Stripe;

    // Caso exitoso
    const evt = constructWebhookEvent(fakeStripe, '{"id":"evt_1"}', 'valid_sig', 'whsec_test');
    assert.strictEqual(evt.id, 'evt_1');

    // Caso inválido
    assert.throws(
      () =>
        constructWebhookEvent(fakeStripe, '{"id":"evt_1"}', 'bad_sig', 'whsec_test'),
      /No signatures found matching/
    );
  });
});
