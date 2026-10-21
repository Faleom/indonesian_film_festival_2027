/**
 * Database tables (Postgres). Changing this file? Run `npm run db:generate`
 * to write a new migration into /drizzle, then `npm run db:migrate`.
 * Money is stored in cents (integers), times in UTC.
 */
import { boolean, date, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const orderKind = pgEnum('order_kind', ['shop', 'sfc']);
export const orderStatus = pgEnum('order_status', ['pending', 'paid', 'expired', 'cancelled', 'refunded']);
export const itemKind = pgEnum('item_kind', ['ticket', 'merch', 'sfc_fee']);
export const ticketStatus = pgEnum('ticket_status', ['valid', 'void']);
export const submissionStatus = pgEnum('submission_status', ['pending_payment', 'submitted', 'withdrawn']);
export const emailStatus = pgEnum('email_status', ['sent', 'failed', 'skipped']);

const created = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

/** One checkout: tickets and/or merch, or an SFC entry fee. */
export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Unguessable id for the buyer's order page (/order/<token>). */
    publicToken: text('public_token').notNull().unique(),
    /** Short human reference, e.g. IFF-7KQ2M9. */
    reference: text('reference').notNull().unique(),
    kind: orderKind('kind').notNull(),
    status: orderStatus('status').notNull().default('pending'),
    email: text('email').notNull(),
    name: text('name').notNull(),
    phone: text('phone'),
    currency: text('currency').notNull().default('aud'),
    totalCents: integer('total_cents').notNull(),
    stripeSessionId: text('stripe_session_id').unique(),
    stripePaymentIntent: text('stripe_payment_intent'),
    /** Unpaid orders hold stock until this time. */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    refundedAt: timestamp('refunded_at', { withTimezone: true }),
    createdAt: created(),
  },
  (t) => [index('orders_status_idx').on(t.status), index('orders_email_idx').on(t.email)],
);

export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    sku: text('sku').notNull(),
    kind: itemKind('kind').notNull(),
    /** Event id for tickets (events.json). */
    eventId: text('event_id'),
    /** Name and variant as sold (kept even if the catalogue changes later). */
    name: text('name').notNull(),
    variant: text('variant'),
    unitCents: integer('unit_cents').notNull(),
    quantity: integer('quantity').notNull(),
  },
  (t) => [index('order_items_order_idx').on(t.orderId), index('order_items_sku_idx').on(t.sku)],
);

/** One row per admission: the code in the QR on the buyer's email. */
export const tickets = pgTable(
  'tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull().unique(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    orderItemId: uuid('order_item_id')
      .notNull()
      .references(() => orderItems.id, { onDelete: 'cascade' }),
    eventId: text('event_id').notNull(),
    sku: text('sku').notNull(),
    status: ticketStatus('status').notNull().default('valid'),
    checkedInAt: timestamp('checked_in_at', { withTimezone: true }),
    createdAt: created(),
  },
  (t) => [index('tickets_order_idx').on(t.orderId), index('tickets_event_idx').on(t.eventId)],
);

/** Admin switches that override the defaults in src/content (no rebuild needed). */
export const eventSettings = pgTable('event_settings', {
  eventId: text('event_id').primaryKey(),
  /** null = use shop.json `onSale`. */
  ticketsOnSale: boolean('tickets_on_sale'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const siteSettings = pgTable('site_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sfcSubmissions = pgTable('sfc_submissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  status: submissionStatus('status').notNull().default('pending_payment'),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  school: text('school').notNull(),
  country: text('country').notNull(),
  filmTitle: text('film_title').notNull(),
  runtimeMinutes: integer('runtime_minutes').notNull(),
  synopsis: text('synopsis').notNull(),
  videoUrl: text('video_url').notNull(),
  videoProvider: text('video_provider').notNull(),
  team: text('team'),
  agreedToRules: boolean('agreed_to_rules').notNull(),
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  createdAt: created(),
});

export const contactMessages = pgTable('contact_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  handled: boolean('handled').notNull().default(false),
  createdAt: created(),
});

export const newsletterSubscribers = pgTable('newsletter_subscribers', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  source: text('source'),
  unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
  createdAt: created(),
});

/** Every email the site sends (or skips): "who has been emailed" in admin. */
export const emailLog = pgTable(
  'email_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    to: text('to').notNull(),
    template: text('template').notNull(),
    subject: text('subject').notNull(),
    status: emailStatus('status').notNull(),
    providerId: text('provider_id'),
    error: text('error'),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    createdAt: created(),
  },
  (t) => [index('email_log_order_idx').on(t.orderId)],
);

/** Stripe webhook events already handled (Stripe can deliver the same one twice). */
export const stripeEvents = pgTable('stripe_events', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Anonymous page view counts per day (no cookies, no personal data). */
export const pageViews = pgTable(
  'page_views',
  {
    day: date('day').notNull(),
    path: text('path').notNull(),
    views: integer('views').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.day, t.path] })],
);

export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Ticket = typeof tickets.$inferSelect;
export type SfcSubmission = typeof sfcSubmissions.$inferSelect;
