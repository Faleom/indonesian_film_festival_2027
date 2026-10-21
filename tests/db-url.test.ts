import { describe, expect, it } from 'vitest';
import { cleanUrl } from '../src/server/db/client';

describe('database URL', () => {
  it('drops the extra parameters Vercel’s Supabase integration adds, keeps SSL', () => {
    const url = cleanUrl('postgres://postgres.abc:pw@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x');
    expect(url).toBe('postgres://postgres.abc:pw@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres?sslmode=require');
  });
  it('requires SSL for remote hosts, not for localhost', () => {
    expect(cleanUrl('postgres://u:p@db.example.com:5432/x')).toContain('sslmode=require');
    expect(cleanUrl('postgres://u@127.0.0.1:5432/x')).not.toContain('sslmode');
  });
});
