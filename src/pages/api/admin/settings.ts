/** Admin switches: tickets on/off per event, merch on/off, SFC window mode. */
import type { APIRoute } from 'astro';
import { isAdmin } from '../../../server/admin/auth';
import { setSiteSetting, setTicketsOnSale } from '../../../server/settings';
import { ticketEvents } from '../../../server/catalog';
import { describeError, readBody, redirect, sameOrigin } from '../../../server/http';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdmin(cookies) || !sameOrigin(request)) return redirect('/admin/login');
  const body = await readBody(request);
  const back = (msg: string) => redirect(`/admin/settings?msg=${encodeURIComponent(msg)}`);
  try {
    if (body.what === 'tickets') {
      const ev = ticketEvents.find((e) => e.eventId === body.event);
      if (!ev) return back('Unknown event');
      const value = body.value === 'on' ? true : body.value === 'off' ? false : null;
      await setTicketsOnSale(ev.eventId, value);
      return back(`${ev.eventName}: tickets ${value === null ? 'back to the default' : value ? 'ON sale' : 'OFF sale'}`);
    }
    if (body.what === 'merch') {
      await setSiteSetting('merch_on_sale', body.value === 'on' ? true : body.value === 'off' ? false : null);
      return back(`Merch shop ${body.value === 'on' ? 'open' : body.value === 'off' ? 'closed' : 'back to the default'}`);
    }
    if (body.what === 'sfc') {
      const mode = ['open', 'closed'].includes(body.value) ? body.value : null;
      await setSiteSetting('sfc_mode', mode);
      return back(`SFC submissions: ${mode ?? 'automatic (by dates)'}`);
    }
    return back('Nothing changed');
  } catch (err) {
    return back(describeError(err).message);
  }
};
