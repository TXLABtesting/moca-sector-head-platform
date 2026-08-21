-- ============================================================================
--  Demo database schema  —  Sector-Head Follow-up Platform (demo branch only)
-- ============================================================================
--  Run this once in the Supabase SQL editor of a project dedicated to the DEMO.
--  It is completely independent of the production (IT branch) database.
--
--  Design: the whole app state (AppData + users + change log) is one shared row
--  in `demo_state`, stored in JSONB columns whose shape is exactly the platform
--  data structure. This makes Office-Team edits and the Sector-Head view read
--  the SAME record, keeps every screen's existing workflow unchanged, and lets
--  Supabase Realtime push changes live to every client.
--
--  Security:
--   • Row-Level Security is ON for every table.
--   • The public anon key may SELECT and UPDATE the single shared row and INSERT
--     the one-time baseline, but may NEVER DELETE — so no anonymous user can wipe
--     the demo data.
--   • Restoring the sample data runs only through the passphrase-gated
--     SECURITY DEFINER function `reset_demo`.
-- ============================================================================

-- ---- live shared state -----------------------------------------------------
create table if not exists public.demo_state (
  id          text primary key default 'shared',
  data        jsonb not null default '{}'::jsonb,   -- AppData
  users       jsonb not null default '[]'::jsonb,   -- SeedUser[]
  change_log  jsonb not null default '[]'::jsonb,   -- ChangeLogEntry[]
  seq         integer not null default 1,           -- shared id counter
  updated_by  text,                                 -- client id (echo guard)
  updated_at  timestamptz not null default now()
);

-- ---- pristine baseline used by reset (written once by the first client) -----
create table if not exists public.demo_seed (
  id     text primary key default 'seed',
  data   jsonb not null,
  users  jsonb not null
);

-- ---- private config (reset passphrase) — never selectable by anon -----------
create table if not exists public.demo_config (
  key   text primary key,
  value text not null
);
-- Set your reset passphrase (must equal VITE_DEMO_RESET_PASSPHRASE in the app):
--   insert into public.demo_config(key, value) values ('reset_passphrase', 'CHANGE-ME')
--   on conflict (key) do update set value = excluded.value;

alter table public.demo_state  enable row level security;
alter table public.demo_seed   enable row level security;
alter table public.demo_config enable row level security;   -- no policies ⇒ anon has NO access

-- demo_state: read + update the shared row, insert it once; NEVER delete.
drop policy if exists demo_state_select on public.demo_state;
create policy demo_state_select on public.demo_state for select using (true);

drop policy if exists demo_state_insert on public.demo_state;
create policy demo_state_insert on public.demo_state for insert with check (id = 'shared');

drop policy if exists demo_state_update on public.demo_state;
create policy demo_state_update on public.demo_state for update using (id = 'shared') with check (id = 'shared');
-- (no DELETE policy ⇒ deletes are denied for everyone using the anon key)

-- demo_seed: readable; may be created once, but not overwritten or deleted.
drop policy if exists demo_seed_select on public.demo_seed;
create policy demo_seed_select on public.demo_seed for select using (true);

drop policy if exists demo_seed_insert on public.demo_seed;
create policy demo_seed_insert on public.demo_seed for insert with check (id = 'seed');

-- ---- reset function: restore sample data (passphrase-gated) -----------------
create or replace function public.reset_demo(passphrase text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  expected text;
begin
  select value into expected from public.demo_config where key = 'reset_passphrase';
  if expected is null or passphrase is distinct from expected then
    raise exception 'reset_demo: invalid passphrase';
  end if;

  update public.demo_state s
     set data       = seed.data,
         users      = seed.users,
         change_log = '[]'::jsonb,
         seq        = 1,
         updated_by = 'reset',
         updated_at = now()
    from public.demo_seed seed
   where s.id = 'shared' and seed.id = 'seed';
end;
$$;

revoke all on function public.reset_demo(text) from public;
grant execute on function public.reset_demo(text) to anon, authenticated;

-- ---- Realtime --------------------------------------------------------------
-- Idempotent: only add the table if it isn't already in the publication, so
-- re-running this whole script never errors (42710 "already member").
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'demo_state'
  ) then
    alter publication supabase_realtime add table public.demo_state;
  end if;
end $$;

-- ============================================================================
--  Storage bucket for demo file uploads (separate from production storage)
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('demo-uploads', 'demo-uploads', true)
on conflict (id) do nothing;

-- Public read; anon may upload; NO anon delete (prevents wiping uploads).
drop policy if exists demo_uploads_read on storage.objects;
create policy demo_uploads_read on storage.objects
  for select using (bucket_id = 'demo-uploads');

drop policy if exists demo_uploads_write on storage.objects;
create policy demo_uploads_write on storage.objects
  for insert with check (bucket_id = 'demo-uploads');
