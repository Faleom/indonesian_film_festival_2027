/**
 * Database connection (postgres.js + Drizzle). One small pool per serverless
 * instance; with Supabase use the connection pooler URI (port 6543).
 * Tests swap in an in-memory Postgres with setDb().
 */
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '../env';

export type Db = PostgresJsDatabase<typeof schema> | import('drizzle-orm/pglite').PgliteDatabase<typeof schema>;

let instance: Db | undefined;

/** The database, or undefined when DATABASE_URL isn't set. */
export function getDb(): Db | undefined {
  if (instance) return instance;
  const url = env.databaseUrl;
  if (!url) return undefined;
  // prepare: false — required by Supabase's transaction pooler.
  const client = postgres(cleanUrl(url), { max: 3, prepare: false, idle_timeout: 20 });
  instance = drizzle(client, { schema });
  return instance;
}

/** Same as getDb, but throws a clear error for routes that can't work without it. */
export function requireDb(): Db {
  const db = getDb();
  if (!db) throw new ServiceUnavailable('The database is not set up yet (DATABASE_URL).');
  return db;
}

/**
 * Keeps only the parts of the URL postgres.js understands. Vercel's Supabase
 * integration adds extra query parameters (e.g. supa=base-pooler.x) that
 * would be sent to the server as unknown startup settings.
 */
export function cleanUrl(raw: string): string {
  try {
    const u = new URL(raw);
    const ssl = u.searchParams.get('sslmode');
    u.search = '';
    if (ssl) u.searchParams.set('sslmode', ssl);
    else if (!['localhost', '127.0.0.1'].includes(u.hostname)) u.searchParams.set('sslmode', 'require');
    return u.toString();
  } catch {
    return raw;
  }
}

export function setDb(db: Db | undefined) {
  instance = db;
}

export class ServiceUnavailable extends Error {}
export { schema };
