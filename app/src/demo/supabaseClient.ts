/* Lazily-created Supabase browser client.
 *
 * Only instantiated when the demo backend is enabled (both env vars present).
 * The anon key is public-by-design and gated by Row-Level Security on the
 * server; no service-role/admin key is ever referenced here. */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, backendEnabled } from '../config/env';

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  if (!backendEnabled) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 2 } },
    });
  }
  return client;
}
