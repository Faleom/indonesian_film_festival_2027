import type { APIRoute } from 'astro';
import { submitContact } from '../../server/forms';
import { describeError, formReply, isBot, rateLimited, readBody, sameOrigin } from '../../server/http';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const body = await readBody(request);
  if (!sameOrigin(request) || isBot(body)) return formReply(request, 'contact', { ok: true, message: 'Thanks!' });
  if (rateLimited(request, 'contact', 5)) return formReply(request, 'contact', { ok: false, message: 'Too many messages. Please wait a few minutes or email us.' }, 429);
  try {
    await submitContact(body);
    return formReply(request, 'contact', { ok: true, message: "Thanks! We've got your message and emailed you a copy." });
  } catch (err) {
    const { message, status } = describeError(err);
    return formReply(request, 'contact', { ok: false, message }, status);
  }
};
