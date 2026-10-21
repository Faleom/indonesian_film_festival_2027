/** Stripe client (server only). Tests swap in a fake with setStripe(). */
import Stripe from 'stripe';
import { env } from './env';
import { ServiceUnavailable } from './db/client';

let instance: Stripe | undefined;

export function getStripe(): Stripe {
  if (instance) return instance;
  const key = env.stripeSecretKey;
  if (!key) throw new ServiceUnavailable('Payments are not set up yet (STRIPE_SECRET_KEY).');
  instance = new Stripe(key, { appInfo: { name: 'IFF website' } });
  return instance;
}

export const setStripe = (s: Stripe | undefined) => (instance = s);
export type { Stripe };
