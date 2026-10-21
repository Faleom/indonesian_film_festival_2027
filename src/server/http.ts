/**
 * Small helpers for the API routes. Every form works two ways:
 *   - with JS: fetch() with Accept: application/json -> JSON { ok, message, redirect? }
 *   - without JS: a normal form POST -> 303 redirect to a page that shows the result
 */
import { CheckoutError } from './errors';
import { ServiceUnavailable } from './db/client';

export const wantsJson = (req: Request) => (req.headers.get('accept') ?? '').includes('application/json');

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

export const redirect = (to: string, status = 303) => new Response(null, { status, headers: { location: to, 'cache-control': 'no-store' } });

/** Reads a JSON body or a form body into a plain object of strings. */
export async function readBody(req: Request): Promise<Record<string, string>> {
  const type = req.headers.get('content-type') ?? '';
  if (type.includes('application/json')) {
    const data = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));
  }
  const form = await req.formData();
  const out: Record<string, string> = {};
  for (const [k, v] of form) if (typeof v === 'string') out[k] = out[k] ? `${out[k]},${v}` : v;
  return out;
}

/** Hidden field bots fill in and people never see. */
export const isBot = (body: Record<string, string>) => !!body.website?.trim();

/** Best-effort per-instance limit (serverless instances don't share memory). */
const hits = new Map<string, number[]>();
export function rateLimited(req: Request, bucket: string, max = 6, windowMs = 10 * 60_000): boolean {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > max;
}

/** Same-site check for state-changing requests (forms and fetch from our pages). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true; // some browsers omit it on same-origin form posts
  try {
    return new URL(origin).host === new URL(req.url).host;
  } catch {
    return false;
  }
}

/** Turns an error into the message a visitor should see, plus an HTTP status. */
export function describeError(err: unknown): { message: string; status: number } {
  if (err instanceof CheckoutError) return { message: err.message, status: err.status };
  if (err instanceof ServiceUnavailable) return { message: "This isn't available yet. Please try again later or email us.", status: 503 };
  console.error('[api]', err);
  return { message: 'Something went wrong on our side. Please try again in a minute.', status: 500 };
}

/** Reply for a form: JSON for fetch, or a redirect to /thanks?form=…&error=… */
export function formReply(req: Request, form: string, result: { ok: boolean; message: string; redirect?: string }, status = 200) {
  if (wantsJson(req)) return json(result, result.ok ? 200 : status);
  if (result.redirect) return redirect(result.redirect);
  const q = new URLSearchParams({ form, ...(result.ok ? {} : { error: result.message }) });
  return redirect(`/thanks?${q}`);
}
