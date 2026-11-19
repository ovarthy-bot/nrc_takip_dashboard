-- NRC Takip Dashboard — isolated table inside a shared Supabase project.
-- Run this once in the Supabase project's SQL Editor (Dashboard -> SQL Editor -> New query).
-- Safe to run alongside other apps in the same project: it only touches this one table.

create table if not exists public.nrc_dashboard_data (
    key text primary key,
    payload jsonb not null,
    updated_at timestamptz not null default now()
);

alter table public.nrc_dashboard_data enable row level security;

-- Matches the current Firebase setup: no login/auth in this app, so the anon
-- key is allowed to read/write only this table (RLS blocks every other table).
create policy "nrc_dashboard_data anon select"
    on public.nrc_dashboard_data for select
    to anon
    using (true);

create policy "nrc_dashboard_data anon insert"
    on public.nrc_dashboard_data for insert
    to anon
    with check (true);

create policy "nrc_dashboard_data anon update"
    on public.nrc_dashboard_data for update
    to anon
    using (true)
    with check (true);

create policy "nrc_dashboard_data anon delete"
    on public.nrc_dashboard_data for delete
    to anon
    using (true);
