/**
 * Orders, from checkout to the door:
 *   createCheckout   validate the cart against shop.json + live settings + stock,
 *                    save a pending order (it holds stock for ~30 min) and open a
 *                    Stripe Checkout session
 *   fulfilSession    (webhook) mark it paid, issue tickets, email the buyer and
 *                    the committee. Safe to run twice for the same session.
 *   expireSession    (webhook) the buyer never paid: release the stock
 *   refundPayment    (webhook) refunded in Stripe: void the tickets
 *   checkIn          (admin) scan or type a ticket code at the door
 */
import { and, eq, sql } from 'drizzle-orm';
import type Stripe from 'stripe';
import { requireDb, type Db } from './db/client';
import { orderItems, orders, sfcSubmissions, tickets, type Order, type OrderItem } from './db/schema';
import { currency, findSku, sfcSku, ticketEvents, type Sku } from './catalog';
import { getStatus } from './settings';
import { takenBySku } from './stock';
import { getStripe } from './stripe';
import { env } from './env';
import { normaliseTicketCode, orderReference, publicToken, ticketCode } from './ids';
import { notifyAdmins, sendEmail } from './email/send';
import { qrPng } from './email/qr';
import * as tpl from './email/templates';
import eventsFile from '../content/events.json';

import { CheckoutError } from './errors';
export { CheckoutError };

export interface CartLine {
  sku: string;
  quantity: number;
}

export interface Buyer {
  name: string;
  email: string;
  phone?: string;
}

const MAX_PER_LINE = 10;
/** Stripe needs at least 30 minutes; a minute more so our hold never ends first. */
const HOLD_MINUTES = 31;

/** Merges duplicate lines and checks every sku and quantity. */
export function normaliseCart(lines: CartLine[]): { sku: Sku; quantity: number }[] {
  const merged = new Map<string, number>();
  for (const l of lines) {
    const q = Math.floor(Number(l.quantity));
    if (!l.sku || !Number.isFinite(q) || q <= 0) continue;
    merged.set(l.sku, (merged.get(l.sku) ?? 0) + q);
  }
  if (!merged.size) throw new CheckoutError('Your cart is empty.');
  return [...merged].map(([code, quantity]) => {
    const sku = findSku(code);
    if (!sku || sku.kind === 'sfc_fee') throw new CheckoutError('Something in your cart is no longer available. Please refresh and try again.');
    if (quantity > MAX_PER_LINE) throw new CheckoutError(`You can buy up to ${MAX_PER_LINE} of "${sku.name}" per order.`);
    return { sku, quantity };
  });
}

