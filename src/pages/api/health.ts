/**
 * Setup check: which features are configured and whether the database answers.
 * Shows no secrets (no passwords or keys, only the database host). Useful when
 * something "just keeps loading": open /api/health.
 */
import type { APIRoute } from 'astro';
import { sql } from 'drizzle-orm';
import { describeDatabase, getDb, withTimeout } from '../../server/db/client';
import { env, features } from '../../server/env';

export const prerender = false;

export const GET: APIRoute = async () => {
  const db = describeDatabase();
  const result: Record<string, unknown> = {
    region: process.env.VERCEL_REGION ?? null,
    deployment: process.env.VERCEL_ENV ?? 'local',
    database: { ...db, ok: false as boolean, ms: null as number | null, tables: null as number | null, error: null as string | null },
    stripe: features.payments ? (env.stripeSecretKey!.startsWith('sk_live') ? 'live' : 'test') : false,
    webhookSecret: !!env.stripeWebhookSecret,
    email: features.email,
    adminNotify: env.adminNotifyEmails.length,
    admin: !!env.adminKey,
    siteUrl: env.siteUrl,
  };
  const conn = getDb();
  if (conn) {
    const t0 = Date.now();
    try {
      const rows = await withTimeout(conn.execute(sql`select count(*)::int as n from information_schema.tables where table_schema = 'public'`), 8000);
      const list = (Array.isArray(rows) ? rows : (rows as { rows: unknown[] }).rows) as { n: number }[];
      Object.assign(result.database as object, { ok: true, tables: list[0]?.n ?? null });
    } catch (err) {
      const e = err as { code?: string; message?: string };
      (result.database as { error: string }).error = [e.code, e.message].filter(Boolean).join(': ');
    }
    (result.database as { ms: number }).ms = Date.now() - t0;
  }
  return new Response(JSON.stringify(result, null, 2), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
};
