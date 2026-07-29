/* Demo backend adapter — a shared, persistent, realtime-synced document store.
 *
 * The entire app state (AppData + users + changeLog) lives as ONE row in the
 * `demo_state` table (id = 'shared'), stored in typed JSONB columns whose shape
 * is exactly the platform's data structure. This keeps every screen's existing
 * `mutate((d) => ...)` workflow unchanged while making the data:
 *   • shared   — Office-Team edits and Sector-Head views read the SAME record;
 *   • durable  — survives refresh / re-open (persisted server-side, not in the
 *                browser and never in a GitHub JSON file);
 *   • live     — Realtime pushes remote changes to every open client.
 *
 * When the backend is disabled (no env vars) every function is a safe no-op and
 * the app keeps using its browser-local store. */
import type { AppData } from '../data/types';
import type { SeedUser } from '../domain/permissions';
import type { ChangeLogEntry } from '../store/store';
import { supabase } from './supabaseClient';
import { backendEnabled, DEMO_BUCKET, DEMO_RESET_PASSPHRASE } from '../config/env';

export interface DemoState {
  data: AppData;
  users: SeedUser[];
  changeLog: ChangeLogEntry[];
  seq?: number;
}

const ROW_ID = 'shared';

/** A per-tab id so a client can ignore the Realtime echo of its own writes. */
const clientId =
  (globalThis.crypto?.randomUUID?.() ?? 'c' + Math.abs(hashNow()).toString(36));

function hashNow(): number {
  // Date.now() is unavailable in some sandboxes; performance.now is fine here.
  const n = typeof performance !== 'undefined' ? performance.now() : 1;
  return Math.floor(n * 1000) ^ (globalThis.history?.length ?? 0);
}

export { backendEnabled };

/** Load the shared demo state, or null if none exists yet / backend disabled. */
export async function loadState(): Promise<DemoState | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from('demo_state')
    .select('data, users, change_log, seq')
    .eq('id', ROW_ID)
    .maybeSingle();
  if (error) { console.warn('[demo] loadState failed:', error.message); return null; }
  if (!data) return null;
  return {
    data: data.data as AppData,
    users: (data.users as SeedUser[]) || [],
    changeLog: (data.change_log as ChangeLogEntry[]) || [],
    seq: (data.seq as number) ?? 1,
  };
}

/** Write the pristine baseline used by reset — once, if it doesn't exist yet.
 *  RLS allows INSERT but not UPDATE of `demo_seed`, so the first client fixes
 *  the sample data and later clients can't overwrite it. */
export async function seedBaselineIfEmpty(state: DemoState): Promise<void> {
  const sb = supabase();
  if (!sb) return;
  const { data } = await sb.from('demo_seed').select('id').eq('id', 'seed').maybeSingle();
  if (!data) await sb.from('demo_seed').insert({ id: 'seed', data: state.data, users: state.users });
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pending: DemoState | null = null;

/** Debounced upsert — coalesces rapid edits into one write (~600ms). */
export function saveState(state: DemoState): void {
  if (!backendEnabled) return;
  pending = state;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 600);
}

async function flush(): Promise<void> {
  const sb = supabase();
  if (!sb || !pending) return;
  const s = pending; pending = null; saveTimer = null;
  const { error } = await sb.from('demo_state').upsert({
    id: ROW_ID,
    data: s.data,
    users: s.users,
    change_log: s.changeLog,
    seq: s.seq ?? 1,
    updated_by: clientId,
  });
  if (error) console.warn('[demo] saveState failed:', error.message);
}

/** Subscribe to remote changes; the callback fires for writes made by OTHER
 *  clients (our own echoes are filtered out via updated_by). Returns an
 *  unsubscribe function. */
export function subscribe(cb: (state: DemoState) => void): () => void {
  const sb = supabase();
  if (!sb) return () => {};
  const channel = sb
    .channel('demo_state_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'demo_state', filter: `id=eq.${ROW_ID}` },
      (payload) => {
        const row = payload.new as Record<string, unknown> | undefined;
        if (!row || row.updated_by === clientId) return; // ignore our own echo
        cb({
          data: row.data as AppData,
          users: (row.users as SeedUser[]) || [],
          changeLog: (row.change_log as ChangeLogEntry[]) || [],
          seq: (row.seq as number) ?? 1,
        });
      }
    )
    .subscribe();
  return () => { sb.removeChannel(channel); };
}

/** Admin-only: restore the demo database to its original sample data.
 *  Runs a SECURITY DEFINER RPC gated by a passphrase so anonymous users can't
 *  wipe the database. Realtime then pushes the fresh seed to every client. */
export async function resetDemo(): Promise<{ ok: boolean; error?: string }> {
  const sb = supabase();
  if (!sb) return { ok: false, error: 'backend disabled' };
  const { error } = await sb.rpc('reset_demo', { passphrase: DEMO_RESET_PASSPHRASE });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Upload a file to the demo storage bucket; returns a stable public URL that
 *  the record stores in place of the bare file name. Bucket is separate from
 *  production and user uploads are never committed to the repo. */
export async function uploadFile(file: File): Promise<string | null> {
  const sb = supabase();
  if (!sb) return null;
  const safe = file.name.replace(/[^\w.\-؀-ۿ]+/g, '_');
  const path = `${clientId}/${hashNow().toString(36)}_${safe}`;
  const { error } = await sb.storage.from(DEMO_BUCKET).upload(path, file, { upsert: true });
  if (error) { console.warn('[demo] uploadFile failed:', error.message); return null; }
  const { data } = sb.storage.from(DEMO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
