# Sector Head Follow-up Platform — API (server)

NestJS + TypeScript + PostgreSQL backend for the MOCA Sector Head Follow-up
Platform. Authentication is **Microsoft Entra ID (Azure AD)** via OpenID
Connect — there are **no local passwords**.

> This is the `it` (production) build. The `demo` branch is a separate,
> client-only static build with fake logins for walkthroughs; none of that code
> exists here.

## Layout

```
server/
├── src/
│   ├── main.ts                 # bootstrap: /api prefix, CORS, Swagger, pino
│   ├── app.module.ts           # config + TypeORM + feature modules
│   ├── config/                 # typed env configuration
│   ├── rbac/permissions.ts     # RBAC model (mirrors the frontend)
│   ├── common/
│   │   ├── guards/             # JwtAuthGuard (Entra) + RbacGuard (grants)
│   │   └── decorators/         # @Public, @CurrentUser, @RequirePermission
│   ├── auth/                   # Entra JWT strategy + /api/v1/auth/me
│   ├── users/                  # user + permission administration
│   ├── projects/               # reference resource (CRUD + approval flow)
│   ├── health/                 # /api/health probe (public)
│   └── database/               # DataSource, migrations, role seed
└── db/schema.sql               # authoritative full-model DDL (all collections)
```

`projects` is the **reference implementation**: every other collection
(meetings, minute-tasks, committees, correspondence, office-tasks, reg-reports,
fin-models, audit-reports, ret-reports, leaves, …) follows the same
Controller → Service → Repository + `@RequirePermission(section, action)`
pattern. Their tables already exist in `db/schema.sql`; add a module per
collection as they are wired up.

## Security model

1. **Authentication** — `JwtAuthGuard` (global) validates every request's Entra
   bearer token: signature via tenant JWKS, `iss`/`aud` pinned, expiry checked.
   The token `oid` is resolved to a provisioned `users` row; unknown or
   deactivated identities are rejected (closed by default).
2. **Authorization** — `RbacGuard` (global) enforces the route's
   `@RequirePermission(section, action)` against the user's grant letters.
   `approve` is hard-restricted to the Sector Head on projects / leaves /
   meeting requests — documents are view-only.
3. **Row scoping** — services additionally filter by `unit` for
   department-scoped (`sector`) users.

The frontend enforces the same model for UX; the API re-enforces it
authoritatively so a crafted request cannot bypass the UI.

## Local development

```bash
cp .env.example .env            # fill DB_* and ENTRA_* (see the runbook)
npm install
# bring up Postgres (or use infra/docker-compose.yml)
npm run migration:run           # apply db/schema.sql
npm run seed                    # provision org users + grants (Entra oids blank)
npm run start:dev               # http://localhost:3000/api ; docs at /api/docs
```

Or run the whole stack (db + api + web + adminer):

```bash
docker compose -f ../infra/docker-compose.yml up --build
```

## Environment variables

See `.env.example` for the full catalogue. The essential groups are:
`DB_*` (PostgreSQL), `ENTRA_*` (tenant/client/audience/issuer/JWKS), and
`BLOB_*` (attachment storage). Secrets come from **Azure Key Vault** in
production — never commit `.env`.

## Migrations

- `npm run migration:run` — apply pending migrations (initial one runs
  `db/schema.sql`).
- `npm run migration:generate -- src/database/migrations/<Name>` — diff entities
  → new migration.
- `npm run migration:revert` — roll back the last migration.

See `../docs/04-deployment-runbook.md` for the full production procedure and the
Entra app-registration checklist.
