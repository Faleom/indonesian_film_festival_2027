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
  // connect_timeout: fail fast with an error instead of leaving a page loading forever.
  const client = postgres(cleanUrl(url), { max: 3, prepare: false, idle_timeout: 20, connect_timeout: 10 });
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

/** Rejects if `p` takes longer than `ms`: a slow database must never hang a page. */
export function withTimeout<T>(p: Promise<T>, ms = 8000, what = 'Database'): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    p.finally(() => clearTimeout(timer)),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error(`${what} did not answer within ${ms / 1000}s`), { code: 'TIMEOUT' })), ms);
    }),
  ]);
}

/** Where the connection string comes from and where it points (never the password). */
export function describeDatabase() {
  const source = process.env.DATABASE_URL?.trim() ? 'DATABASE_URL' : process.env.POSTGRES_URL?.trim() ? 'POSTGRES_URL' : null;
  const url = env.databaseUrl;
  let target: string | null = null;
  try {
    if (url) {
      const u = new URL(cleanUrl(url));
      target = `${u.protocol}//${u.username ? `${u.username.replace(/(.{12}).+/, '$1…')}@` : ''}${u.hostname}:${u.port || 5432}${u.pathname}${u.search}`;
    }
  } catch {
    target = 'unparseable';
  }
  return { source, target };
}
