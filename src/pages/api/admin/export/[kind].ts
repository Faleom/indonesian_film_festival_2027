/** CSV downloads for the committee: /api/admin/export/orders (tickets, submissions, subscribers, messages). */
import type { APIRoute } from 'astro';
import { isAdmin } from '../../../../server/admin/auth';
import { exportCsv } from '../../../../server/admin/queries';

export const prerender = false;

export const GET: APIRoute = async ({ params, cookies }) => {
  if (!isAdmin(cookies)) return new Response('Not signed in', { status: 401 });
  const kind = (params.kind ?? '').replace(/\.csv$/, '');
  const csv = await exportCsv(kind);
  if (csv === undefined) return new Response('Unknown export', { status: 404 });
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response('﻿' + csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="iff-${kind}-${stamp}.csv"`,
      'cache-control': 'no-store',
    },
  });
};
