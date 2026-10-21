/**
 * Backend tests against a real Postgres (PGlite, in memory) with the real
 * migrations, a Stripe client whose network calls are stubbed, and a fake
 * email transport. Run with `npm test`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../src/server/db/schema';
import { setDb } from '../src/server/db/client';
import { setStripe } from '../src/server/stripe';
import { setEmailTransport, type OutgoingEmail } from '../src/server/email/send';
import { checkIn, createCheckout, createSfcCheckout, expireSession, fulfilSession, getOrderByToken, refundPayment, sendOrderEmails } from '../src/server/orders';
import { setSiteSetting, setTicketsOnSale, getStatus } from '../src/server/settings';
import { createSfcSubmission, parseVideoUrl, submitContact, subscribe } from '../src/server/forms';
import { handleStripeWebhook } from '../src/server/webhook';
import { countView } from '../src/server/analytics';
import { dashboard, exportCsv, listOrders } from '../src/server/admin/queries';
import { findSku } from '../src/server/catalog';

process.env.ADMIN_NOTIFY_EMAILS = 'chair@example.org, treasurer@example.org';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
process.env.SITE_URL = 'https://iff.test';

let db: ReturnType<typeof drizzle<typeof schema>>;
const sent: OutgoingEmail[] = [];
const sessions: Stripe.Checkout.SessionCreateParams[] = [];
let stripe: Stripe;

beforeAll(async () => {
  const pg = new PGlite();
  const dir = path.join(__dirname, '../drizzle');
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    for (const stmt of fs.readFileSync(path.join(dir, file), 'utf8').split('--> statement-breakpoint')) if (stmt.trim()) await pg.exec(stmt);
  }
  db = drizzle(pg, { schema });
  setDb(db);
  stripe = new Stripe('sk_test_dummy');
  // Stub the network call; keep the real webhook signature helpers.
  (stripe.checkout.sessions as unknown as { create: unknown }).create = async (params: Stripe.Checkout.SessionCreateParams) => {
    sessions.push(params);
    return { id: `cs_test_${sessions.length}`, url: `https://checkout.stripe.test/${sessions.length}` };
  };
  setStripe(stripe);
  setEmailTransport(async (e) => {
    sent.push(e);
    return { status: 'sent', id: `em_${sent.length}` };
  });
});

beforeEach(() => {
  sent.length = 0;
});

const paidSession = (orderId: string, id: string, amount: number, pi = `pi_${id}`) =>
  ({ id, object: 'checkout.session', payment_status: 'paid', metadata: { orderId }, client_reference_id: orderId, amount_total: amount, payment_intent: pi }) as unknown as Stripe.Checkout.Session;

describe('checkout', () => {
  it('refuses tickets that are not on sale', async () => {
    await expect(createCheckout({ lines: [{ sku: 'uts-general', quantity: 2 }], buyer: { name: 'Ana', email: 'ana@example.com' } })).rejects.toThrow(/aren't on sale/);
  });

  it('prices come from the catalogue and stock is held', async () => {
    await setTicketsOnSale('uts', true);
    expect((await getStatus()).tickets.uts).toBe(true);
    const { url, order } = await createCheckout({
      lines: [{ sku: 'uts-general', quantity: 2 }, { sku: 'tee-m', quantity: 1 }, { sku: 'uts-general', quantity: 1 }],
      buyer: { name: '  Ana  ', email: 'ANA@Example.com' },
    });
    expect(url).toMatch(/^https:\/\/checkout\.stripe\.test\//);
    expect(order.status).toBe('pending');
    expect(order.email).toBe('ana@example.com');
    expect(order.totalCents).toBe(3 * findSku('uts-general')!.price + findSku('tee-m')!.price);
    const params = sessions.at(-1)!;
    expect(params.line_items).toHaveLength(2);
    expect(params.line_items![0]).toMatchObject({ quantity: 3, price_data: { unit_amount: findSku('uts-general')!.price, currency: 'aud' } });
    expect(params.success_url).toBe(`https://iff.test/order/${order.publicToken}?paid=1`);
    expect(params.expires_at! * 1000 - Date.now()).toBeGreaterThan(30 * 60_000);
  });

  it('rejects unknown skus, bad emails and huge quantities', async () => {
    await expect(createCheckout({ lines: [{ sku: 'nope', quantity: 1 }], buyer: { name: 'A', email: 'a@b.co' } })).rejects.toThrow(/no longer available/);
    await expect(createCheckout({ lines: [{ sku: 'tote', quantity: 1 }], buyer: { name: 'A', email: 'not-an-email' } })).rejects.toThrow(/valid email/);
    await expect(createCheckout({ lines: [{ sku: 'tote', quantity: 11 }], buyer: { name: 'A', email: 'a@b.co' } })).rejects.toThrow(/up to 10/);
    await expect(createCheckout({ lines: [{ sku: 'sfc-entry', quantity: 1 }], buyer: { name: 'A', email: 'a@b.co' } })).rejects.toThrow();
  });

  it('never sells more than the capacity', async () => {
    await setTicketsOnSale('main', true);
    const cap = findSku('main-pass')!.limit!;
    for (let i = 0; i < cap / 10; i++) await createCheckout({ lines: [{ sku: 'main-pass', quantity: 10 }], buyer: { name: `B${i}`, email: `b${i}@example.com` } });
    await expect(createCheckout({ lines: [{ sku: 'main-pass', quantity: 1 }], buyer: { name: 'Late', email: 'late@example.com' } })).rejects.toThrow(/sold out/);
  });

  it('releases stock when a checkout expires', async () => {
    const before = (await listOrders({ status: 'pending' })).find((o) => o.items.some((i) => i.sku === 'main-pass'))!;
    await expireSession({ id: before.stripeSessionId, metadata: { orderId: before.id } } as unknown as Stripe.Checkout.Session);
    const { order } = await createCheckout({ lines: [{ sku: 'main-pass', quantity: 10 }], buyer: { name: 'Next', email: 'next@example.com' } });
    expect(order.status).toBe('pending');
  });
});

describe('payment, tickets, door', () => {
  let orderId = '';
  let token = '';
  it('fulfils once, issues tickets (a 3-day pass = 3) and emails buyer + committee', async () => {
    await setTicketsOnSale('main', true);
    const { order } = await createCheckout({
      lines: [{ sku: 'uts-student', quantity: 2 }, { sku: 'tote', quantity: 1 }],
      buyer: { name: 'Citra', email: 'citra@example.com', phone: '0400 000 000' },
    });
    orderId = order.id;
    token = order.publicToken;
    expect(await fulfilSession(paidSession(order.id, 'cs_paid_1', order.totalCents))).toBe('fulfilled');
    expect(await fulfilSession(paidSession(order.id, 'cs_paid_1', order.totalCents))).toBe('already');
    const view = await getOrderByToken(token);
    expect(view!.order.status).toBe('paid');
    expect(view!.tickets).toHaveLength(2);
    const buyer = sent.find((e) => e.template === 'order-confirmation')!;
    expect(buyer.to).toEqual(['citra@example.com']);
    expect(buyer.images).toHaveLength(2);
    expect(buyer.html).toContain(view!.tickets[0].code);
    expect(buyer.html).toContain('cid:qr0');
    expect(buyer.text).toContain('Merch:');
    const admin = sent.find((e) => e.template === 'admin-order')!;
    expect(admin.to).toEqual(['chair@example.org', 'treasurer@example.org']);
    expect(admin.subject).toContain('Citra');
    expect(sent.filter((e) => e.template === 'order-confirmation')).toHaveLength(1);
  });

  it('a festival pass issues three codes', async () => {
    const { order } = await createCheckout({ lines: [{ sku: 'main-pass', quantity: 1 }], buyer: { name: 'Dewi', email: 'dewi@example.com' } }).catch(async () => {
      // capacity may be used up by the earlier test: free some
      const pend = (await listOrders({ status: 'pending' })).filter((o) => o.items.some((i) => i.sku === 'main-pass'));
      for (const p of pend) await expireSession({ id: p.stripeSessionId, metadata: { orderId: p.id } } as unknown as Stripe.Checkout.Session);
      return createCheckout({ lines: [{ sku: 'main-pass', quantity: 1 }], buyer: { name: 'Dewi', email: 'dewi@example.com' } });
    });
    await fulfilSession(paidSession(order.id, 'cs_pass', order.totalCents));
    const view = await getOrderByToken(order.publicToken);
    expect(view!.tickets).toHaveLength(3);
    expect(sent.find((e) => e.template === 'order-confirmation')!.html).toContain('1 of 3');
  });

  it('checks a ticket in once, accepts sloppy typing, rejects unknown codes', async () => {
    const view = await getOrderByToken(token);
    const code = view!.tickets[0].code;
    const sloppy = code.toLowerCase().replace(/-/g, ' ');
    expect((await checkIn(sloppy)).result).toBe('ok');
    expect((await checkIn(code)).result).toBe('already');
    expect((await checkIn('IFF21-ZZZZ-ZZZZ')).result).toBe('unknown');
  });

  it('resends the confirmation without pinging the committee again', async () => {
    await sendOrderEmails(orderId, { admins: false });
    expect(sent.map((e) => e.template)).toEqual(['order-confirmation']);
  });

  it('a refund voids the tickets and tells the committee', async () => {
    const voided = await refundPayment('pi_cs_paid_1');
    expect(voided).toBe(2);
    const view = await getOrderByToken(token);
    expect(view!.order.status).toBe('refunded');
    expect((await checkIn(view!.tickets[1].code)).result).toBe('void');
    expect(sent.some((e) => e.template === 'admin-refund')).toBe(true);
  });
});

describe('stripe webhook', () => {
  it('rejects a bad signature and handles each event once', async () => {
    const { order } = await createCheckout({ lines: [{ sku: 'pin', quantity: 3 }], buyer: { name: 'Eko', email: 'eko@example.com' } });
    const payload = JSON.stringify({
      id: 'evt_1',
      object: 'event',
      type: 'checkout.session.completed',
      data: { object: paidSession(order.id, 'cs_webhook', order.totalCents) },
    });
    expect((await handleStripeWebhook(payload, 't=1,v1=bad')).status).toBe(400);
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_test_secret' });
    expect(await handleStripeWebhook(payload, header)).toEqual({ status: 200, body: 'fulfilled' });
    expect(await handleStripeWebhook(payload, header)).toEqual({ status: 200, body: 'duplicate' });
    expect((await getOrderByToken(order.publicToken))!.order.status).toBe('paid');
  });
});

describe('short film competition', () => {
  const entry = {
    name: 'Fajar',
    email: 'fajar@uni.edu',
    school: 'Uni of Melbourne',
    country: 'Australia',
    filmTitle: 'Senja',
    runtime: '12',
    synopsis: 'A short film about dusk.',
    videoUrl: 'https://youtu.be/dQw4w9WgXcQ',
    rules: 'on',
  };

  it('only accepts entries while the window is open', async () => {
    await setSiteSetting('sfc_mode', 'closed');
    await expect(createSfcSubmission(entry)).rejects.toThrow(/open on|closed/);
    await setSiteSetting('sfc_mode', 'open');
    expect((await getStatus()).sfc.state).toBe('open');
  });

  it('saves the entry, charges the fee and confirms by email', async () => {
    const id = await createSfcSubmission(entry);
    const { order } = await createSfcCheckout(id);
    expect(sessions.at(-1)!.line_items![0]).toMatchObject({ price_data: { unit_amount: findSku('sfc-entry')!.price } });
    expect(sessions.at(-1)!.cancel_url).toContain('/sfc');
    await fulfilSession(paidSession(order.id, 'cs_sfc', order.totalCents));
    const [sub] = await db.select().from(schema.sfcSubmissions).where(eq(schema.sfcSubmissions.id, id));
    expect(sub.status).toBe('submitted');
    expect(sub.videoUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(sent.map((e) => e.template).sort()).toEqual(['admin-sfc', 'sfc-confirmation']);
    await expect(createSfcCheckout(id)).rejects.toThrow(/already/);
  });

  it('validates the entry', async () => {
    await expect(createSfcSubmission({ ...entry, videoUrl: 'https://drive.google.com/file/d/abc' })).rejects.toThrow(/YouTube or Vimeo/);
    await expect(createSfcSubmission({ ...entry, rules: '' })).rejects.toThrow(/rules/);
    await expect(createSfcSubmission({ ...entry, runtime: '600' })).rejects.toThrow(/running time/);
  });

  it('understands YouTube and Vimeo links', () => {
    expect(parseVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10').provider).toBe('youtube');
    expect(parseVideoUrl('https://youtube.com/shorts/dQw4w9WgXcQ').embed).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(parseVideoUrl('https://vimeo.com/123456789/abcdef1234').embed).toBe('https://player.vimeo.com/video/123456789?h=abcdef1234');
    expect(() => parseVideoUrl('javascript:alert(1)')).toThrow();
  });
});

describe('forms, analytics, admin', () => {
  it('stores contact messages and emails both sides', async () => {
    await submitContact({ name: 'Gita', email: 'gita@example.com', subject: 'Tickets', message: 'Hi <b>there</b>' });
    const admin = sent.find((e) => e.template === 'admin-contact')!;
    expect(admin.replyTo).toBe('gita@example.com');
    expect(admin.html).toContain('&lt;b&gt;there&lt;/b&gt;');
    expect(sent.find((e) => e.template === 'contact-receipt')!.to).toEqual(['gita@example.com']);
  });

  it('subscribes once', async () => {
    expect(await subscribe({ email: 'Hana@Example.com' })).toBe('subscribed');
    expect(await subscribe({ email: 'hana@example.com' })).toBe('already');
  });

  it('counts page views and builds the dashboard + CSV', async () => {
    await countView('/uts');
    await countView('/uts?x=1');
    await countView('/admin');
    const d = await dashboard();
    expect(d.topPages.find((p) => p.path === '/uts')!.n).toBe(2);
    expect(d.topPages.some((p) => p.path.startsWith('/admin'))).toBe(false);
    expect(d.paidOrders).toBeGreaterThanOrEqual(3);
    expect(d.subscribers).toBe(1);
    const csv = (await exportCsv('orders'))!;
    expect(csv.split('\r\n')[0]).toContain('reference');
    const logged = await db.select().from(schema.emailLog);
    expect(logged.length).toBeGreaterThan(5);
  });
});
