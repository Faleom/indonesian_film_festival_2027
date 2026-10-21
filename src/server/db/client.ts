/**
 * Database connection (node-postgres pool + Drizzle). On Vercel, functions are
 * frozen between requests; a connection left open across a freeze dies
 * silently and the next query on it hangs. attachDatabasePool (Vercel's
 * helper for `pg`) keeps the function alive just long enough to close idle
 * connections first, and the timeouts below turn any remaining stall into an
 * error instead of a page that loads forever.
 * With Supabase use the transaction pooler URI (port 6543); `pg` doesn't use
 * named prepared statements, which that pooler doesn't support.
 * Tests swap in an in-memory Postgres with setDb().
 */
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { attachDatabasePool } from '@vercel/functions';
import * as schema from './schema';
import { env } from '../env';

export type Db = NodePgDatabase<typeof schema> | import('drizzle-orm/pglite').PgliteDatabase<typeof schema>;

let instance: Db | undefined;

/** The database, or undefined when no connection string is set. */
export function getDb(): Db | undefined {
  if (instance) return instance;
  const url = env.databaseUrl;
  if (!url) return undefined;
  const clean = new URL(cleanUrl(url));
  const local = ['localhost', '127.0.0.1'].includes(clean.hostname);
  clean.searchParams.delete('sslmode'); // TLS is set below
  const pool = new pg.Pool({
    connectionString: clean.toString(),
    // Supabase's pooler certificate isn't from a public CA; the connection is still encrypted.
    ssl: local ? false : { rejectUnauthorized: false },
    max: 3,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 8_000,
    query_timeout: 10_000,
    keepAlive: true,
  });
  pool.on('error', (err) => console.error('[db] idle connection error', err.message));
  try {
    attachDatabasePool(pool);
  } catch {
    // Not on Vercel (local dev): nothing to attach to.
  }
  instance = drizzle(pool, { schema });
  return instance;
}

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
