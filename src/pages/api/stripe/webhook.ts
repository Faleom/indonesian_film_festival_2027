/** Stripe → us. Point the Stripe webhook endpoint at https://<site>/api/stripe/webhook. */
import type { APIRoute } from 'astro';
import { handleStripeWebhook } from '../../../server/webhook';
import { describeError } from '../../../server/http';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { status, body } = await handleStripeWebhook(await request.text(), request.headers.get('stripe-signature'));
    return new Response(body, { status });
  } catch (err) {
    const { message, status } = describeError(err);
    // 5xx makes Stripe retry later (it retries for up to 3 days).
    return new Response(message, { status: status >= 500 ? status : 500 });
  }
};