export function validateBuyer(b: Partial<Buyer>): Buyer {
  const name = (b.name ?? '').trim().slice(0, 120);
  const email = (b.email ?? '').trim().toLowerCase().slice(0, 200);
  const phone = (b.phone ?? '').trim().slice(0, 40) || undefined;
  if (!name) throw new CheckoutError('Please enter your name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new CheckoutError('Please enter a valid email address. Your tickets are sent there.');
  return { name, email, phone };
}

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** Inserts a pending order + its lines inside a stock lock. */
async function reserve(db: Db, kind: 'shop' | 'sfc', buyer: Buyer, lines: { sku: Sku; quantity: number }[]) {
  return db.transaction(async (tx: Tx) => {
    // One lock for all stock checks: orders are few, correctness matters more.
    await tx.execute(sql`select pg_advisory_xact_lock(2127)`);
    const limited = lines.filter((l) => l.sku.limit !== null).map((l) => l.sku.sku);
    const taken = limited.length ? await takenBySku(tx, limited) : {};
    for (const l of lines) {
      if (l.sku.limit === null) continue;
      const left = l.sku.limit - (taken[l.sku.sku] ?? 0);
      if (l.quantity > left) {
        const what = `${l.sku.name}${l.sku.variant ? ` (${l.sku.variant})` : ''}`;
        throw new CheckoutError(left <= 0 ? `Sorry, "${what}" is sold out.` : `Sorry, only ${left} left of "${what}".`, 409);
      }
    }
    const totalCents = lines.reduce((sum, l) => sum + l.sku.price * l.quantity, 0);
    const [order] = await tx
      .insert(orders)
      .values({
        publicToken: publicToken(),
        reference: orderReference(),
        kind,
        email: buyer.email,
        name: buyer.name,
        phone: buyer.phone,
        currency,
        totalCents,
        expiresAt: new Date(Date.now() + HOLD_MINUTES * 60_000),
      })
      .returning();
    await tx.insert(orderItems).values(
      lines.map((l) => ({
        orderId: order.id,
        sku: l.sku.sku,
        kind: l.sku.kind,
        eventId: l.sku.eventId ?? null,
        name: l.sku.name,
        variant: l.sku.variant ?? null,
        unitCents: l.sku.price,
        quantity: l.quantity,
      })),
    );
    return order;
  });
}

async function openSession(db: Db, order: Order, lines: { sku: Sku; quantity: number }[], cancelPath: string) {
  const stripe = getStripe();
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: order.email,
      client_reference_id: order.id,
      metadata: { orderId: order.id, reference: order.reference },
      payment_intent_data: { metadata: { orderId: order.id, reference: order.reference }, description: `IFF ${order.reference}` },
      line_items: lines.map((l) => ({
        quantity: l.quantity,
        price_data: {
          currency: order.currency,
          unit_amount: l.sku.price,
          product_data: {
            name: l.sku.variant ? `${l.sku.name} (${l.sku.variant})` : l.sku.name,
            ...(l.sku.description ? { description: l.sku.description.slice(0, 300) } : {}),
          },
        },
      })),
      allow_promotion_codes: true,
      expires_at: Math.floor(order.expiresAt.getTime() / 1000),
      success_url: `${env.siteUrl}/order/${order.publicToken}?paid=1`,
      cancel_url: `${env.siteUrl}${cancelPath}`,
    });
    await db.update(orders).set({ stripeSessionId: session.id }).where(eq(orders.id, order.id));
    if (!session.url) throw new Error('Stripe returned no checkout URL');
    return session.url;
  } catch (err) {
    // Release the hold straight away.
    await db.update(orders).set({ status: 'cancelled' }).where(eq(orders.id, order.id));
    throw err;
  }
}

/** Tickets and/or merch. Returns the Stripe Checkout URL to send the buyer to. */
export async function createCheckout(input: { lines: CartLine[]; buyer: Partial<Buyer> }): Promise<{ url: string; order: Order }> {
  const lines = normaliseCart(input.lines);
  const buyer = validateBuyer(input.buyer);
  const status = await getStatus();
  for (const l of lines) {
    if (l.sku.kind === 'ticket' && !status.tickets[l.sku.eventId!]) {
      const ev = ticketEvents.find((e) => e.eventId === l.sku.eventId);
      throw new CheckoutError(`Tickets for ${ev?.eventName ?? 'this event'} aren't on sale right now.`);
    }
    if (l.sku.kind === 'merch' && !status.merch) throw new CheckoutError("The merch shop isn't open right now.");
  }
  const db = requireDb();
  const order = await reserve(db, 'shop', buyer, lines);
  const url = await openSession(db, order, lines, '/cart?cancelled=1');
  return { url, order };
}

/** SFC entry fee for a saved (pending) submission. */
export async function createSfcCheckout(submissionId: string): Promise<{ url: string; order: Order }> {
  const db = requireDb();
  const [sub] = await db.select().from(sfcSubmissions).where(eq(sfcSubmissions.id, submissionId));
  if (!sub) throw new CheckoutError('Submission not found.', 404);
  if (sub.status !== 'pending_payment') throw new CheckoutError('This film has already been submitted.');
  const lines = [{ sku: sfcSku, quantity: 1 }];
  const order = await reserve(db, 'sfc', { name: sub.name, email: sub.email, phone: sub.phone ?? undefined }, lines);
  await db.update(sfcSubmissions).set({ orderId: order.id }).where(eq(sfcSubmissions.id, sub.id));
  const url = await openSession(db, order, lines, '/sfc?cancelled=1#submit');
  return { url, order };
}

