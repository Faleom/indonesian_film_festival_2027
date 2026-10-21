/**
 * Hidden admin: unlocked by typing ADMIN_KEY on /admin/login. A signed,
 * HttpOnly cookie keeps the session for 12 hours. Without ADMIN_KEY (or a
 * database) the admin pages simply say they're switched off.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AstroCookies } from 'astro';
import { env } from '../env';

const COOKIE = 'iff_admin';
const HOURS = 12;

const sign = (payload: string, key: string) => createHmac('sha256', key).update(payload).digest('base64url');
const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export function keyMatches(input: string): boolean {
  const key = env.adminKey;
  if (!key || !input) return false;
  // Compare HMACs, so the length of the real key never leaks.
  return same(sign(input, 'iff-admin-compare'), sign(key, 'iff-admin-compare'));
}

export function startSession(cookies: AstroCookies, secure: boolean) {
  const key = env.adminKey!;
  const expires = Date.now() + HOURS * 3600_000;
  const payload = String(expires);
  cookies.set(COOKIE, `${payload}.${sign(payload, key)}`, { httpOnly: true, secure, sameSite: 'strict', path: '/', maxAge: HOURS * 3600 });
}

export function endSession(cookies: AstroCookies) {
  cookies.delete(COOKIE, { path: '/' });
}

export function isAdmin(cookies: AstroCookies): boolean {
  const key = env.adminKey;
  const raw = cookies.get(COOKIE)?.value;
  if (!key || !raw) return false;
  const [payload, sig] = raw.split('.');
  if (!payload || !sig || !same(sig, sign(payload, key))) return false;
  return Number(payload) > Date.now();
}
