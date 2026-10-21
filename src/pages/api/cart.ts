/**
 * Cart changes. Form fields: op=add|set|remove|clear, sku, quantity,
 * back (where to go after, without JS). Answers JSON for fetch().
 */
import type { APIRoute } from 'astro';
import { readCart, writeCart, cartCount } from '../../server/cart';
import { findSku } from '../../server/catalog';
import { json, readBody, redirect, sameOrigin, wantsJson } from '../../server/http';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!sameOrigin(request)) return json({ ok: false, message: 'Bad origin' }, 403);
  const body = await readBody(request);
  const cart = readCart(cookies);
  const sku = body.sku ?? '';
  const q = Math.max(0, Math.min(10, Math.floor(Number(body.quantity ?? 1)) || 0));
  const item = findSku(sku);
  let message = 'Cart updated';
  if (body.op === 'clear') for (const k of Object.keys(cart)) delete cart[k];
  else if (!item || item.kind === 'sfc_fee') return json({ ok: false, message: 'That item is not available.' }, 400);
  else if (body.op === 'remove') delete cart[sku];
  else if (body.op === 'set') cart[sku] = q;
  else {
    cart[sku] = Math.min(10, (cart[sku] ?? 0) + Math.max(1, q));
    message = `Added to cart: ${item.name}${item.variant ? ` (${item.variant})` : ''}`;
  }
  writeCart(cookies, cart);
  if (wantsJson(request)) return json({ ok: true, message, count: cartCount(cart) });
  const back = body.back && body.back.startsWith('/') && !body.back.startsWith('//') ? body.back : '/cart';
  return redirect(back);
};
