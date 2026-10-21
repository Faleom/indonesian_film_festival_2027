/** Anonymous page view counter: one row per day and path, no cookies, no IPs stored. */
import { sql } from 'drizzle-orm';
import { requireDb } from './db/client';
import { pageViews } from './db/schema';
import { melbourneToday } from './catalog';

export async function countView(path: string) {
  // Keep paths tidy and bounded: no query strings, no admin, no junk.
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  if (clean.length > 120 || !/^\/[\w\-/.]*$/.test(clean) || clean.startsWith('/admin') || clean.startsWith('/api') || clean.startsWith('/order/')) return;
  await requireDb()
    .insert(pageViews)
    .values({ day: melbourneToday(), path: clean, views: 1 })
    .onConflictDoUpdate({ target: [pageViews.day, pageViews.path], set: { views: sql`${pageViews.views} + 1` } });
}
