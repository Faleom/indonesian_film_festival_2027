/** Live status for static pages: ticket sales, merch, SFC window, stock left. */
import type { APIRoute } from 'astro';
import { getStatus } from '../../server/settings';
import { allSkus } from '../../server/catalog';
import { remainingBySku } from '../../server/stock';
import { getDb } from '../../server/db/client';
import { features } from '../../server/env';
import { json } from '../../server/http';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const status = await getStatus();
    const db = getDb();
    const remaining = db ? await remainingBySku(db, allSkus().map((s) => s.sku)) : {};
    return new Response(JSON.stringify({ ...status, payments: features.payments, remaining }), {
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=0, s-maxage=15, stale-while-revalidate=60' },
    });
  } catch (err) {
    console.error('[status]', err);
    return json({ error: true }, 500);
  }
};
