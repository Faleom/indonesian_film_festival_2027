/** SFC entry: save the submission, then send the filmmaker to Stripe for the entry fee. */
import type { APIRoute } from 'astro';
import { createSfcSubmission } from '../../server/forms';
import { createSfcCheckout } from '../../server/orders';
import { describeError, formReply, isBot, rateLimited, readBody, sameOrigin } from '../../server/http';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const body = await readBody(request);
  if (!sameOrigin(request) || isBot(body)) return formReply(request, 'sfc', { ok: false, message: 'Please try again.' }, 400);
  if (rateLimited(request, 'sfc', 6)) return formReply(request, 'sfc', { ok: false, message: 'Too many attempts. Please wait a few minutes.' }, 429);
  try {
    const id = await createSfcSubmission(body);
    const { url } = await createSfcCheckout(id);
    return formReply(request, 'sfc', { ok: true, message: 'Taking you to payment…', redirect: url });
  } catch (err) {
    const { message, status } = describeError(err);
    return formReply(request, 'sfc', { ok: false, message }, status);
  }
};
