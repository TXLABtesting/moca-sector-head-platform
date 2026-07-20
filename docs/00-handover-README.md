# IT Handover — Sector Head Follow-up Platform (منصة متابعة رئيس القطاع)

**Owner:** Ministry of Cabinet Affairs (MOCA), UAE — Central Services Sector
**Audience:** MOCA internal IT / DevOps / Infrastructure team
**Branch documented:** `it` (production build — real backend + Microsoft Entra SSO)
**Last updated:** 2026-07-20

---

## 1. What this system is

The **Sector Head Follow-up Platform** is a bilingual (Arabic RTL-first / English)
web platform that lets the **Sector Head (رئيس القطاع)**, their **office team**, and
**department managers** track and follow up on the sector's operational work in one place:

- **Projects** — with tasks, timeline/Gantt, directives, deadline-extension and
  completion-approval workflows, risks, phases, and attachments.
- **Meetings & minutes (المحاضر)** — attendees, decisions, action items, and
  **minute-tasks (مهام المحاضر)**.
- **Committees & work teams (اللجان)** — meetings, tasks, decisions, scores.
- **Correspondence (الصادر والوارد)** — outgoing/incoming document register.
- **Office tasks (مهام المكتب)** — kanban / timeline / table.
- **Report Center** — regulatory report log, financial reports, follow-up/audit
  reports (Audit Office), and retained-payments (المبالغ المحتجزة) reports.
- **Team leave planning (تخطيط الإجازات)** — conflict-aware timeline.
- **Permissions admin** and an **Executive Assistant** panel.

### Approval philosophy (important)

Only **three** things carry an approval (اعتماد/إرجاع) workflow:

| Approvable | Approver |
|---|---|
| Projects (completion / deadline extension) | Sector Head only |
| Team leaves | Sector Head only |
| Meeting requests (طلبات الاجتماعات) | Sector Head only |

**All documents and reports are view-only (اطلاع) for the Sector Head** — there is
**no** document approval queue. The office team enters data; the Sector Head views,
notes, directs, and approves only the three item types above. See
[`03-roles-and-responsibilities.md`](./03-roles-and-responsibilities.md).

---

## 2. Repository layout (target production monorepo)

The `it` branch delivers the existing SPA plus the production backend and infra. Target
layout:

```
repo/
├─ app/          Frontend — Vite + React 18 + TypeScript SPA (exists today)
│  ├─ src/
│  │  ├─ data/       types.ts (domain model) + seed.ts (real MOCA content)
│  │  ├─ domain/     permissions.ts, approval.ts, workflow.ts
│  │  ├─ i18n/       AR/EN context
│  │  ├─ store/      client state + API client
│  │  ├─ screens/    one component per screen
│  │  ├─ layout/     Shell, Sidebar, Header, Router
│  │  └─ components/ shared UI primitives
│  └─ package.json
├─ server/       Backend — Node.js + NestJS (TypeScript) REST API   [to be added on it]
│  ├─ src/
│  │  ├─ auth/        Entra OIDC + JWT guard + RBAC guard
│  │  ├─ modules/     one module per domain entity (controller/service/entity)
│  │  ├─ common/      pino logger, request-id, health
│  │  └─ main.ts      bootstraps Nest + Swagger at /api/docs
│  └─ package.json
├─ db/           PostgreSQL schema + TypeORM migrations + seed             [to be added]
├─ infra/        Docker, docker-compose, nginx, Azure IaC / manifests     [to be added]
├─ docs/         This handover documentation
└─ README.md
```

> The frontend (`app/`) already exists and is production-grade. The `server/`, `db/`,
> and `infra/` folders describe the target production shape this handover specifies; if
> they are not yet present on the `it` branch, this document set is the build spec.

---

## 3. How the `demo` and `it` branches differ

| Aspect | `demo` branch | `it` branch (this handover) |
|---|---|---|
| Hosting | GitHub Pages / static SPA only | Azure (AKS or App Service) behind nginx |
| Backend | **None** — data lives in the browser | **NestJS REST API** under `/api` |
| Data store | `localStorage` (`moca.platform`) via zustand `persist` | **PostgreSQL 16** via TypeORM |
| Auth | Fake logins / role switcher, no passwords | **Microsoft Entra ID** (OIDC Auth-Code + PKCE), JWT validated via JWKS |
| Attachments | Inlined / mock | **Azure Blob Storage** (keys/URLs in DB) |
| Seed data | Bundled in `seed.ts` | Migrated into Postgres; identity from Entra `oid` |
| Purpose | Client demo / design walkthrough | Government production deployment |

The **UI, screens, and permission model are identical** across branches — the `it`
branch swaps the in-browser data layer for real API calls and swaps the fake role
switcher for Entra SSO. Roles/permissions remain keyed by the same section/action model
(see doc 03), now stored server-side and bound to each user's Entra object id (`oid`).

---

