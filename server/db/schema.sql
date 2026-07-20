-- ============================================================================
--  Sector Head Follow-up Platform — PostgreSQL schema (authoritative DDL)
--  MOCA · production (IT) build
--
--  Design notes
--  ------------
--  * Identity is federated to Microsoft Entra ID; `users.entra_oid` is the join
--    key. There are NO local passwords.
--  * Scalar/queryable attributes are real columns; variable-shape nested
--    structures (task lists, timelines, directives, attachments, financial
--    breakdowns) are JSONB. This mirrors the frontend TypeScript data model
--    (app/src/data/types.ts) without exploding into dozens of child tables.
--  * Arabic status/priority values are stored verbatim (UTF-8) to match the UI.
--  * `owner` / `unit` columns reference users.id / a department scope by
--    convention and carry indexes for row-level scoping.
--  * Every row-bearing table has created_at / updated_at.
--
--  Apply with:  psql "$DATABASE_URL" -f db/schema.sql
--  (or run the equivalent TypeORM migration: npm run migration:run)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()

-- ── Reference: enumerated domains kept as CHECKs (values match the UI) ──────
--    user type, action grant letters, and access scopes.

-- ---------------------------------------------------------------------------
--  users  — federated identity + app roles/permissions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id          VARCHAR(64)  PRIMARY KEY,               -- app id, e.g. 'samah'
    entra_oid   UUID         UNIQUE,                     -- Entra object id (oid)
    email       VARCHAR(256),
    name        VARCHAR(128) NOT NULL,
    job         VARCHAR(256) NOT NULL DEFAULT '',
    type        VARCHAR(16)  NOT NULL
                CHECK (type IN ('chair','office','sector','sysadmin')),
    scope       VARCHAR(32)  NOT NULL DEFAULT 'office'
                CHECK (scope IN ('all','office','admin_affairs','hr','digital','cx')),
    "all"       BOOLEAN      NOT NULL DEFAULT FALSE,     -- full-access flag
    grants      JSONB        NOT NULL DEFAULT '{}'::jsonb, -- section -> letters
    active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_entra_oid ON users (entra_oid);

-- ---------------------------------------------------------------------------
--  sector_managers  — department managers (reference people)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sector_managers (
    id    VARCHAR(64) PRIMARY KEY,
    name  VARCHAR(128) NOT NULL,
    role  VARCHAR(256) NOT NULL DEFAULT '',
    dept  VARCHAR(128) NOT NULL DEFAULT ''
);

-- ---------------------------------------------------------------------------
--  projects
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    no               VARCHAR(32)  NOT NULL DEFAULT '',
    name             VARCHAR(300) NOT NULL,
    name_en          VARCHAR(300),
    owner            VARCHAR(64)  NOT NULL,
    unit             VARCHAR(64)  NOT NULL DEFAULT '',
    status           VARCHAR(40)  NOT NULL DEFAULT '',
    progress         INT          NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    priority         VARCHAR(24)  NOT NULL DEFAULT '',
    stage            VARCHAR(40)  NOT NULL DEFAULT '',
    budget           NUMERIC(14,2) NOT NULL DEFAULT 0,
    spent            NUMERIC(14,2),
    "desc"           TEXT         NOT NULL DEFAULT '',
    final_output     TEXT         NOT NULL DEFAULT '',
    next_step        TEXT         NOT NULL DEFAULT '',
    start_date       VARCHAR(32),
    due_date         VARCHAR(32),
    risks            TEXT,
    chairman_notes   TEXT,
    completion_state VARCHAR(32),          -- بانتظار الاعتماد | معتمد | مرفوض
    scope            JSONB NOT NULL DEFAULT '[]'::jsonb,
    people           JSONB NOT NULL DEFAULT '[]'::jsonb,
    attachments      JSONB NOT NULL DEFAULT '[]'::jsonb,
    tasks            JSONB NOT NULL DEFAULT '[]'::jsonb,
    timeline         JSONB NOT NULL DEFAULT '[]'::jsonb,
    directives       JSONB NOT NULL DEFAULT '[]'::jsonb,
    extend_req       JSONB,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects (owner);
CREATE INDEX IF NOT EXISTS idx_projects_unit  ON projects (unit);

-- ---------------------------------------------------------------------------
--  meetings  (+ nested attendees/actions/decisions as JSONB)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meetings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       VARCHAR(300) NOT NULL,
    date        VARCHAR(32)  NOT NULL DEFAULT '',
    owner       VARCHAR(64)  NOT NULL DEFAULT '',
    status      VARCHAR(40)  NOT NULL DEFAULT '',
    summary     TEXT         NOT NULL DEFAULT '',
    time        VARCHAR(40),
    location    VARCHAR(200),
    entity      VARCHAR(200),
    chair_notes TEXT,
    attendees   JSONB NOT NULL DEFAULT '[]'::jsonb,
    absentees   JSONB NOT NULL DEFAULT '[]'::jsonb,
    key_points  JSONB NOT NULL DEFAULT '[]'::jsonb,
    decisions   JSONB NOT NULL DEFAULT '[]'::jsonb,
    actions     JSONB NOT NULL DEFAULT '[]'::jsonb,
    attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meetings_owner ON meetings (owner);