const eventInfo = (id: string) => eventsFile.items.find((e) => e.id === id);

/** The ticket label for an item: "General admission", or "Festival pass · 2 of 3". */
function ticketLabel(item: OrderItem, n: number, perUnit: number) {
  return perUnit > 1 ? `${item.name} · ${(n % perUnit) + 1} of ${perUnit}` : item.name;
}

/** Sends the buyer their confirmation (tickets with QR codes) again or for the first time. */
export async function sendOrderEmails(orderId: string, { admins = true } = {}) {
  const db = requireDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order || order.status !== 'paid') return;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  const emailOrder = { ...order };

  if (order.kind === 'sfc') {
    const [sub] = await db.select().from(sfcSubmissions).where(eq(sfcSubmissions.orderId, order.id));
    if (!sub) return;
    const buyerMail = tpl.sfcConfirmation(sub, emailOrder);
    await sendEmail({ to: order.email, ...buyerMail, template: 'sfc-confirmation', orderId: order.id });
    if (admins) await notifyAdmins({ ...tpl.adminSfcSubmission(sub), template: 'admin-sfc', orderId: order.id, replyTo: sub.email });
    return;
  }

  const issued = await db.select().from(tickets).where(and(eq(tickets.orderId, order.id), eq(tickets.status, 'valid')));
  const images = await Promise.all(issued.map(async (t, i) => ({ filename: `ticket-${t.code}.png`, content: await qrPng(t.code), contentId: `qr${i}` })));
  const counters = new Map<string, number>();
  const emailTickets = issued.map((t, i) => {
    const item = items.find((it) => it.id === t.orderItemId)!;
    const perUnit = findSku(item.sku)?.admissions ?? 1;
    const n = counters.get(item.id) ?? 0;
    counters.set(item.id, n + 1);
    const ev = eventInfo(t.eventId);
    return { code: t.code, label: ticketLabel(item, n, perUnit), eventName: ev?.name ?? t.eventId, dateLabel: ev?.dateLabel ?? '', venue: ev?.venue ?? '', qrCid: `qr${i}` };
  });
  const buyerMail = tpl.orderConfirmation(emailOrder, items, emailTickets);
  await sendEmail({ to: order.email, ...buyerMail, template: 'order-confirmation', orderId: order.id, images });
  if (admins) await notifyAdmins({ ...tpl.adminNewOrder(emailOrder, items), template: 'admin-order', orderId: order.id, replyTo: order.email });
}

async function findOrderForSession(db: Db, session: Stripe.Checkout.Session) {
  const id = session.metadata?.orderId ?? session.client_reference_id;
  const [order] = id
    ? await db.select().from(orders).where(eq(orders.id, id))
    : await db.select().from(orders).where(eq(orders.stripeSessionId, session.id));
  return order;
}

/** Payment confirmed. Idempotent: a second call for a paid order does nothing. */
export async function fulfilSession(session: Stripe.Checkout.Session): Promise<'fulfilled' | 'already' | 'unpaid' | 'unknown'> {
  if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') return 'unpaid';
  const db = requireDb();
  const order = await findOrderForSession(db, session);
  if (!order) return 'unknown';

  const done = await db.transaction(async (tx: Tx) => {
    // Lock the order row so two webhook deliveries can't both issue tickets.
    const [locked] = await tx.select().from(orders).where(eq(orders.id, order.id)).for('update');
    if (locked.status === 'paid' || locked.status === 'refunded') return false;
    const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
    await tx
      .update(orders)
      .set({
        status: 'paid',
        paidAt: new Date(),
        stripeSessionId: session.id,
        stripePaymentIntent: paymentIntent ?? null,
        // What was actually charged (promotion codes lower it).
        totalCents: session.amount_total ?? locked.totalCents,
      })
      .where(eq(orders.id, order.id));
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    const rows = items
      .filter((i) => i.kind === 'ticket')
      .flatMap((i) => {
        const per = findSku(i.sku)?.admissions ?? 1;
        return Array.from({ length: i.quantity * per }, () => ({ code: ticketCode(), orderId: order.id, orderItemId: i.id, eventId: i.eventId!, sku: i.sku }));
      });
    if (rows.length) await tx.insert(tickets).values(rows);
    if (locked.kind === 'sfc') {
      await tx.update(sfcSubmissions).set({ status: 'submitted', submittedAt: new Date() }).where(eq(sfcSubmissions.orderId, order.id));
    }
    return true;
  });
  if (!done) return 'already';
  await sendOrderEmails(order.id);
  return 'fulfilled';
}

