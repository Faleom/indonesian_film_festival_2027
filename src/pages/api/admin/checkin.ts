/** Door check-in: { code, commit? } -> result. JSON only (the scanner page calls it). */
import type { APIRoute } from 'astro';
import { isAdmin } from '../../../server/admin/auth';
import { checkIn } from '../../../server/orders';
import { describeError, json, readBody, sameOrigin } from '../../../server/http';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdmin(cookies) || !sameOrigin(request)) return json({ ok: false, message: 'Not signed in' }, 401);
  const body = await readBody(request);
  try {
    return json({ ok: true, ...(await checkIn(body.code ?? '', { commit: body.commit !== 'false' })) });
  } catch (err) {
    const { message, status } = describeError(err);
    return json({ ok: false, message }, status);
  }
};
