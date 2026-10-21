/**
 * Sends email through Resend and records every attempt in email_log (the
 * admin page's "who has been emailed"). Without RESEND_API_KEY nothing is
 * sent and the attempt is logged as "skipped". Never throws: a failed email
 * must not fail a payment or a form.
 */
import { Resend } from 'resend';
import { env } from '../env';
import { getDb } from '../db/client';
import { emailLog } from '../db/schema';

export interface InlineImage {
  filename: string;
  content: Buffer;
  /** Referenced in the HTML as src="cid:<contentId>". */
  contentId: string;
}

export interface OutgoingEmail {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  /** Template name for the log, e.g. "order-tickets". */
  template: string;
  orderId?: string;
  replyTo?: string;
  images?: InlineImage[];
}

export interface SendResult {
  status: 'sent' | 'failed' | 'skipped';
  id?: string;
  error?: string;
}

let client: Resend | undefined;
/** Tests replace the transport. */
let transport: ((email: OutgoingEmail) => Promise<SendResult>) | undefined;
export const setEmailTransport = (fn: typeof transport) => (transport = fn);

async function deliver(email: OutgoingEmail): Promise<SendResult> {
  if (transport) return transport(email);
  const key = env.resendApiKey;
  if (!key) return { status: 'skipped', error: 'RESEND_API_KEY is not set' };
  client ??= new Resend(key);
  const { data, error } = await client.emails.send({
    from: env.emailFrom,
    to: email.to,
    subject: email.subject,
    html: email.html,
    text: email.text,
    replyTo: email.replyTo ?? env.emailReplyTo,
    attachments: email.images?.map((img) => ({ filename: img.filename, content: img.content, contentId: img.contentId })),
  });
  if (error) return { status: 'failed', error: `${error.name}: ${error.message}` };
  return { status: 'sent', id: data?.id };
}

export async function sendEmail(email: OutgoingEmail): Promise<SendResult> {
  const to = Array.isArray(email.to) ? email.to : [email.to];
  if (!to.length) return { status: 'skipped', error: 'No recipients' };
  let result: SendResult;
  try {
    result = await deliver({ ...email, to });
  } catch (err) {
    result = { status: 'failed', error: err instanceof Error ? err.message : String(err) };
  }
  if (result.status !== 'sent') console.warn(`[email] ${email.template} to ${to.join(', ')}: ${result.status} (${result.error})`);
  try {
    await getDb()
      ?.insert(emailLog)
      .values({
        to: to.join(', '),
        template: email.template,
        subject: email.subject,
        status: result.status,
        providerId: result.id,
        error: result.error,
        orderId: email.orderId,
      });
  } catch (err) {
    console.error('[email] could not write email_log', err);
  }
  return result;
}

/** Committee notification to every address in ADMIN_NOTIFY_EMAILS. */
export function notifyAdmins(email: Omit<OutgoingEmail, 'to'>) {
  return sendEmail({ ...email, to: env.adminNotifyEmails });
}
