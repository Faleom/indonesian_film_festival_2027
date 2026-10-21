/** Data for the shop pages (server-rendered): catalogue + live status + stock, safe without a database. */
import { allSkus, merchItems, ticketEvents } from '../server/catalog';
import { getStatus, type LiveStatus } from '../server/settings';
import { remainingBySku } from '../server/stock';
import { getDb } from '../server/db/client';
import { features } from '../server/env';

export async function shopState(): Promise<{ status: LiveStatus; remaining: Record<string, number | null>; payments: boolean }> {
  try {
    const status = await getStatus();
    const db = getDb();
    const skus = allSkus().map((s) => s.sku);
    const remaining = db ? await remainingBySku(db, skus) : Object.fromEntries(allSkus().map((s) => [s.sku, s.limit]));
    return { status, remaining, payments: features.payments };
  } catch (err) {
    console.error('[shop] status unavailable', err);
    return {
      status: { tickets: Object.fromEntries(ticketEvents.map((e) => [e.eventId, false])), merch: false, sfc: { mode: 'auto', state: 'closed' } },
      remaining: {},
      payments: false,
    };
  }
}

export { merchItems, ticketEvents };
