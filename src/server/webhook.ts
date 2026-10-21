/**
 * Stripe webhook: verifies the signature, handles each event once
 * (stripe_events), and hands it to the order logic.
 * Events to enable in Stripe: checkout.session.completed,
 * checkout.session.async_payment_succeeded, checkout.session.expired,
 * charge.refunded.
 */
import type Stripe from 'stripe';
import { requireDb, ServiceUnavailable } from './db/client';
import { stripeEvents } from './db/schema';
import { env } from './env';
import { getStripe } from './stripe';
import { expireSession, fulfilSession, refundPayment } from './orders';

export async function handleStripeWebhook(rawBody: string, signature: string | null): Promise<{ status: number; body: string }> {
  const secret = env.stripeWebhookSecret;
  if (!secret) throw new ServiceUnavailable('STRIPE_WEBHOOK_SECRET is not set');
  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(rawBody, signature ?? '', secret);
  } catch (err) {
    return { status: 400, body: `Bad signature: ${err instanceof Error ? err.message : err}` };
  }
  const db = requireDb();
  // Claim the event; a duplicate delivery inserts nothing and stops here.
  const claimed = await db.insert(stripeEvents).values({ id: event.id, type: event.type }).onConflictDoNothing().returning();
  if (!claimed.length) return { status: 200, body: 'duplicate' };
  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        return { status: 200, body: await fulfilSession(event.data.object) };
      case 'checkout.session.expired':
      case 'checkout.session.async_payment_failed':
        await expireSession(event.data.object);
        return { status: 200, body: 'expired' };
      case 'charge.refunded': {
        const charge = event.data.object;
        const pi = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
        if (charge.refunded && pi) return { status: 200, body: `voided ${await refundPayment(pi)}` };
        return { status: 200, body: 'partial refund ignored' };
      }
      default:
        return { status: 200, body: 'ignored' };
    }
  } catch (err) {
    // Let Stripe retry later: forget we saw it.
    const { eq } = await import('drizzle-orm');
    await db.delete(stripeEvents).where(eq(stripeEvents.id, event.id));
    throw err;
  }
}
