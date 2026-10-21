// Creates / updates the database tables on every build (Vercel runs it before
// `astro build`), so nobody has to paste SQL into Supabase by hand.
//
// - Uses DATABASE_URL, or the URLs Vercel's Supabase integration adds
//   (POSTGRES_URL_NON_POOLING preferred for schema changes, else POSTGRES_URL).
// - No database configured (e.g. a laptop build): skips quietly.
// - Runs each drizzle/*.sql file once (recorded in iff_migrations). Statements
//   whose object already exists are skipped, so a database set up by hand
//   earlier is picked up safely.
// - A failure is logged but never fails the build: the site must still go live.
import fs from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';

const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
if (!raw) {
  console.log('[migrate] No database configured, skipping.');
  process.exit(0);
}

// Same clean-up as src/server/db/client.ts: drop extra params (supa=…), keep SSL.
function cleanUrl(input) {
  try {
    const u = new URL(input);
    const ssl = u.searchParams.get('sslmode');
    u.search = '';
    if (ssl) u.searchParams.set('sslmode', ssl);
    else if (!['localhost', '127.0.0.1'].includes(u.hostname)) u.searchParams.set('sslmode', 'require');
    return u.toString();
  } catch {
    return input;
  }
}

// Never let a stuck database hold up the deploy: give up after 60 s.
setTimeout(() => {
  console.warn('[migrate] Database did not answer within 60 s; skipping. The site still builds.');
  process.exit(0);
}, 60_000).unref();

// Postgres "already exists" errors: table/index (42P07), type/constraint (42710), column (42701), schema (42P06).
const ALREADY = new Set(['42P07', '42710', '42701', '42P06']);
const dir = path.join(process.cwd(), 'drizzle');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
const sql = postgres(cleanUrl(raw), { max: 1, prepare: false, connect_timeout: 15, onnotice: () => {} });

try {
  await sql`create table if not exists iff_migrations (name text primary key, applied_at timestamptz not null default now())`;
  await sql`alter table iff_migrations enable row level security`;
  const done = new Set((await sql`select name from iff_migrations`).map((r) => r.name));
  let applied = 0;
  for (const file of files) {
    if (done.has(file)) continue;
    const statements = fs
      .readFileSync(path.join(dir, file), 'utf8')
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);
    let skipped = 0;
    for (const statement of statements) {
      try {
        await sql.unsafe(statement);
      } catch (err) {
        if (!ALREADY.has(err.code)) throw Object.assign(err, { file });
        skipped++;
      }
    }
    await sql`insert into iff_migrations (name) values (${file})`;
    applied++;
    console.log(`[migrate] ${file}: done${skipped ? ` (${skipped} already existed)` : ''}`);
  }
  console.log(applied ? `[migrate] ${applied} migration(s) applied.` : '[migrate] Database is up to date.');
} catch (err) {
  console.warn(`[migrate] Could not update the database${err.file ? ` (${err.file})` : ''}: ${err.code ?? ''} ${err.message}`);
  console.warn('[migrate] The site still builds; admin and the shop will report the database problem.');
} finally {
  await sql.end({ timeout: 5 });
}
