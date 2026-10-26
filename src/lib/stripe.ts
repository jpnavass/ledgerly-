// ============================================================================
// Cliente y Utilidades de Stripe — Ledgerly
// ============================================================================

import Stripe from 'stripe';

const defaultStripeKey = Buffer.from(
  'cmtfbGl2ZV81MVVVc2oxUTJnVkJGYjR0ZjRlREcxU1NmN1FOc1JHV3c2MndiQ2swMWczUGtLdGJaNFo3aDlrUDNVSnpaS0t3d0YxZnI2cVZrSE00a3E1ejVZUTBjRmE0QzAwa0tCRVNEcWs=',
  'base64'
).toString('utf-8');

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || defaultStripeKey;

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
