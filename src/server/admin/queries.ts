/** Read-only data for the admin pages. */
import { and, count, desc, eq, gte, ilike, inArray, isNotNull, or, sql, sum } from 'drizzle-orm';
import { requireDb } from '../db/client';
import { contactMessages, emailLog, newsletterSubscribers, orderItems, orders, pageViews, sfcSubmissions, tickets } from '../db/schema';
import { allSkus, ticketEvents } from '../catalog';
import { takenBySku } from '../stock';

export async function dashboard() {
  const db = requireDb();
  const since = new Date(Date.now() - 30 * 86400_000);
  const day = since.toISOString().slice(0, 10);
  const [revenue, paidOrders, pendingOrders, ticketCounts, checkedIn, sold, subs, messages, subscribers, views, topPages, recentOrders, emailsFailed] = await Promise.all([
    db.select({ cents: sum(orders.totalCents) }).from(orders).where(eq(orders.status, 'paid')),
    db.select({ n: count() }).from(orders).where(eq(orders.status, 'paid')),
    db.select({ n: count() }).from(orders).where(and(eq(orders.status, 'pending'), gte(orders.expiresAt, new Date()))),
    db.select({ eventId: tickets.eventId, n: count() }).from(tickets).where(eq(tickets.status, 'valid')).groupBy(tickets.eventId),
    db.select({ eventId: tickets.eventId, n: count() }).from(tickets).where(and(eq(tickets.status, 'valid'), isNotNull(tickets.checkedInAt))).groupBy(tickets.eventId),
    db
      .select({ sku: orderItems.sku, qty: sql<number>`sum(${orderItems.quantity})::int`, cents: sql<number>`sum(${orderItems.quantity} * ${orderItems.unitCents})::int` })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(eq(orders.status, 'paid'))
      .groupBy(orderItems.sku),
    db.select({ status: sfcSubmissions.status, n: count() }).from(sfcSubmissions).groupBy(sfcSubmissions.status),
    db.select({ n: count() }).from(contactMessages).where(eq(contactMessages.handled, false)),
    db.select({ n: count() }).from(newsletterSubscribers).where(sql`${newsletterSubscribers.unsubscribedAt} is null`),
    db.select({ day: pageViews.day, n: sql<number>`sum(${pageViews.views})::int` }).from(pageViews).where(gte(pageViews.day, day)).groupBy(pageViews.day).orderBy(pageViews.day),
    db.select({ path: pageViews.path, n: sql<number>`sum(${pageViews.views})::int` }).from(pageViews).where(gte(pageViews.day, day)).groupBy(pageViews.path).orderBy(desc(sql`sum(${pageViews.views})`)).limit(10),
    db.select().from(orders).where(eq(orders.status, 'paid')).orderBy(desc(orders.paidAt)).limit(8),
    db.select({ n: count() }).from(emailLog).where(eq(emailLog.status, 'failed')),
  ]);
  return {
    revenueCents: Number(revenue[0]?.cents ?? 0),
    paidOrders: paidOrders[0]?.n ?? 0,
    pendingOrders: pendingOrders[0]?.n ?? 0,
    ticketsByEvent: Object.fromEntries(ticketCounts.map((r) => [r.eventId, r.n])),
    checkedInByEvent: Object.fromEntries(checkedIn.map((r) => [r.eventId, r.n])),
    soldBySku: Object.fromEntries(sold.map((r) => [r.sku, { qty: Number(r.qty), cents: Number(r.cents) }])),
    submissions: Object.fromEntries(subs.map((r) => [r.status, r.n])),
    openMessages: messages[0]?.n ?? 0,
    subscribers: subscribers[0]?.n ?? 0,
    views: views.map((v) => ({ day: String(v.day), n: Number(v.n) })),
    topPages: topPages.map((v) => ({ path: v.path, n: Number(v.n) })),
    recentOrders,
    emailsFailed: emailsFailed[0]?.n ?? 0,
  };
}

/** Per sku: limit, taken (paid + held), paid. */
export async function stockTable() {
  const db = requireDb();
  const taken = await takenBySku(db);
  return allSkus()
    .filter((s) => s.kind !== 'sfc_fee')
    .map((s) => ({ ...s, taken: taken[s.sku] ?? 0 }));
}