-- ---------------------------------------------------------------------------
--  minute_tasks  (mtasks)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS minute_tasks (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    m_date       VARCHAR(32)  NOT NULL DEFAULT '',
    meeting      VARCHAR(300) NOT NULL DEFAULT '',
    dept         VARCHAR(128) NOT NULL DEFAULT '',
    task         VARCHAR(400) NOT NULL,
    "desc"       TEXT,
    owner        VARCHAR(64)  NOT NULL DEFAULT '',
    support      VARCHAR(200) NOT NULL DEFAULT '',
    prerequisite VARCHAR(300) NOT NULL DEFAULT '',
    budget       VARCHAR(64)  NOT NULL DEFAULT '',
    dependencies VARCHAR(300) NOT NULL DEFAULT '',
    status       VARCHAR(40)  NOT NULL DEFAULT '',
    due          VARCHAR(32)  NOT NULL DEFAULT '',
    prog         INT,
    last_update  VARCHAR(32),
    notes        TEXT         NOT NULL DEFAULT '',
    reviewed     BOOLEAN      NOT NULL DEFAULT FALSE,
    participants JSONB NOT NULL DEFAULT '[]'::jsonb,
    attachments  JSONB NOT NULL DEFAULT '[]'::jsonb,
    directives   JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_minute_tasks_owner ON minute_tasks (owner);

-- ---------------------------------------------------------------------------
--  office_tasks  (otasks)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS office_tasks (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    start        VARCHAR(32)  NOT NULL DEFAULT '',
    "end"        VARCHAR(32)  NOT NULL DEFAULT '',
    label        VARCHAR(120) NOT NULL DEFAULT '',
    title        VARCHAR(400) NOT NULL,
    dept         VARCHAR(128) NOT NULL DEFAULT '',
    owner        VARCHAR(64)  NOT NULL DEFAULT '',
    status       VARCHAR(40)  NOT NULL DEFAULT '',
    "desc"       TEXT         NOT NULL DEFAULT '',
    last_update  VARCHAR(32)  NOT NULL DEFAULT '',
    due          VARCHAR(32)  NOT NULL DEFAULT '',
    notes        TEXT         NOT NULL DEFAULT '',
    reviewed     BOOLEAN      NOT NULL DEFAULT FALSE,
    participants JSONB NOT NULL DEFAULT '[]'::jsonb,
    attachments  JSONB NOT NULL DEFAULT '[]'::jsonb,
    directives   JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_office_tasks_owner ON office_tasks (owner);

-- ---------------------------------------------------------------------------
--  correspondence  (صادر/وارد)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS correspondence (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date         VARCHAR(32)  NOT NULL DEFAULT '',
    name         VARCHAR(300) NOT NULL,
    entity       VARCHAR(200) NOT NULL DEFAULT '',
    type         VARCHAR(80)  NOT NULL DEFAULT '',
    sender       VARCHAR(200) NOT NULL DEFAULT '',
    recipient    VARCHAR(200) NOT NULL DEFAULT '',
    recv_date    VARCHAR(32)  NOT NULL DEFAULT '',
    status       VARCHAR(40)  NOT NULL DEFAULT '',
    dir          VARCHAR(8)   NOT NULL CHECK (dir IN ('صادر','وارد')),
    priority     VARCHAR(24)  NOT NULL DEFAULT '',
    needs_action BOOLEAN      NOT NULL DEFAULT FALSE,
    action       VARCHAR(300) NOT NULL DEFAULT '',
    followup     VARCHAR(300) NOT NULL DEFAULT '',
    attachment   VARCHAR(400),
    notes        TEXT         NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
--  leaves  (team leave planning)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leaves (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person      VARCHAR(128) NOT NULL,
    cat         VARCHAR(16)  NOT NULL CHECK (cat IN ('manager','office')),
    role        VARCHAR(200) NOT NULL DEFAULT '',
    dept        VARCHAR(128) NOT NULL DEFAULT '',
    type        VARCHAR(80)  NOT NULL DEFAULT '',
    start       VARCHAR(32)  NOT NULL DEFAULT '',
    "end"       VARCHAR(32)  NOT NULL DEFAULT '',
    days        INT          NOT NULL DEFAULT 0,
    status      VARCHAR(40)  NOT NULL DEFAULT '',   -- incl. approval state
    backup      VARCHAR(128) NOT NULL DEFAULT '',
    notes       TEXT         NOT NULL DEFAULT '',
    chair_notes TEXT,
    attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
--  actions  (cross-cutting action hub)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS actions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       VARCHAR(400) NOT NULL,
    source      VARCHAR(300) NOT NULL DEFAULT '',
    source_type VARCHAR(80)  NOT NULL DEFAULT '',
    owner       VARCHAR(64)  NOT NULL DEFAULT '',
    priority    VARCHAR(24)  NOT NULL DEFAULT '',
    due         VARCHAR(32)  NOT NULL DEFAULT '',
    status      VARCHAR(40)  NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
--  audit_reports (auditReps) + audit_areas (observations)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_reports (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       VARCHAR(300) NOT NULL,
    unit        VARCHAR(128) NOT NULL DEFAULT '',
    year        VARCHAR(8)   NOT NULL DEFAULT '',
    period      VARCHAR(80)  NOT NULL DEFAULT '',
    freq        VARCHAR(40)  NOT NULL DEFAULT '',   -- دوري | حسب الحاجة
    status      VARCHAR(40)  NOT NULL DEFAULT '',
    resp        VARCHAR(128) NOT NULL DEFAULT '',
    notes       TEXT,
    last_update VARCHAR(32),
    updated_by  VARCHAR(128),
    attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_areas (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rep         UUID REFERENCES audit_reports(id) ON DELETE CASCADE,
    num         VARCHAR(32)  NOT NULL DEFAULT '',
    area        VARCHAR(300) NOT NULL DEFAULT '',
    obs         TEXT         NOT NULL DEFAULT '',
    action      TEXT         NOT NULL DEFAULT '',
    owner       VARCHAR(64)  NOT NULL DEFAULT '',
    status      VARCHAR(40)  NOT NULL DEFAULT '',
    imp         VARCHAR(24)  NOT NULL DEFAULT '',
    due         VARCHAR(32)  NOT NULL DEFAULT '',
    updated     VARCHAR(32)  NOT NULL DEFAULT '',
    unit        VARCHAR(128),
    notes       TEXT,
    attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    log         JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_areas_rep ON audit_areas (rep);

-- ---------------------------------------------------------------------------
--  reg_reports  (regulatory report log; per-period receipt status in JSONB)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reg_reports (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    n           VARCHAR(32)  NOT NULL DEFAULT '',
    title       VARCHAR(300) NOT NULL,
    type        VARCHAR(80)  NOT NULL DEFAULT '',
    due         VARCHAR(32)  NOT NULL DEFAULT '',
    freq        VARCHAR(40)  NOT NULL DEFAULT '',
    resp        VARCHAR(128) NOT NULL DEFAULT '',
    dept        VARCHAR(128) NOT NULL DEFAULT '',
    last_date   VARCHAR(32)  NOT NULL DEFAULT '',
    approval    VARCHAR(40)  NOT NULL DEFAULT '',
    notes       TEXT         NOT NULL DEFAULT '',
    -- legacy month columns retained for year 2026 back-compat
    jan VARCHAR(40), feb VARCHAR(40), mar VARCHAR(40), apr VARCHAR(40), may VARCHAR(40),
    -- periods: { "<year>": { "<period>": "<status>" } }
    periods     JSONB NOT NULL DEFAULT '{}'::jsonb,
    attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
--  fin_models  (financial model, one row per year; heavy JSONB breakdowns)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fin_models (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year          VARCHAR(8)   NOT NULL,
    period        VARCHAR(120) NOT NULL DEFAULT '',
    last_update   VARCHAR(32),
    updated_by    VARCHAR(128),
    budget        NUMERIC(16,2) NOT NULL DEFAULT 0,
    used          NUMERIC(16,2) NOT NULL DEFAULT 0,
    remain        NUMERIC(16,2) NOT NULL DEFAULT 0,
    commit_total  NUMERIC(16,2) NOT NULL DEFAULT 0,
    commit_paid   NUMERIC(16,2) NOT NULL DEFAULT 0,
    commit_due    NUMERIC(16,2) NOT NULL DEFAULT 0,
    opex          JSONB NOT NULL DEFAULT '{}'::jsonb,
    capex         JSONB NOT NULL DEFAULT '{}'::jsonb,
    big_projects  JSONB NOT NULL DEFAULT '[]'::jsonb,
    entities      JSONB NOT NULL DEFAULT '[]'::jsonb,
    related       JSONB NOT NULL DEFAULT '[]'::jsonb,
    rel_totals    JSONB NOT NULL DEFAULT '{}'::jsonb,
    bank_interest JSONB NOT NULL DEFAULT '{}'::jsonb,
    aging         JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (year)
);

-- ---------------------------------------------------------------------------
--  req_meetings  (meeting requests — approvable)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS req_meetings (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject    VARCHAR(300) NOT NULL,
    attendees  VARCHAR(400) NOT NULL DEFAULT '',
    basis      VARCHAR(400) NOT NULL DEFAULT '',
    proposed   VARCHAR(120) NOT NULL DEFAULT '',
    status     VARCHAR(40)  NOT NULL DEFAULT '',
    decision   VARCHAR(300) NOT NULL DEFAULT '',
    notes      TEXT         NOT NULL DEFAULT '',
    new_date   VARCHAR(32),
    new_time   VARCHAR(32),
    location   VARCHAR(200),
    link       VARCHAR(400),
    agenda     JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
--  committees  (+ nested meetings/tasks/decisions/scores as JSONB)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS committees (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name             VARCHAR(300) NOT NULL,
    chair            VARCHAR(128) NOT NULL DEFAULT '',
    rapporteur       VARCHAR(128) NOT NULL DEFAULT '',
    purpose          TEXT         NOT NULL DEFAULT '',
    freq             VARCHAR(80)  NOT NULL DEFAULT '',
    req_meetings     INT          NOT NULL DEFAULT 0,
    actual_meetings  INT          NOT NULL DEFAULT 0,
    created          VARCHAR(32)  NOT NULL DEFAULT '',
    reformed         VARCHAR(32)  NOT NULL DEFAULT '',
    status           VARCHAR(40)  NOT NULL DEFAULT '',
    cat              VARCHAR(80)  NOT NULL DEFAULT '',
    has_work_plan    BOOLEAN      NOT NULL DEFAULT FALSE,
    statement        TEXT         NOT NULL DEFAULT '',
    recommendation   TEXT         NOT NULL DEFAULT '',
    absent           JSONB NOT NULL DEFAULT '[]'::jsonb,
    scores           JSONB NOT NULL DEFAULT '{}'::jsonb,
    improvements     JSONB NOT NULL DEFAULT '[]'::jsonb,
    members          JSONB NOT NULL DEFAULT '[]'::jsonb,
    decisions        JSONB NOT NULL DEFAULT '[]'::jsonb,
    meetings         JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
--  ret_reports  (retained-payments reports; per year/quarter)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ret_reports (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year         VARCHAR(8)  NOT NULL DEFAULT '',
    quarter      VARCHAR(8)  NOT NULL DEFAULT '',
    date         VARCHAR(32) NOT NULL DEFAULT '',
    status       VARCHAR(40) NOT NULL DEFAULT '',
    last_update  VARCHAR(32) NOT NULL DEFAULT '',
    updated_by   VARCHAR(128) NOT NULL DEFAULT '',
    conclusion   TEXT        NOT NULL DEFAULT '',
    exec_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
    strengths    JSONB NOT NULL DEFAULT '[]'::jsonb,
    weaknesses   JSONB NOT NULL DEFAULT '[]'::jsonb,
    improvements JSONB NOT NULL DEFAULT '[]'::jsonb,
    recs         JSONB NOT NULL DEFAULT '[]'::jsonb,
    entities     JSONB NOT NULL DEFAULT '[]'::jsonb,
    cases        JSONB NOT NULL DEFAULT '[]'::jsonb,
    attachments  JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
--  update_requests  — "request an update" the chair sends to an owner
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS update_requests (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner      VARCHAR(128) NOT NULL,          -- owner display name
    title      VARCHAR(400) NOT NULL,
    section    VARCHAR(64)  NOT NULL,
    note       TEXT,
    date       VARCHAR(32)  NOT NULL DEFAULT '',
    resolved   BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_update_requests_owner ON update_requests (owner);

-- ---------------------------------------------------------------------------
--  change_log  — audit trail of every edit (who/what/when)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS change_log (
    id          BIGSERIAL PRIMARY KEY,
    by_user     VARCHAR(64)  NOT NULL,
    by_name     VARCHAR(128) NOT NULL,
    section     VARCHAR(64)  NOT NULL,
    item        VARCHAR(400) NOT NULL,
    change_from TEXT,
    change_to   TEXT,
    note        TEXT,
    at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_change_log_section ON change_log (section);
CREATE INDEX IF NOT EXISTS idx_change_log_at ON change_log (at DESC);

-- ============================================================================
--  updated_at trigger — keep it current on every UPDATE
-- ============================================================================
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.columns
    WHERE column_name = 'updated_at' AND table_schema = 'public'
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%1$s_updated ON %1$I;
       CREATE TRIGGER trg_%1$s_updated BEFORE UPDATE ON %1$I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t);
  END LOOP;
END $$;
