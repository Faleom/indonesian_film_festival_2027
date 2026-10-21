/**
 * Email templates in the festival's newspaper style: table layout and inline
 * styles (what email apps understand), paper background, ink accent.
 * Every template returns { subject, html, text }. Anything a visitor typed is
 * escaped. Copy lives here, not in src/content, because it is not page content.
 */
import site from '../../content/site.json';
import { formatMoney, merchPickup } from '../catalog';
import { env } from '../env';

const INK = '#5b0093';
const PAPER = '#eae4d8';
const BLACK = '#111111';

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export interface Rendered {
  subject: string;
  html: string;
  text: string;
}

function layout(opts: { preheader: string; kicker: string; title: string; body: string }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(opts.title)}</title></head>
<body style="margin:0;padding:0;background:${PAPER};color:${BLACK};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#f4efe6;border:1px solid ${BLACK};">
<tr><td style="padding:20px 28px;border-bottom:4px double ${BLACK};font-family:'Courier New',Courier,monospace;font-size:12px;letter-spacing:2px;text-transform:uppercase;">
<span style="color:${INK};font-weight:bold;">${esc(site.shortName)} ${esc(site.editionNumber)}</span> &middot; ${esc(site.edition)} ${esc(site.name)} &middot; ${esc(site.city)}
</td></tr>
<tr><td style="padding:28px 28px 8px;font-family:'Courier New',Courier,monospace;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${INK};">${esc(opts.kicker)}</td></tr>
<tr><td style="padding:0 28px 12px;font-family:Impact,'Arial Narrow Bold',Arial,sans-serif;font-size:40px;line-height:1;text-transform:uppercase;color:${INK};">${esc(opts.title)}</td></tr>
<tr><td style="padding:8px 28px 28px;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;">${opts.body}</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid ${BLACK};font-family:'Courier New',Courier,monospace;font-size:11px;line-height:1.6;color:#444;">
${esc(site.name)} &middot; non-profit, student-run &middot; ${esc(site.city)}<br>
Questions? Reply to this email or write to <a href="mailto:${esc(site.email)}" style="color:${INK};">${esc(site.email)}</a>.
</td></tr></table></td></tr></table></body></html>`;
}

const p = (html: string) => `<p style="margin:0 0 14px;">${html}</p>`;
const button = (href: string, label: string) =>
  `<p style="margin:20px 0;"><a href="${esc(href)}" style="display:inline-block;padding:12px 20px;background:${INK};color:#ffffff;text-decoration:none;font-family:'Courier New',Courier,monospace;font-size:14px;letter-spacing:1px;text-transform:uppercase;border:1px solid ${BLACK};">${esc(label)}</a></p>`;
const rows = (pairs: [string, string][]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 18px;border-top:1px solid ${BLACK};">${pairs
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #bbb;font-family:'Courier New',Courier,monospace;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:${INK};width:38%;vertical-align:top;">${esc(k)}</td><td style="padding:8px 0;border-bottom:1px solid #bbb;vertical-align:top;">${v}</td></tr>`,
    )
    .join('')}</table>`;

export interface EmailOrder {
  reference: string;
  name: string;
  email: string;
  phone?: string | null;
  totalCents: number;
  currency: string;
  publicToken: string;
  createdAt?: Date;
}
export interface EmailItem {
  name: string;
  variant?: string | null;
  kind: string;
  quantity: number;
  unitCents: number;
  eventId?: string | null;
}
export interface EmailTicket {
  code: string;
  label: string;
  eventName: string;
  dateLabel: string;
  venue: string;
  /** cid of the inline QR image */
  qrCid: string;
}

const orderUrl = (o: EmailOrder) => `${env.siteUrl}/order/${o.publicToken}`;
const itemLine = (i: EmailItem) => `${i.quantity} × ${i.name}${i.variant ? ` (${i.variant})` : ''}`;
const itemsTable = (items: EmailItem[], o: EmailOrder) =>
  rows([...items.map((i): [string, string] => [itemLine(i), esc(formatMoney(i.unitCents * i.quantity, o.currency))]), ['Total paid', `<strong>${esc(formatMoney(o.totalCents, o.currency))}</strong>`]]);

/** Buyer: payment confirmed, tickets (QR + code) and/or merch. */
export function orderConfirmation(o: EmailOrder, items: EmailItem[], tickets: EmailTicket[]): Rendered {
  const hasTickets = tickets.length > 0;
  const hasMerch = items.some((i) => i.kind === 'merch');
  const ticketBlocks = tickets
    .map(
      (t) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border:2px solid ${BLACK};background:#ffffff;"><tr>
<td width="150" style="padding:12px;"><img src="cid:${esc(t.qrCid)}" width="140" height="140" alt="QR code for ticket ${esc(t.code)}" style="display:block;border:0;"></td>
<td style="padding:12px 14px 12px 4px;vertical-align:top;">
<div style="font-family:'Courier New',Courier,monospace;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${INK};">${esc(t.eventName)}</div>
<div style="font-family:Impact,'Arial Narrow Bold',Arial,sans-serif;font-size:22px;line-height:1.1;text-transform:uppercase;margin:4px 0;">${esc(t.label)}</div>
<div style="font-size:14px;">${esc(t.dateLabel)}<br>${esc(t.venue)}</div>
<div style="margin-top:8px;font-family:'Courier New',Courier,monospace;font-size:18px;font-weight:bold;letter-spacing:2px;">${esc(t.code)}</div>
</td></tr></table>`,
    )
    .join('');
  const body = [
    p(`Hi ${esc(o.name)}, thank you! Your payment went through.`),
    hasTickets ? p(`Here ${tickets.length === 1 ? 'is your ticket' : `are your ${tickets.length} tickets`}. Show the QR code (or tell us the code) at the door. Each code lets one person in once.`) : '',
    ticketBlocks,
    hasMerch ? p(`<strong>Merch:</strong> ${esc(merchPickup)}`) : '',
    `<div style="font-family:'Courier New',Courier,monospace;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin-top:8px;">Order ${esc(o.reference)}</div>`,
    itemsTable(items, o),
    button(orderUrl(o), hasTickets ? 'View tickets online' : 'View your order'),
  ].join('');
  const text = [
    `Hi ${o.name}, thank you! Your payment went through.`,
    '',
    ...tickets.map((t) => `TICKET ${t.code}: ${t.label}, ${t.eventName}, ${t.dateLabel}, ${t.venue}`),
    hasMerch ? `\nMerch: ${merchPickup}` : '',
    '',
    `Order ${o.reference}`,
    ...items.map((i) => `${itemLine(i)}: ${formatMoney(i.unitCents * i.quantity, o.currency)}`),
    `Total paid: ${formatMoney(o.totalCents, o.currency)}`,
    '',
    `Your order online: ${orderUrl(o)}`,
  ].join('\n');
  return {
    subject: hasTickets ? `Your tickets · ${site.shortName} ${site.editionNumber} · ${o.reference}` : `Order confirmed · ${site.shortName} ${site.editionNumber} · ${o.reference}`,
    html: layout({ preheader: `Order ${o.reference} is confirmed.`, kicker: `Order ${o.reference}`, title: hasTickets ? "You're in" : 'Order confirmed', body }),
    text,
  };
}

