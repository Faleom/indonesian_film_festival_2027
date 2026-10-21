import type { APIRoute } from 'astro';
import { keyMatches, startSession } from '../../../server/admin/auth';
import { rateLimited, readBody, redirect, sameOrigin } from '../../../server/http';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, url }) => {
  if (!sameOrigin(request)) return redirect('/admin/login?error=1');
  // Slow down guessing.
  if (rateLimited(request, 'admin-login', 8, 15 * 60_000)) return redirect('/admin/login?error=wait');
  const body = await readBody(request);
  if (!keyMatches(body.key ?? '')) {
    await new Promise((r) => setTimeout(r, 600));
    return redirect('/admin/login?error=1');
  }
  startSession(cookies, url.protocol === 'https:');
  return redirect('/admin');
};
