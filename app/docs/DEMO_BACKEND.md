# Demo Database Environment (demo branch)

A shared, persistent, realtime backend for the **demo** branch so testers can
add / edit / upload / update data that survives refresh and is visible to every
user — kept **completely separate** from production.

---

## 1. Selected database solution — **Supabase**

Chosen over Firebase because it matches the existing stack and requirements:

| Reason | Detail |
|---|---|
| Same engine as production | The production (IT) branch is **NestJS + PostgreSQL**. Supabase is managed Postgres, so the demo schema and SQL match production concepts 1:1. |
| Works from static GitHub Pages | The demo is a static SPA. Supabase's browser client + **public anon key + Row-Level Security** is safe to ship in the frontend — no server needed. |
| Realtime | Postgres change-streams push Office-Team edits into the Sector-Head view live. |
| Storage buckets | Built-in object storage for file uploads, separate from the DB and from production. |
| Reset & security | SQL `SECURITY DEFINER` function for admin reset; RLS to block anonymous mass-deletes. |

The app **degrades gracefully**: with no env vars it uses browser-local storage
(the original single-browser demo), so dev and CI never break.

---

## 2. Environment variables (never hardcoded)

Set in `.env.local` for dev, and in the build environment for the hosted deploy.
See `.env.example`.

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Demo project URL. |
| `VITE_SUPABASE_ANON_KEY` | **Public** anon key (safe in frontend; RLS-protected). Never a service-role key. |
| `VITE_DEMO_BUCKET` | Storage bucket for uploads (default `demo-uploads`). |
| `VITE_DEMO_RESET_PASSPHRASE` | Must equal `demo_config.reset_passphrase` in the DB; gates admin reset. |
| `VITE_DEMO` | Show the “Demo Environment” banner (default `true`; set `false` in production). |

Both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` must be present for the
shared database to activate.

**Environment split (requirement 8):**
- **demo branch** → build with the demo Supabase URL/key + `demo-uploads` bucket.
- **production branch** → build **without** these vars (or with its own production
  config) and `VITE_DEMO=false`. Production data is never referenced by the demo.

---

## 3. Database tables created (`supabase/schema.sql`)

| Table | Role |
|---|---|
| `demo_state` | The single shared row (`id='shared'`) holding the whole app state in JSONB columns `data` (AppData), `users`, `change_log`, plus `seq`. Its JSONB shape **is** the platform data structure, so every module — Projects, Meetings, Minutes, Tasks, Committees, Reports, Correspondence, Leaves, Notifications — reads/writes the same record. |
| `demo_seed` | Immutable pristine sample data, written once, used by reset. |
| `demo_config` | Private key/value (the reset passphrase). RLS gives anon **no** access. |

Plus RPC **`reset_demo(passphrase)`** and Realtime enabled on `demo_state`.

> Why one JSONB document instead of 15 relational tables? It keeps every screen's
> existing `mutate((d) => …)` workflow **unchanged** (requirement: keep UI/workflows
> as-is) while still giving shared, durable, realtime, RLS-protected storage. The
> full relational model already lives in the IT branch for production.

**RLS (requirement 12 — no anonymous wipe):** anon may `SELECT` + `UPDATE` the
shared row and `INSERT` the one-time baseline, but there is **no DELETE policy**,
so deletes are denied. `demo_config` is unreadable by anon. Resets run only
through the passphrase-gated function.

---

## 4. Storage configuration (requirement 7)

- Bucket **`demo-uploads`** (public read), created by the schema.
- `FileUploadField` uploads picked files to this bucket and stores the returned
  public URL on the record (durable + shareable). Anon may upload; anon **cannot
  delete** (no delete policy). Uploads live in the bucket, never in the repo.

---

## 5. How to reset the demo data (requirement 11)

An admin (Sector Head / System Admin) opens **Settings → “Reset demo data”**,
confirms, and:
- **Backend on:** calls `reset_demo(passphrase)` → copies `demo_seed` → `demo_state`,
  clears the change log; Realtime pushes the fresh sample data to **every** client.
- **Backend off:** restores the original sample data in the current browser.

The passphrase (`VITE_DEMO_RESET_PASSPHRASE`) must match `demo_config.reset_passphrase`.

---

## 6. One-time setup

1. Create a **new** Supabase project dedicated to the demo (not production).
2. SQL editor → paste & run `supabase/schema.sql`.
3. Set the reset passphrase:
   ```sql
   insert into public.demo_config(key, value)
   values ('reset_passphrase', 'YOUR-PASSPHRASE')
   on conflict (key) do update set value = excluded.value;
   ```
4. Copy the project **URL** and **anon public key** into the demo build env
   (`.env.local` locally, or the deploy env for Pages).
5. Build & deploy the demo. On first load the app writes the sample data into
   `demo_state` and `demo_seed`.

---

## 7. Separation of demo vs production (requirement 2, 8)

- Demo uses its **own Supabase project** (own DB + own `demo-uploads` bucket).
- Production is a **separate** NestJS + Postgres backend (IT branch) with its own
  config; the demo never references production URLs, keys, files, or the repo as
  a writable store.
- Credentials come only from env vars; `.env*` is git-ignored; no service-role
  key is ever in the frontend.

---

## 8. CI/CD — automatic build & deploy (`.github/workflows/deploy-demo.yml`)

Every push to the **`demo`** branch (or a manual *Run workflow*) builds the app
with the demo configuration and publishes it to the `gh-pages` branch that
GitHub Pages already serves. Production branches are never built by this
workflow.

**Where to add the secrets:** repo → **Settings → Secrets and variables →
Actions → New repository secret**.

| Secret | Required? | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | **Required** | Demo project URL. |
| `VITE_SUPABASE_ANON_KEY` | **Required** | Public anon key (RLS-protected). |
| `VITE_DEMO_RESET_PASSPHRASE` | **Required** | Must equal `demo_config.reset_passphrase`. |
| `VITE_DEMO_BUCKET` | Optional | Defaults to `demo-uploads` if unset. |

If any **required** secret is missing, the workflow **stops at the Preflight
step with a clear error** listing exactly which secrets are absent — nothing is
built or deployed. Secrets are never printed or committed; the anon key is
public-by-design and injected only at build time. Deployment uses the built-in
`GITHUB_TOKEN` (no personal token, no credentials in the repo).

---

## 9. Test checklist (requirement 15)

Run against the live demo project after setup:

- [ ] **Create** — add a project/meeting/committee/report/correspondence/leave → row appears for all clients.
- [ ] **Read** — refresh / reopen → data persists.
- [ ] **Update** — Office Team edits a record → Sector Head sees the change live.
- [ ] **Delete** — remove an item in-app (allowed via UPDATE of the shared doc); a raw anon `DELETE` on `demo_state` is **rejected** by RLS.
- [ ] **Upload** — attach a file → stored in `demo-uploads`, link opens.
- [ ] **Reset** — admin reset restores sample data for everyone.

> Note: CRUD/upload against a *live* Supabase project can only be exercised once
> the project exists and its two env vars are supplied. The app was verified to
> build, type-check, and run in fallback mode with no regressions; the backend
> path activates automatically when the vars are present.