/** Committee: someone bought something. */
export function adminNewOrder(o: EmailOrder, items: EmailItem[]): Rendered {
  const body = [
    p(`New paid order <strong>${esc(o.reference)}</strong>.`),
    rows([
      ['Buyer', `${esc(o.name)}<br><a href="mailto:${esc(o.email)}" style="color:${INK};">${esc(o.email)}</a>${o.phone ? `<br>${esc(o.phone)}` : ''}`],
      ...items.map((i): [string, string] => [itemLine(i), esc(formatMoney(i.unitCents * i.quantity, o.currency))]),
      ['Total paid', `<strong>${esc(formatMoney(o.totalCents, o.currency))}</strong>`],
    ]),
    button(`${env.siteUrl}/admin/orders`, 'Open admin'),
  ].join('');
  return {
    subject: `[IFF admin] New order ${o.reference} · ${formatMoney(o.totalCents, o.currency)} · ${o.name}`,
    html: layout({ preheader: `${o.name} paid ${formatMoney(o.totalCents, o.currency)}`, kicker: 'Committee notice', title: 'New order', body }),
    text: [`New paid order ${o.reference}`, `Buyer: ${o.name} <${o.email}>${o.phone ? ` ${o.phone}` : ''}`, ...items.map(itemLine), `Total: ${formatMoney(o.totalCents, o.currency)}`, `${env.siteUrl}/admin/orders`].join('\n'),
  };
}

/** Committee: an order was refunded in Stripe; its tickets are void now. */
export function adminRefund(o: EmailOrder, voided: number): Rendered {
  const body = [p(`Order <strong>${esc(o.reference)}</strong> (${esc(o.name)}, ${esc(o.email)}) was refunded in Stripe.`), p(`${voided} ticket${voided === 1 ? '' : 's'} can no longer be used at the door.`)].join('');
  return {
    subject: `[IFF admin] Refund ${o.reference} · ${o.name}`,
    html: layout({ preheader: `Order ${o.reference} refunded`, kicker: 'Committee notice', title: 'Order refunded', body }),
    text: `Order ${o.reference} (${o.name}, ${o.email}) was refunded. ${voided} ticket(s) voided.`,
  };
}

export interface EmailSubmission {
  name: string;
  email: string;
  phone?: string | null;
  school: string;
  country: string;
  filmTitle: string;
  runtimeMinutes: number;
  synopsis: string;
  videoUrl: string;
  team?: string | null;
}

