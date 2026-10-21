/**
 * Server-side settings, read from environment variables (set them in Vercel →
 * Project → Settings → Environment Variables; locally in a `.env` file).
 * Every feature checks for its own variables and switches itself off cleanly
 * when they're missing, so the site always builds. See docs/SETUP-BACKEND.md.
 */
const read = (name: string): string | undefined => {
  const v = (typeof process !== 'undefined' ? process.env[name] : undefined) ?? (import.meta.env?.[name] as string | undefined);
  return v && v.trim() ? v.trim() : undefined;
};

export const env = {
  /**
   * Postgres connection string. DATABASE_URL if set, otherwise POSTGRES_URL,
   * which the Supabase integration in Vercel's marketplace adds by itself
   * (the pooler URI, port 6543).
   */
  get databaseUrl() {
    return read('DATABASE_URL') ?? read('POSTGRES_URL');
  },
  /** Stripe secret key (sk_test_… while testing, sk_live_… for real sales). */
  get stripeSecretKey() {
    return read('STRIPE_SECRET_KEY');
  },
  /** Signing secret of the Stripe webhook endpoint (whsec_…). */
  get stripeWebhookSecret() {
    return read('STRIPE_WEBHOOK_SECRET');
  },
  /** Resend API key (re_…). */
  get resendApiKey() {
    return read('RESEND_API_KEY');
  },
  /** Sender, e.g. "IFF 21 <tickets@your-domain>". The domain must be verified in Resend. */
  get emailFrom() {
    return read('EMAIL_FROM') ?? 'Indonesian Film Festival <onboarding@resend.dev>';
  },
  /** Optional reply-to for buyer emails (e.g. the committee inbox). */
  get emailReplyTo() {
    return read('EMAIL_REPLY_TO');
  },
  /** Committee addresses told about every purchase, submission and message (comma separated). */
  get adminNotifyEmails(): string[] {
    return (read('ADMIN_NOTIFY_EMAILS') ?? '')
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter((s) => /.+@.+\..+/.test(s));
  },
  /** The keyword that unlocks /admin. Admin is disabled until it's set (min 12 characters). */
  get adminKey() {
    const k = read('ADMIN_KEY');
    return k && k.length >= 12 ? k : undefined;
  },
  /** Public URL of the site, for links in emails and Stripe redirects. */
  get siteUrl() {
    const vercel = read('VERCEL_PROJECT_PRODUCTION_URL');
    return (read('SITE_URL') ?? (vercel ? `https://${vercel}` : 'http://localhost:4321')).replace(/\/$/, '');
  },
};

export const features = {
  get db() {
    return !!env.databaseUrl;
  },
  get payments() {
    return !!env.databaseUrl && !!env.stripeSecretKey;
  },
  get email() {
    return !!env.resendApiKey;
  },
  get admin() {
    return !!env.adminKey && !!env.databaseUrl;
  },
};
