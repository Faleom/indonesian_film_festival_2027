/** Small admin actions from list pages: resend an order email, mark a message handled. */
import type { APIRoute } from 'astro';
import { isAdmin } from '../../../server/admin/auth';
import { sendOrderEmails } from '../../../server/orders';
import { markMessage } from '../../../server/admin/queries';
import { describeError, readBody, redirect, sameOrigin } from '../../../server/http';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdmin(cookies) || !sameOrigin(request)) return redirect('/admin/login');
  const body = await readBody(request);
  const back = (path: string, msg: string) => redirect(`${path}?msg=${encodeURIComponent(msg)}`);
  try {
    if (body.do === 'resend' && body.order) {
      await sendOrderEmails(body.order, { admins: false });
      return back('/admin/orders', 'Confirmation email sent again (see Emails for the result).');
    }
    if (body.do === 'message' && body.id) {
      await markMessage(body.id, body.handled === 'true');
      return back('/admin/messages', 'Updated.');
    }
    return back('/admin', 'Nothing to do.');
  } catch (err) {
    return back('/admin', describeError(err).message);
  }
};
