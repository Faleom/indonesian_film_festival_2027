import { defineConfig } from 'drizzle-kit';

// `npm run db:generate` writes SQL migrations to /drizzle from the schema;
// `npm run db:migrate` applies them to DATABASE_URL (or POSTGRES_URL_NON_POOLING from Vercel's Supabase integration).
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL ?? '' },
});
