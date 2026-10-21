import type { APIRoute } from 'astro';
import { endSession } from '../../../server/admin/auth';
import { redirect } from '../../../server/http';

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  endSession(cookies);
  return redirect('/');
};
