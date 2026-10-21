/** Starts a Stripe Checkout for the cart (cookie) and the buyer's details. */
import type { APIRoute } from 'astro';
import { readCart, writeCart } from '../../server/cart';
import { createCheckout } from '../../server/orders';
import { describeError, isBot, json, rateLimited, readBody, redirect, sameOrigin, wantsJson } from '../../server/http';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!sameOrigin(request)) return json({ ok: false, message: 'Bad origin' }, 403);
  const body = await readBody(request);
  const fail = (message: string, status: number) =>
    wantsJson(request) ? json({ ok: false, message }, status) : redirect(`/cart?error=${encodeURIComponent(message)}`);
  if (isBot(body)) return fail('Please try again.', 400);
  if (rateLimited(request, 'checkout', 12)) return fail('Too many attempts. Please wait a few minutes.', 429);
  const cart = readCart(cookies);
  try {
    const { url } = await createCheckout({
      lines: Object.entries(cart).map(([sku, quantity]) => ({ sku, quantity })),
      buyer: { name: body.name, email: body.email, phone: body.phone },
    });
    // The order now holds the items; the cart starts fresh.
    writeCart(cookies, {});
    return wantsJson(request) ? json({ ok: true, redirect: url }) : redirect(url);
  } catch (err) {
    const { message, status } = describeError(err);
    return fail(message, status);
  }
};