/** Checkout abandoned: release the stock. */
export async function expireSession(session: Stripe.Checkout.Session) {
  const db = requireDb();
  const order = await findOrderForSession(db, session);
  if (order?.status === 'pending') await db.update(orders).set({ status: 'expired' }).where(eq(orders.id, order.id));
}

/** Fully refunded in Stripe: the order's tickets stop working. */
export async function refundPayment(paymentIntentId: string): Promise<number> {
  const db = requireDb();
  const [order] = await db.select().from(orders).where(eq(orders.stripePaymentIntent, paymentIntentId));
  if (!order || order.status === 'refunded') return 0;
  await db.update(orders).set({ status: 'refunded', refundedAt: new Date() }).where(eq(orders.id, order.id));
  const voided = await db.update(tickets).set({ status: 'void' }).where(and(eq(tickets.orderId, order.id), eq(tickets.status, 'valid'))).returning({ id: tickets.id });
  await notifyAdmins({ ...tpl.adminRefund(order, voided.length), template: 'admin-refund', orderId: order.id });
  return voided.length;
}

export type CheckInResult =
  | { result: 'ok' | 'already' | 'void' | 'unpaid'; code: string; label: string; eventName: string; name: string; reference: string; checkedInAt: Date | null }
  | { result: 'unknown'; code: string };

/** At the door. Each code admits once. */
export async function checkIn(input: string, { commit = true } = {}): Promise<CheckInResult> {
  const db = requireDb();
  const code = normaliseTicketCode(input);
  const [row] = await db
    .select({ t: tickets, o: orders, i: orderItems })
    .from(tickets)
    .innerJoin(orders, eq(orders.id, tickets.orderId))
    .innerJoin(orderItems, eq(orderItems.id, tickets.orderItemId))
    .where(eq(tickets.code, code));
  if (!row) return { result: 'unknown', code };
  const base = { code, label: row.i.name, eventName: eventInfo(row.t.eventId)?.name ?? row.t.eventId, name: row.o.name, reference: row.o.reference };
  if (row.t.status === 'void') return { ...base, result: 'void', checkedInAt: row.t.checkedInAt };
  if (row.o.status !== 'paid') return { ...base, result: 'unpaid', checkedInAt: row.t.checkedInAt };
  if (row.t.checkedInAt) return { ...base, result: 'already', checkedInAt: row.t.checkedInAt };
  if (!commit) return { ...base, result: 'ok', checkedInAt: null };
  // Only the first scan wins, even if two doors scan at once.
  const [updated] = await db
    .update(tickets)
    .set({ checkedInAt: new Date() })
    .where(and(eq(tickets.id, row.t.id), sql`${tickets.checkedInAt} is null`))
    .returning();
  if (!updated) return { ...base, result: 'already', checkedInAt: new Date() };
  return { ...base, result: 'ok', checkedInAt: updated.checkedInAt };
}

/** Everything the buyer's order page shows. */
export async function getOrderByToken(token: string) {
  const db = requireDb();
  const [order] = await db.select().from(orders).where(eq(orders.publicToken, token));
  if (!order) return undefined;
  const [items, issued] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, order.id)),
    db.select().from(tickets).where(eq(tickets.orderId, order.id)),
  ]);
  return { order, items, tickets: issued };
}