## 4. Quick start (local, via Docker)

```bash
git clone <repo-url> && cd repo && git checkout it
cp infra/.env.example .env          # fill in the Entra + DB + Blob values (doc 04)
docker compose -f infra/docker-compose.yml up -d --build
docker compose exec api npm run migration:run   # create schema
# web  → http://localhost:8080   (nginx serves SPA, proxies /api)
# api  → http://localhost:3000/api/health
# docs → http://localhost:3000/api/docs   (Swagger)
# db   → Adminer at http://localhost:8081
```

Full environment-variable list, Azure deployment, migrations, backups, and rollback are
in [`04-deployment-runbook.md`](./04-deployment-runbook.md).

---

## 5. Documentation index

| # | File | Contents |
|---|---|---|
| 00 | [`00-handover-README.md`](./00-handover-README.md) | This overview + handover checklist |
| 01 | [`01-architecture.md`](./01-architecture.md) | System architecture, components, tech stack, environments, scaling |
| 02 | [`02-data-flow.md`](./02-data-flow.md) | Sequence diagrams: SSO login, API read, project approval, file upload |
| 03 | [`03-roles-and-responsibilities.md`](./03-roles-and-responsibilities.md) | RBAC model, per-user permission matrix, RACI, sysadmin duties |
| 04 | [`04-deployment-runbook.md`](./04-deployment-runbook.md) | Env vars, docker-compose, migrations, Azure deploy, backups, Entra checklist |

---

## 6. IT handover checklist

Work top-to-bottom; each item has an owner and a done box.

### 6.1 Identity & access (Microsoft Entra ID)

- [ ] Register the **SPA app** (public client, Auth-Code + PKCE) in the MOCA tenant.
- [ ] Register the **API app** (protected resource) and expose an API scope (e.g. `access_as_user`).
- [ ] Configure **redirect URIs** for dev / staging / prod (doc 04 §Entra checklist).
- [ ] Define **app roles** (`chair`, `office`, `sector`, `sysadmin`) or map via DB — decide policy.
- [ ] Grant **admin consent** for the API scope and required Graph permissions (`openid profile email`).
- [ ] Record `TENANT_ID`, SPA `CLIENT_ID`, API `CLIENT_ID`, and API `CLIENT_SECRET`.
- [ ] Seed the initial **user↔role** mapping in the app DB keyed by each user's Entra `oid`.

### 6.2 DNS & certificates

- [ ] Reserve hostnames (e.g. `sectorhead.moca.gov.ae`, `sectorhead-stg.moca.gov.ae`).
- [ ] Create DNS A/CNAME records pointing to the Azure ingress / App Service.
- [ ] Provision TLS certificates (Azure-managed cert or Key Vault cert) — HTTPS only, HSTS on.
- [ ] Configure redirect URIs in Entra to match the final HTTPS hostnames.

### 6.3 Data & storage

- [ ] Provision **Azure Database for PostgreSQL Flexible Server** (v16), private networking.
- [ ] Provision **Azure Blob Storage** account + container for attachments.
- [ ] Run **TypeORM migrations**; load reference/seed data.
- [ ] Configure automated **PostgreSQL backups** + test a restore.

### 6.4 Secrets & config

- [ ] Create an **Azure Key Vault**; store DB password, `CLIENT_SECRET`, Blob keys, JWT config.
- [ ] Wire the API to Key Vault (Managed Identity — no secrets in images or env files in prod).
- [ ] Fill every environment variable listed in doc 04 for each environment.

### 6.5 Runtime & observability

- [ ] Deploy `web` (nginx + SPA) and `api` (NestJS) containers.
- [ ] Confirm health endpoint `/api/health` is green and wired to the platform probe.
- [ ] Enable structured (pino) log shipping + request-id correlation to Azure Monitor / Log Analytics.
- [ ] Configure alerts (5xx rate, latency, DB connections, cert expiry).
- [ ] Verify Swagger `/api/docs` is reachable in non-prod and **disabled/protected** in prod.

### 6.6 Go-live validation

- [ ] End-to-end SSO login for one user of each type (chair / office / sector / sysadmin).
- [ ] Verify a Sector Head **project approval** and a **leave approval** round-trip.
- [ ] Verify an office member can add data only in their granted sections (RBAC enforced server-side).
- [ ] Verify a file attachment uploads to Blob and downloads back.
- [ ] Verify AR ⇄ EN toggle and RTL rendering in production.

---

## 7. Support notes

- The domain model (entities, statuses, permission letters) is defined in
  `app/src/data/types.ts` and `app/src/domain/permissions.ts`. Treat these as the
  authoritative contract when building the backend entities and RBAC guard.
- **Never fabricate operational content.** Seed data is real MOCA content ported verbatim.
- The workflow status vocabulary (pending / approved / returned, plus legacy Arabic
  aliases) is centralized in `app/src/domain/workflow.ts` — mirror it server-side.
