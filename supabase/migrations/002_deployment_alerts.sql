-- ============================================================
-- PIN Deployment Alerts — Supabase Migration
-- Tables for persisting deployment sensor alerts, acknowledgments,
-- and parameter timeline for trend analysis.
-- ============================================================

-- ── deployment_alerts ────────────────────────────────────────
-- Each row is a detected anomaly from the analyzeDelta() engine.
-- Survives redeploy, queryable across all deployments.

create table if not exists deployment_alerts (
  id            uuid primary key default gen_random_uuid(),
  deployment_id text        not null,
  parameter     text        not null,     -- 'Flow Rate', 'Turbidity', 'DO', 'pH', 'TSS Removal'
  value         double precision not null, -- current reading
  baseline      double precision not null, -- installation baseline
  delta         double precision not null, -- % or absolute change
  unit          text        not null,      -- 'GPM', 'NTU', 'mg/L', 'pH', '%'
  severity      text        not null check (severity in ('critical', 'warning', 'info')),
  status        text        not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  title         text        not null,
  diagnosis     text,
  recommendation text,
  pipeline_event_id text,                  -- links to AlertEvent.id in blob log
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_depalerts_deployment on deployment_alerts (deployment_id, created_at desc);
create index idx_depalerts_status     on deployment_alerts (status) where status = 'open';
create index idx_depalerts_severity   on deployment_alerts (severity, created_at desc);

-- ── alert_acknowledgments ────────────────────────────────────
-- Who acknowledged / dismissed an alert, with an optional note
-- and action_taken (e.g., "dispatched field tech").

create table if not exists alert_acknowledgments (
  id              uuid primary key default gen_random_uuid(),
  alert_id        uuid        not null references deployment_alerts(id) on delete cascade,
  user_id         uuid,                   -- nullable: may be anonymous in demo mode
  user_name       text,                   -- display name for audit trail
  note            text,
  action_taken    text,                   -- 'inspected', 'dispatched_tech', 'created_work_order', 'dismissed'
  acknowledged_at timestamptz not null default now()
);

create index idx_ack_alert on alert_acknowledgments (alert_id, acknowledged_at desc);

-- ── alert_timeline ───────────────────────────────────────────
-- Point-in-time parameter readings for trend display.
-- Populated each time analyzeDelta() runs on a deployment.

create table if not exists alert_timeline (
  id          uuid primary key default gen_random_uuid(),
  alert_id    uuid references deployment_alerts(id) on delete set null,
  deployment_id text        not null,
  parameter   text        not null,
  value       double precision not null,
  baseline    double precision not null,
  severity    text,                       -- severity AT that moment (or null if within spec)
  recorded_at timestamptz not null default now()
);

create index idx_timeline_dep_param on alert_timeline (deployment_id, parameter, recorded_at desc);
create index idx_timeline_alert     on alert_timeline (alert_id, recorded_at desc);

-- ── auto-update updated_at ───────────────────────────────────

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_depalerts_updated
  before update on deployment_alerts
  for each row execute function update_updated_at();

-- ── RLS policies (anon key access) ──────────────────────────
-- Allow full access for now (auth handled at API route level).

alter table deployment_alerts enable row level security;
alter table alert_acknowledgments enable row level security;
alter table alert_timeline enable row level security;

create policy "Allow all for authenticated" on deployment_alerts
  for all using (true) with check (true);

create policy "Allow all for authenticated" on alert_acknowledgments
  for all using (true) with check (true);

create policy "Allow all for authenticated" on alert_timeline
  for all using (true) with check (true);
