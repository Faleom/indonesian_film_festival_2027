import type { APIRoute } from 'astro';
import { subscribe } from '../../server/forms';
import { describeError, formReply, isBot, rateLimited, readBody, sameOrigin } from '../../server/http';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const body = await readBody(request);
  if (!sameOrigin(request) || isBot(body)) return formReply(request, 'newsletter', { ok: true, message: "You're on the list!" });
  if (rateLimited(request, 'newsletter', 8)) return formReply(request, 'newsletter', { ok: false, message: 'Too many attempts. Please wait a few minutes.' }, 429);
  try {
    const result = await subscribe(body);
    return formReply(request, 'newsletter', { ok: true, message: result === 'already' ? "You're already on the list. See you soon!" : "You're on the list! Check your inbox." });
  } catch (err) {
    const { message, status } = describeError(err);
    return formReply(request, 'newsletter', { ok: false, message }, status);
  }
};
