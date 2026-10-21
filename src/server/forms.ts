/** Contact, newsletter and SFC submission: validate, store, email. */
import { eq } from 'drizzle-orm';
import { requireDb } from './db/client';
import { contactMessages, newsletterSubscribers, sfcSubmissions } from './db/schema';
import { notifyAdmins, sendEmail } from './email/send';
import * as tpl from './email/templates';
import { CheckoutError } from './errors';
import { getStatus } from './settings';
import { sfcConfig } from './catalog';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (v: string | undefined, max: number) => (v ?? '').trim().slice(0, max);
const need = (v: string, what: string) => {
  if (!v) throw new CheckoutError(`Please fill in ${what}.`);
  return v;
};
const email = (v: string | undefined) => {
  const e = clean(v, 200).toLowerCase();
  if (!EMAIL.test(e)) throw new CheckoutError('Please enter a valid email address.');
  return e;
};

export async function submitContact(body: Record<string, string>) {
  const m = {
    name: need(clean(body.name, 120), 'your name'),
    email: email(body.email),
    subject: need(clean(body.subject, 120), 'a subject'),
    message: need(clean(body.message, 5000), 'your message'),
  };
  await requireDb().insert(contactMessages).values(m);
  await Promise.all([
    sendEmail({ to: m.email, ...tpl.contactReceipt(m), template: 'contact-receipt' }),
    notifyAdmins({ ...tpl.adminContact(m), template: 'admin-contact', replyTo: m.email }),
  ]);
}

export async function subscribe(body: Record<string, string>) {
  const e = email(body.email);
  const db = requireDb();
  const [existing] = await db.select().from(newsletterSubscribers).where(eq(newsletterSubscribers.email, e));
  if (existing && !existing.unsubscribedAt) return 'already';
  if (existing) await db.update(newsletterSubscribers).set({ unsubscribedAt: null }).where(eq(newsletterSubscribers.id, existing.id));
  else await db.insert(newsletterSubscribers).values({ email: e, source: clean(body.source, 60) || null });
  await sendEmail({ to: e, ...tpl.newsletterWelcome(), template: 'newsletter-welcome' });
  return 'subscribed';
}

/** YouTube or Vimeo only: the film is never uploaded to us. */
export function parseVideoUrl(input: string): { url: string; provider: 'youtube' | 'vimeo'; embed: string } {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    throw new CheckoutError('Please paste the full link to your film (YouTube or Vimeo).');
  }
  const host = u.hostname.replace(/^www\.|^m\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = u.searchParams.get('v') ?? u.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/)?.[1] ?? null;
  }
  if (id && /^[\w-]{6,20}$/.test(id)) return { url: `https://www.youtube.com/watch?v=${id}`, provider: 'youtube', embed: `https://www.youtube-nocookie.com/embed/${id}` };
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    // vimeo.com/123456789 or vimeo.com/123456789/abcdef (unlisted hash)
    const m = u.pathname.match(/(?:\/video)?\/(\d{6,12})(?:\/([\da-f]{6,20}))?/);
    if (m) {
      const hash = m[2] ?? u.searchParams.get('h');
      return { url: `https://vimeo.com/${m[1]}${hash ? `/${hash}` : ''}`, provider: 'vimeo', embed: `https://player.vimeo.com/video/${m[1]}${hash ? `?h=${hash}` : ''}` };
    }
  }
  throw new CheckoutError('That link doesn\'t look like a YouTube or Vimeo video. Upload your film there (public or unlisted) and paste the link.');
}

/** Saves the entry as "pending payment"; returns its id for the Stripe entry fee. */
export async function createSfcSubmission(body: Record<string, string>): Promise<string> {
  const status = await getStatus();
  if (status.sfc.state !== 'open') {
    throw new CheckoutError(status.sfc.state === 'soon' ? `Submissions open on ${new Date(`${sfcConfig.opens}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}.` : 'Submissions are closed.');
  }
  const runtime = Math.round(Number(body.runtime));
  if (!Number.isFinite(runtime) || runtime < 1 || runtime > 60) throw new CheckoutError('Please enter the running time in minutes (1 to 60).');
  if (body.rules !== 'on' && body.rules !== 'true') throw new CheckoutError('Please confirm you agree to the competition rules.');
  const video = parseVideoUrl(body.videoUrl ?? '');
  const [row] = await requireDb()
    .insert(sfcSubmissions)
    .values({
      name: need(clean(body.name, 120), 'your name'),
      email: email(body.email),
      phone: clean(body.phone, 40) || null,
      school: need(clean(body.school, 160), 'your school or university'),
      country: need(clean(body.country, 80), 'your country'),
      filmTitle: need(clean(body.filmTitle, 160), 'the film title'),
      runtimeMinutes: runtime,
      synopsis: need(clean(body.synopsis, 1500), 'a short synopsis'),
      videoUrl: video.url,
      videoProvider: video.provider,
      team: clean(body.team, 1000) || null,
      agreedToRules: true,
    })
    .returning({ id: sfcSubmissions.id });
  return row.id;
}
