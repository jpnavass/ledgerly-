// ============================================================================
// Cliente y Utilidades de Stripe — Ledgerly
// ============================================================================

import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
      typescript: true,
    })
  : null;

export function getStripeClient(): Stripe {
  if (!stripe) {
    throw new Error(
      'Configuración de Stripe no disponible: defina la variable de entorno STRIPE_SECRET_KEY en el servidor.'
    );
  }
  return stripe;
}

export const STRIPE_PRICES = {
  pro: process.env.STRIPE_PRICE_PRO || '',
  business: process.env.STRIPE_PRICE_BUSINESS || '',
};
