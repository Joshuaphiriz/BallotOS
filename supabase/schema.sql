-- ============================================================================
-- BallotOS — Supabase schema
-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query).
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE where possible.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- users  (1:1 with auth.users — profile + app role)
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id                  uuid primary key references auth.users(id) on delete cascade,
  email               text not null,
  full_name           text,
  ems_role            text not null default 'admin' check (ems_role in ('admin','observer','polling_assistant')),
  station_name        text,
  assigned_election_id uuid,          -- optional: scopes an observer to one election (audit-log visibility)
  created_date        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- elections
-- ---------------------------------------------------------------------------
create table if not exists public.elections (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  association_name  text,
  association_abbr  text,
  logo_url          text,
  primary_color     text default '#1F365C',
  secondary_color   text default '#637D97',
  accent_color      text default '#D4A437',
  status            text not null default 'draft' check (status in ('draft','open','closed','archived')),
  starts_at         timestamptz,
  ends_at           timestamptz,
  description       text,
  is_active         boolean not null default false,
  created_date      timestamptz not null default now()
);

alter table public.users
  add constraint users_assigned_election_fkey
  foreign key (assigned_election_id) references public.elections(id) on delete set null;

-- ---------------------------------------------------------------------------
-- positions
-- ---------------------------------------------------------------------------
create table if not exists public.positions (
  id             uuid primary key default gen_random_uuid(),
  election_id    uuid not null references public.elections(id) on delete cascade,
  title          text not null,
  description    text,
  "order"        numeric default 0,
  max_selections numeric default 1,
  created_date   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- candidates
-- ---------------------------------------------------------------------------
create table if not exists public.candidates (
  id            uuid primary key default gen_random_uuid(),
  election_id   uuid not null references public.elections(id) on delete cascade,
  position_id   uuid references public.positions(id) on delete set null,
  full_name     text not null,
  aka           text,
  photo_url     text,
  biography     text,
  manifesto     text,
  programme     text,
  year          text,
  created_date  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- students (voter roll)
-- ---------------------------------------------------------------------------
create table if not exists public.students (
  id               uuid primary key default gen_random_uuid(),
  election_id      uuid not null references public.elections(id) on delete cascade,
  computer_number  text not null,
  full_name        text,
  programme        text,
  year             text not null,
  gender           text,
  faculty          text,
  school           text,
  phone            text,
  email            text,
  has_voted        boolean not null default false,
  voted_at         timestamptz,
  created_date     timestamptz not null default now()
);

create index if not exists idx_students_election_computer
  on public.students (election_id, computer_number);

-- ---------------------------------------------------------------------------
-- voting_stations
-- ---------------------------------------------------------------------------
create table if not exists public.voting_stations (
  id              uuid primary key default gen_random_uuid(),
  election_id     uuid references public.elections(id) on delete cascade,
  name            text not null,
  location        text,
  officer_name    text,
  officer_email   text,
  status          text not null default 'offline' check (status in ('online','offline')),
  votes_processed numeric default 0,
  last_activity   timestamptz,
  created_date    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- votes
-- ---------------------------------------------------------------------------
create table if not exists public.votes (
  id               uuid primary key default gen_random_uuid(),
  election_id      uuid not null references public.elections(id) on delete cascade,
  student_id       uuid references public.students(id) on delete set null,
  computer_number  text,
  station_name     text,
  selections       jsonb not null default '[]'::jsonb,
  created_date     timestamptz not null default now()
);

create index if not exists idx_votes_election on public.votes (election_id);

-- ---------------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id            uuid primary key default gen_random_uuid(),
  election_id   uuid references public.elections(id) on delete cascade,
  actor         text,
  action        text not null,
  category      text not null default 'system' check (category in ('auth','vote','import','election','user','system')),
  details       text,
  created_date  timestamptz not null default now()
);

create index if not exists idx_audit_logs_election on public.audit_logs (election_id);

-- ============================================================================
-- Auto-create a public.users profile whenever someone signs up via Supabase Auth
-- ============================================================================
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, ems_role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', null),
    'admin'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ============================================================================
-- Helper: current caller's ems_role (used inside RLS policies)
-- ============================================================================
create or replace function public.current_ems_role()
returns text
language sql
stable
security definer set search_path = public
as $$
  select ems_role from public.users where id = auth.uid();
$$;

create or replace function public.current_assigned_election()
returns uuid
language sql
stable
security definer set search_path = public
as $$
  select assigned_election_id from public.users where id = auth.uid();
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.users           enable row level security;
alter table public.elections       enable row level security;
alter table public.positions       enable row level security;
alter table public.candidates      enable row level security;
alter table public.students        enable row level security;
alter table public.voting_stations enable row level security;
alter table public.votes           enable row level security;
alter table public.audit_logs      enable row level security;

-- ---- users -----------------------------------------------------------------
create policy "users_select_authenticated" on public.users
  for select using (auth.uid() is not null);

create policy "users_update_self_or_admin" on public.users
  for update using (auth.uid() = id or public.current_ems_role() = 'admin');

create policy "users_admin_write" on public.users
  for insert with check (public.current_ems_role() = 'admin' or auth.uid() = id);

create policy "users_admin_delete" on public.users
  for delete using (public.current_ems_role() = 'admin');

-- ---- elections / positions / candidates / voting_stations (admin manages) --
create policy "elections_select_authenticated" on public.elections
  for select using (auth.uid() is not null);
create policy "elections_admin_write" on public.elections
  for insert with check (public.current_ems_role() = 'admin');
create policy "elections_admin_update" on public.elections
  for update using (public.current_ems_role() = 'admin');
create policy "elections_admin_delete" on public.elections
  for delete using (public.current_ems_role() = 'admin');

create policy "positions_select_authenticated" on public.positions
  for select using (auth.uid() is not null);
create policy "positions_admin_write" on public.positions
  for insert with check (public.current_ems_role() = 'admin');
create policy "positions_admin_update" on public.positions
  for update using (public.current_ems_role() = 'admin');
create policy "positions_admin_delete" on public.positions
  for delete using (public.current_ems_role() = 'admin');

create policy "candidates_select_authenticated" on public.candidates
  for select using (auth.uid() is not null);
create policy "candidates_admin_write" on public.candidates
  for insert with check (public.current_ems_role() = 'admin');
create policy "candidates_admin_update" on public.candidates
  for update using (public.current_ems_role() = 'admin');
create policy "candidates_admin_delete" on public.candidates
  for delete using (public.current_ems_role() = 'admin');

-- voting_stations: admin manages the list, polling assistants can update status
create policy "stations_select_authenticated" on public.voting_stations
  for select using (auth.uid() is not null);
create policy "stations_admin_write" on public.voting_stations
  for insert with check (public.current_ems_role() = 'admin');
create policy "stations_update_admin_or_assistant" on public.voting_stations
  for update using (public.current_ems_role() in ('admin','polling_assistant'));
create policy "stations_admin_delete" on public.voting_stations
  for delete using (public.current_ems_role() = 'admin');

-- ---- students: admin manages roll; polling assistants mark has_voted -------
create policy "students_select_authenticated" on public.students
  for select using (auth.uid() is not null);
create policy "students_admin_write" on public.students
  for insert with check (public.current_ems_role() = 'admin');
create policy "students_update_admin_or_assistant" on public.students
  for update using (public.current_ems_role() in ('admin','polling_assistant'));
create policy "students_admin_delete" on public.students
  for delete using (public.current_ems_role() = 'admin');

-- ---- votes: cast by admin/polling assistant, immutable except by admin -----
create policy "votes_select_authenticated" on public.votes
  for select using (auth.uid() is not null);
create policy "votes_insert_admin_or_assistant" on public.votes
  for insert with check (public.current_ems_role() in ('admin','polling_assistant'));
create policy "votes_admin_delete" on public.votes
  for delete using (public.current_ems_role() = 'admin');

-- ---- audit_logs: any authenticated user can write; read is role-scoped -----
create policy "audit_logs_insert_authenticated" on public.audit_logs
  for insert with check (auth.uid() is not null);
create policy "audit_logs_delete_admin" on public.audit_logs
  for delete using (public.current_ems_role() = 'admin');
-- Observers only see logs for their assigned election (enforced here, not just
-- hidden in the UI); admins and polling assistants see everything.
create policy "audit_logs_select_scoped" on public.audit_logs
  for select using (
    public.current_ems_role() <> 'observer'
    or public.current_assigned_election() is null
    or election_id = public.current_assigned_election()
  );

-- ============================================================================
-- Realtime (used by Results page to live-tally votes)
-- ============================================================================
alter publication supabase_realtime add table public.votes;

-- ============================================================================
-- Storage bucket for candidate photos / election logos
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('ballotos-media', 'ballotos-media', true)
on conflict (id) do nothing;

create policy "media_public_read" on storage.objects
  for select using (bucket_id = 'ballotos-media');
create policy "media_authenticated_write" on storage.objects
  for insert with check (bucket_id = 'ballotos-media' and auth.uid() is not null);
create policy "media_authenticated_update" on storage.objects
  for update using (bucket_id = 'ballotos-media' and auth.uid() is not null);
create policy "media_authenticated_delete" on storage.objects
  for delete using (bucket_id = 'ballotos-media' and auth.uid() is not null);
