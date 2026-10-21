/**
 * Live switches the admin page controls, on top of the defaults in src/content:
 * ticket sales per event, merch sales and the SFC submission window.
 */
import { eq } from 'drizzle-orm';
import { getDb, requireDb } from './db/client';
import { eventSettings, siteSettings } from './db/schema';
import { merchOnSaleDefault, sfcWindow, ticketEvents } from './catalog';

export type SfcMode = 'auto' | 'open' | 'closed';

export interface LiveStatus {
  /** eventId -> tickets on sale */
  tickets: Record<string, boolean>;
  merch: boolean;
  sfc: { mode: SfcMode; state: 'soon' | 'open' | 'closed' };
}

export async function getStatus(): Promise<LiveStatus> {
  const tickets = Object.fromEntries(ticketEvents.map((e) => [e.eventId, e.onSaleDefault]));
  let merch = merchOnSaleDefault;
  let mode: SfcMode = 'auto';
  const db = getDb();
  if (db) {
    const [rows, site] = await Promise.all([db.select().from(eventSettings), db.select().from(siteSettings)]);
    for (const r of rows) if (r.ticketsOnSale !== null && r.eventId in tickets) tickets[r.eventId] = r.ticketsOnSale;
    for (const s of site) {
      if (s.key === 'merch_on_sale' && typeof s.value === 'boolean') merch = s.value;
      if (s.key === 'sfc_mode' && (s.value === 'open' || s.value === 'closed' || s.value === 'auto')) mode = s.value;
    }
  }
  const auto = sfcWindow();
  const state = mode === 'auto' ? auto : mode === 'open' ? 'open' : auto === 'soon' ? 'soon' : 'closed';
  return { tickets, merch, sfc: { mode, state } };
}

export async function setTicketsOnSale(eventId: string, onSale: boolean | null) {
  const db = requireDb();
  await db
    .insert(eventSettings)
    .values({ eventId, ticketsOnSale: onSale, updatedAt: new Date() })
    .onConflictDoUpdate({ target: eventSettings.eventId, set: { ticketsOnSale: onSale, updatedAt: new Date() } });
}

export async function setSiteSetting(key: 'merch_on_sale' | 'sfc_mode', value: unknown) {
  const db = requireDb();
  if (value === null) return db.delete(siteSettings).where(eq(siteSettings.key, key));
  await db
    .insert(siteSettings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: new Date() } });
}
