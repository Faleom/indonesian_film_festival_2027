/** Anonymous page view beacon (navigator.sendBeacon from every page). */
import type { APIRoute } from 'astro';
import { countView } from '../../server/analytics';
import { features } from '../../server/env';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!features.db) return new Response(null, { status: 204 });
  try {
    const path = (await request.text()).slice(0, 200);
    // Skip obvious bots.
    if (!/bot|crawl|spider|preview|lighthouse/i.test(request.headers.get('user-agent') ?? '')) await countView(path);
  } catch (err) {
    console.error('[pv]', err);
  }
  return new Response(null, { status: 204 });
};