const submissionRows = (s: EmailSubmission) =>
  rows([
    ['Film', `<strong>${esc(s.filmTitle)}</strong> (${esc(s.runtimeMinutes)} min)`],
    ['Video', `<a href="${esc(s.videoUrl)}" style="color:${INK};">${esc(s.videoUrl)}</a>`],
    ['Filmmaker', `${esc(s.name)} · ${esc(s.school)} · ${esc(s.country)}`],
    ...(s.team ? [['Team', esc(s.team)] as [string, string]] : []),
    ['Synopsis', esc(s.synopsis)],
  ]);

/** Filmmaker: entry fee paid, submission received. */
export function sfcConfirmation(s: EmailSubmission, o: EmailOrder): Rendered {
  const body = [
    p(`Hi ${esc(s.name)}, thank you for entering the Short Film Competition! We've received your film and your entry fee.`),
    submissionRows(s),
    p('Please keep the video link working and viewable (public or unlisted) until the winners are announced. We will be in touch by email.'),
    `<div style="font-family:'Courier New',Courier,monospace;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Receipt ${esc(o.reference)} · ${esc(formatMoney(o.totalCents, o.currency))}</div>`,
  ].join('');
  return {
    subject: `Submission received: ${s.filmTitle} · ${site.shortName} ${site.editionNumber} Short Film Competition`,
    html: layout({ preheader: `We've received "${s.filmTitle}".`, kicker: 'Short Film Competition', title: 'Film received', body }),
    text: [`Hi ${s.name}, thank you for entering the Short Film Competition! We've received your film and your entry fee.`, '', `Film: ${s.filmTitle} (${s.runtimeMinutes} min)`, `Video: ${s.videoUrl}`, '', `Receipt ${o.reference}: ${formatMoney(o.totalCents, o.currency)}`].join('\n'),
  };
}

/** Committee: a paid SFC submission. */
export function adminSfcSubmission(s: EmailSubmission): Rendered {
  const body = [p(`New Short Film Competition entry from <strong>${esc(s.name)}</strong> (<a href="mailto:${esc(s.email)}" style="color:${INK};">${esc(s.email)}</a>${s.phone ? `, ${esc(s.phone)}` : ''}). Entry fee paid.`), submissionRows(s), button(`${env.siteUrl}/admin/submissions`, 'Open admin')].join('');
  return {
    subject: `[IFF admin] SFC entry: ${s.filmTitle} · ${s.name}`,
    html: layout({ preheader: `${s.filmTitle} by ${s.name}`, kicker: 'Committee notice', title: 'New SFC entry', body }),
    text: [`New SFC entry: ${s.filmTitle} (${s.runtimeMinutes} min) by ${s.name} <${s.email}>`, s.videoUrl, s.synopsis].join('\n'),
  };
}

export interface EmailMessage {
  name: string;
  email: string;
  subject: string;
  message: string;
}

/** Visitor: we got your message. */
export function contactReceipt(m: EmailMessage): Rendered {
  const body = [p(`Hi ${esc(m.name)}, thanks for getting in touch. We've received your message and someone from the committee will reply soon.`), rows([['Subject', esc(m.subject)], ['Your message', esc(m.message).replace(/\n/g, '<br>')]])].join('');
  return {
    subject: `We got your message · ${site.shortName} ${site.editionNumber}`,
    html: layout({ preheader: 'Thanks for getting in touch.', kicker: 'Message received', title: 'Thanks!', body }),
    text: `Hi ${m.name}, thanks for getting in touch. We've received your message and someone from the committee will reply soon.\n\nSubject: ${m.subject}\n\n${m.message}`,
  };
}

/** Committee: a contact form message. Reply-to is the visitor. */
export function adminContact(m: EmailMessage): Rendered {
  const body = [rows([['From', `${esc(m.name)} &lt;<a href="mailto:${esc(m.email)}" style="color:${INK};">${esc(m.email)}</a>&gt;`], ['Subject', esc(m.subject)]]), p(esc(m.message).replace(/\n/g, '<br>'))].join('');
  return {
    subject: `[IFF contact] ${m.subject} · ${m.name}`,
    html: layout({ preheader: m.message.slice(0, 90), kicker: 'Contact form', title: m.subject, body }),
    text: `From: ${m.name} <${m.email}>\nSubject: ${m.subject}\n\n${m.message}`,
  };
}

/** Subscriber: welcome to the newsletter. */
export function newsletterWelcome(): Rendered {
  const body = [p("You're on the list. We'll email you when the lineup is announced and tickets go on sale, and not much else."), button(env.siteUrl, 'Visit the festival site')].join('');
  return {
    subject: `You're on the list · ${site.shortName} ${site.editionNumber}`,
    html: layout({ preheader: "You're on the IFF list.", kicker: 'Newsletter', title: "You're on the list", body }),
    text: `You're on the list. We'll email you when the lineup is announced and tickets go on sale.\n${env.siteUrl}`,
  };
}