export async function listOrders(opts: { q?: string; status?: string; limit?: number } = {}) {
  const db = requireDb();
  const q = opts.q?.trim();
  const where = and(
    opts.status ? eq(orders.status, opts.status as 'paid') : undefined,
    q ? or(ilike(orders.email, `%${q}%`), ilike(orders.name, `%${q}%`), ilike(orders.reference, `%${q}%`)) : undefined,
  );
  const list = await db.select().from(orders).where(where).orderBy(desc(orders.createdAt)).limit(opts.limit ?? 200);
  const ids = list.map((o) => o.id);
  const [items, mails, tix] = ids.length
    ? await Promise.all([
        db.select().from(orderItems).where(inArray(orderItems.orderId, ids)),
        db.select().from(emailLog).where(inArray(emailLog.orderId, ids)).orderBy(desc(emailLog.createdAt)),
        db.select().from(tickets).where(inArray(tickets.orderId, ids)),
      ])
    : [[], [], []];
  return list.map((o) => ({
    ...o,
    items: items.filter((i) => i.orderId === o.id),
    emails: mails.filter((m) => m.orderId === o.id),
    tickets: tix.filter((t) => t.orderId === o.id),
  }));
}

export const listEmails = (limit = 300) => requireDb().select().from(emailLog).orderBy(desc(emailLog.createdAt)).limit(limit);
export const listSubmissions = () => requireDb().select().from(sfcSubmissions).orderBy(desc(sfcSubmissions.createdAt));
export const listMessages = () => requireDb().select().from(contactMessages).orderBy(desc(contactMessages.createdAt)).limit(500);
export const listSubscribers = () => requireDb().select().from(newsletterSubscribers).orderBy(desc(newsletterSubscribers.createdAt));

export async function markMessage(id: string, handled: boolean) {
  await requireDb().update(contactMessages).set({ handled }).where(eq(contactMessages.id, id));
}

/** Rows of a CSV file (first row = headers), quoted for Excel / Sheets. */
export function toCsv(rows: (string | number | null | undefined | Date)[][]): string {
  const cell = (v: unknown) => {
    const s = v instanceof Date ? v.toISOString() : String(v ?? '');
    // Leading = + - @ would run as a formula in spreadsheets.
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return rows.map((r) => r.map(cell).join(',')).join('\r\n');
}

export async function exportCsv(kind: string): Promise<string | undefined> {
  if (kind === 'orders') {
    const list = await listOrders({ limit: 10000 });
    return toCsv([
      ['reference', 'status', 'name', 'email', 'phone', 'items', 'total_aud', 'paid_at', 'created_at', 'tickets', 'checked_in'],
      ...list.map((o) => [
        o.reference,
        o.status,
        o.name,
        o.email,
        o.phone,
        o.items.map((i) => `${i.quantity}x ${i.name}${i.variant ? ` (${i.variant})` : ''}`).join('; '),
        (o.totalCents / 100).toFixed(2),
        o.paidAt,
        o.createdAt,
        o.tickets.map((t) => t.code).join(' '),
        o.tickets.filter((t) => t.checkedInAt).length,
      ]),
    ]);
  }
  if (kind === 'tickets') {
    const db = requireDb();
    const rows = await db
      .select({ t: tickets, o: orders, i: orderItems })
      .from(tickets)
      .innerJoin(orders, eq(orders.id, tickets.orderId))
      .innerJoin(orderItems, eq(orderItems.id, tickets.orderItemId))
      .orderBy(tickets.eventId, orders.name);
    return toCsv([['code', 'event', 'ticket', 'status', 'name', 'email', 'order', 'checked_in_at'], ...rows.map((r) => [r.t.code, r.t.eventId, r.i.name, r.t.status, r.o.name, r.o.email, r.o.reference, r.t.checkedInAt])]);
  }
  if (kind === 'submissions') {
    const list = await listSubmissions();
    return toCsv([
      ['status', 'film', 'runtime_min', 'video', 'name', 'email', 'phone', 'school', 'country', 'team', 'synopsis', 'submitted_at'],
      ...list.map((s) => [s.status, s.filmTitle, s.runtimeMinutes, s.videoUrl, s.name, s.email, s.phone, s.school, s.country, s.team, s.synopsis, s.submittedAt]),
    ]);
  }
  if (kind === 'subscribers') {
    const list = await listSubscribers();
    return toCsv([['email', 'source', 'subscribed_at', 'unsubscribed_at'], ...list.map((s) => [s.email, s.source, s.createdAt, s.unsubscribedAt])]);
  }
  if (kind === 'messages') {
    const list = await listMessages();
    return toCsv([['received_at', 'name', 'email', 'subject', 'message', 'handled'], ...list.map((m) => [m.createdAt, m.name, m.email, m.subject, m.message, m.handled ? 'yes' : 'no'])]);
  }
  return undefined;
}

export { ticketEvents };
