/* Environment configuration — the ONLY place that reads import.meta.env.
 *
 * Credentials are NEVER hardcoded. They come from Vite env vars, which are
 * injected at build time from the deploy environment (GitHub Actions secrets
 * for the hosted demo, a local .env for development — see .env.example).
 *
 * The Supabase anon key is a PUBLIC key by design: it is safe to ship in the
 * frontend because every table is protected by Row-Level Security (see
 * supabase/schema.sql). It is NOT a service-role/admin key — those must never
 * appear in the frontend.
 *
 * When the Supabase vars are absent, the app falls back to browser-local
 * storage (the original single-browser demo). This keeps development and CI
 * builds working without any backend, and lets the hosted demo light up the
 * shared database the moment the two env vars are provided. */

const env = import.meta.env as Record<string, string | undefined>;

export const SUPABASE_URL = (env.VITE_SUPABASE_URL || '').trim();
export const SUPABASE_ANON_KEY = (env.VITE_SUPABASE_ANON_KEY || '').trim();

/** The shared-database demo backend is active only when both vars are set. */
export const backendEnabled = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

/** Storage bucket that holds demo file uploads (kept separate from production). */
export const DEMO_BUCKET = (env.VITE_DEMO_BUCKET || 'demo-uploads').trim();

/** A label the reset RPC checks so anonymous users can't wipe data casually. */
export const DEMO_RESET_PASSPHRASE = (env.VITE_DEMO_RESET_PASSPHRASE || '').trim();

/** Force the "Demo Environment" banner even without a backend (e.g. Pages). */
export const isDemoEnv =
  backendEnabled || String(env.VITE_DEMO ?? 'true').toLowerCase() !== 'false';
