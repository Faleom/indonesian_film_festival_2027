/**
 * The cart lives in a small cookie ({ sku: quantity }), so it works with and
 * without JavaScript and every page (static or not) can show its count.
 * Not HttpOnly on purpose: the header reads the count. Prices are never in it.
 */
import type { AstroCookies } from 'astro';
import { findSku } from './catalog';

export const CART_COOKIE = 'iff_cart';
export type Cart = Record<string, number>;

export function readCart(cookies: AstroCookies): Cart {
  try {
    const raw = cookies.get(CART_COOKIE)?.value;
    // Astro decodes the cookie value for us.
    const data = raw ? (JSON.parse(raw) as Cart) : {};
    return Object.fromEntries(
      Object.entries(data)
        .map(([sku, q]) => [sku, Math.min(10, Math.max(0, Math.floor(Number(q))))] as const)
        .filter(([sku, q]) => q > 0 && findSku(sku) && findSku(sku)!.kind !== 'sfc_fee'),
    );
  } catch {
    return {};
  }
}

export function writeCart(cookies: AstroCookies, cart: Cart) {
  const clean = Object.fromEntries(Object.entries(cart).filter(([, q]) => q > 0));
  if (!Object.keys(clean).length) return cookies.delete(CART_COOKIE, { path: '/' });
  // Astro URL-encodes the value; the header script decodes it once.
  cookies.set(CART_COOKIE, JSON.stringify(clean), { path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 7 });
}

export const cartCount = (cart: Cart) => Object.values(cart).reduce((a, b) => a + b, 0);
