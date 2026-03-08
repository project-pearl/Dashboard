-- Migration: Create admin_audit_log table
-- Run this in the Supabase SQL editor or via psql.

create table if not exists public.admin_audit_log (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  actor_id    uuid not null,
  actor_email text not null,
  action      text not null,
  target_id   uuid,
  target_email text,
  metadata    jsonb
);

-- Index for quick lookups by actor or action
create index if not exists idx_audit_actor  on public.admin_audit_log (actor_id);
create index if not exists idx_audit_action on public.admin_audit_log (action);
create index if not exists idx_audit_created on public.admin_audit_log (created_at);

-- RLS: only service-role can insert; no public read/write
alter table public.admin_audit_log enable row level security;

-- Allow service-role full access (bypasses RLS by default, but explicit for clarity)
create policy "Service role full access"
  on public.admin_audit_log
  for all
  using (true)
  with check (true);
