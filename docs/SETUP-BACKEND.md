# Setting up payments, emails and the admin page

The site builds and works without any of this; each feature switches on when
its settings are in place. Everything below is done once, in web dashboards,
no coding. Budget about an hour. Do it in **test mode** first, then go live.

| Piece | Service | Cost |
|---|---|---|
| Database (orders, tickets, entries, messages) | [Supabase](https://supabase.com) | Free tier is plenty |
| Payments (tickets, merch, SFC entry fee) | [Stripe](https://stripe.com) | Per-transaction fee only |
| Emails (tickets with QR, receipts, committee alerts) | [Resend](https://resend.com) | Free up to 3,000 emails/month |
| Hosting + settings | Vercel (already set up) | Free |

All settings go into **Vercel → the project → Settings → Environment Variables**
(tick Production and Preview), then **redeploy** (Deployments → ⋯ → Redeploy).
`.env.example` in the repo lists them all.

---

## 1. Database (Supabase)

**Easiest: Vercel → Integrations → Supabase.** Creating the database from Vercel's
marketplace connects it to the project and adds `POSTGRES_URL` (and friends) to the
environment variables by itself. The site reads `POSTGRES_URL` when `DATABASE_URL`
isn't set, so there's nothing to copy: just create the tables (step 2 below, via
**Open in Supabase**) and redeploy.

Or by hand:

1. Create a free account and a new project. Region: **Sydney**. Save the database password somewhere safe.
2. Create the tables: **SQL Editor → New query**, paste the whole of
   [`drizzle/0000_init.sql`](../drizzle/0000_init.sql) (remove the `--> statement-breakpoint` lines
   or leave them, they're comments), **Run**. If Supabase warns about Row Level Security,
   choose **Run and enable RLS** (the site doesn't need the public keys; RLS keeps them out).
   Then run [`drizzle/0001_enable_rls.sql`](../drizzle/0001_enable_rls.sql) the same way
   (harmless if RLS is already on).
   (Developers can instead run `DATABASE_URL=<direct URI> npm run db:migrate`.)
3. **Project Settings → Database → Connection string → URI**, choose the
   **Transaction pooler** (port **6543**). Put your password into it.
4. In Vercel add `DATABASE_URL` = that URI.

The committee can look at every table in Supabase's **Table Editor** too, but
the admin page (section 5) is easier.

## 2. Payments (Stripe)

1. Create a Stripe account for the festival (business details: non-profit /
   student association, country Australia, currency AUD). It starts in **test mode**.
2. **Developers → API keys**: copy the **Secret key** (`sk_test_…`) into Vercel as `STRIPE_SECRET_KEY`.
3. **Developers → Webhooks → Add endpoint**:
   - URL: `https://<your-site>/api/stripe/webhook`
   - Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
     `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`
   - Copy the **Signing secret** (`whsec_…`) into Vercel as `STRIPE_WEBHOOK_SECRET`.
4. Optional: **Settings → Payment methods**: turn on Apple Pay / Google Pay. **Products → Coupons**:
   promotion codes (e.g. a committee discount) work automatically at checkout.
5. Redeploy.

**Test it:** open tickets for an event (admin page, section 5), add tickets to the
cart and pay with card `4242 4242 4242 4242`, any future date, any CVC. You should
land on your order page with QR codes, and get the emails (section 3).

**Go live:** complete Stripe's account activation, switch the dashboard to live mode,
create the webhook again in live mode, and replace both keys in Vercel with the live
ones (`sk_live_…`, new `whsec_…`). Redeploy.

**Refunds:** refund in the Stripe dashboard (Payments → the payment → Refund). The
order shows "refunded" in admin and its tickets stop working at the door.

## 3. Emails (Resend)

1. Create an account. **Domains → Add domain**: the festival's domain (e.g.
   `indonesianfilmfestival.com.au`). Add the DNS records it shows at your domain host
   and wait for "Verified". (Until a domain is verified Resend only delivers to your own
   Resend login email, which is fine for testing.)
2. **API Keys → Create**: put it in Vercel as `RESEND_API_KEY`.
3. `EMAIL_FROM` = e.g. `Indonesian Film Festival <tickets@indonesianfilmfestival.com.au>`
   (must be on the verified domain).
4. `EMAIL_REPLY_TO` (optional) = the committee inbox, so buyers' replies reach a person.
5. `ADMIN_NOTIFY_EMAILS` = the committee addresses told about **every** order, SFC entry,
   contact message and refund, separated by commas:
   `chair@…, treasurer@…, sfc@…`
6. Also set `SITE_URL` = the public address (e.g. `https://indonesianfilmfestival.com.au`)
   so links in emails point to the right place.

Who gets what:

| Email | Goes to |
|---|---|
| "You're in": tickets with QR codes + codes, merch pickup note, receipt | The buyer (email typed at checkout) |
| SFC "Film received" + receipt | The filmmaker (email in the entry form) |
| "We got your message" | Whoever used the contact form |
| Newsletter welcome | The subscriber |
| New order / new SFC entry / new message / refund | Everyone in `ADMIN_NOTIFY_EMAILS` |

Every email (sent, failed or skipped) is listed in admin → **Emails**.

## 4. Turning things on

Prices, ticket types, capacities, merch and the SFC fee live in
[`src/content/shop.json`](../src/content/shop.json). **They are placeholders now:** fix
them before opening sales. Capacities are hard limits (the site never oversells; a
cart being paid holds its items for 30 minutes).

## 5. The hidden admin page

1. In Vercel set `ADMIN_KEY` to a long secret keyword (12+ characters). Share it only with the committee.
2. Open the site, scroll to the footer and click the **©** (or go to `/admin`). Type the keyword.

What's there:

| Page | For |
|---|---|
| Dashboard | Revenue, tickets per event, check-ins, stock per item, SFC entries, page views (last 30 days), latest orders |
| Sales on/off | Open or close ticket sales per event, the merch shop, and SFC submissions. Live in seconds, no rebuild |
| Orders | Who bought what, payment status, ticket codes, which emails went out; resend a confirmation; CSV downloads (orders, door list) |
| Check-in | At the door: scan QR codes with a phone camera (Chrome on Android) or type the code. Each code works once |
| SFC entries | Films (with links), filmmakers, paid/unpaid; CSV |
| Emails / Messages / Subscribers | The email log, contact messages (mark done), newsletter list (CSV to import into your mailing tool) |

The session lasts 12 hours. To lock everyone out, change `ADMIN_KEY` and redeploy.

## 6. Checklist before opening sales

- [ ] Real prices, ticket types and capacities in `shop.json` (and real merch, or hide merch in admin)
- [ ] SFC entry fee, dates and rules confirmed (`shop.json` → `sfc`; rules text in `pages.json` → `sfcSubmit.rules`)
- [ ] Stripe live mode + live webhook, Resend domain verified, `ADMIN_NOTIFY_EMAILS` set
- [ ] One real purchase with a real card, refunded afterwards, checked in admin
- [ ] Door team knows the check-in page and has the keyword
