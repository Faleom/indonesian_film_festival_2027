/**
 * The shop catalogue from src/content/shop.json, as the server sees it.
 * Prices always come from here, never from the browser. No astro:content
 * imports, so API routes, pages and tests can all use it.
 */
import shop from '../content/shop.json';
import eventsFile from '../content/events.json';

export type ItemKind = 'ticket' | 'merch' | 'sfc_fee';

export interface Sku {
  sku: string;
  kind: ItemKind;
  name: string;
  variant?: string;
  description?: string;
  /** Cents. */
  price: number;
  /** Most that can ever be sold; null = no limit. */
  limit: number | null;
  eventId?: string;
  /** QR tickets issued per unit (tickets only; a 3-day pass = 3). */
  admissions?: number;
  /** Merch item id (for grouping variants). */
  itemId?: string;
  media?: string;
}

export interface TicketEvent {
  eventId: string;
  eventName: string;
  dateLabel: string;
  venue: string;
  theme: string;
  slug: string;
  onSaleDefault: boolean;
  types: Sku[];
}

export const currency = shop.currency;
export const merchPickup = shop.merch.pickup;
export const merchOnSaleDefault = shop.merch.onSale;
export const sfcConfig = shop.sfc;

const events = eventsFile.items;
const eventById = new Map(events.map((e) => [e.id, e]));

export const ticketEvents: TicketEvent[] = shop.tickets
  .map((t) => {
    const e = eventById.get(t.event);
    if (!e) throw new Error(`shop.json: unknown event "${t.event}" (see events.json)`);
    return {
      eventId: e.id,
      eventName: e.name,
      dateLabel: e.dateLabel,
      venue: e.venue,
      theme: e.theme,
      slug: e.slug,
      onSaleDefault: t.onSale,
      types: t.types.map((ty) => ({
        sku: ty.sku,
        kind: 'ticket' as const,
        name: ty.name,
        description: ty.description,
        price: ty.price,
        limit: ty.capacity ?? null,
        admissions: 'admissions' in ty ? (ty.admissions as number) : 1,
        eventId: e.id,
      })),
    };
  })
  .sort((a, b) => (eventById.get(a.eventId)!.order ?? 0) - (eventById.get(b.eventId)!.order ?? 0));

export const merchItems = shop.merch.items.map((item) => ({
  id: item.id,
  name: item.name,
  description: item.description,
  media: item.media,
  variants: item.variants.map(
    (v): Sku => ({
      sku: v.sku,
      kind: 'merch',
      name: item.name,
      variant: v.label,
      description: item.description,
      price: v.price,
      limit: v.stock ?? null,
      itemId: item.id,
      media: item.media,
    }),
  ),
}));

export const sfcSku: Sku = { sku: shop.sfc.sku, kind: 'sfc_fee', name: shop.sfc.name, price: shop.sfc.entryFee, limit: null };

const all = new Map<string, Sku>();
for (const s of [...ticketEvents.flatMap((e) => e.types), ...merchItems.flatMap((m) => m.variants), sfcSku]) {
  if (all.has(s.sku)) throw new Error(`shop.json: duplicate sku "${s.sku}"`);
  all.set(s.sku, s);
}

export const findSku = (sku: string) => all.get(sku);
export const allSkus = () => [...all.values()];

/** Today's date in Melbourne as YYYY-MM-DD. */
export const melbourneToday = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne' }).format(d);

/** SFC submissions window from shop.json (inclusive). */
export function sfcWindow(today = melbourneToday()): 'soon' | 'open' | 'closed' {
  return today < shop.sfc.opens ? 'soon' : today > shop.sfc.closes ? 'closed' : 'open';
}

export const formatMoney = (cents: number, cur = currency) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: cur.toUpperCase(), minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
