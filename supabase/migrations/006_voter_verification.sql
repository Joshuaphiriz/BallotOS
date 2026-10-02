-- ============================================================================
-- Voter email verification: one-time codes, append-only voter audit log,
-- atomic ballot casting, and ballot-timestamp truncation for secrecy.
--
-- SAFE / ADDITIVE ONLY:
--   - No existing table is altered or dropped. No existing row is touched.
--   - students.email already exists (added before this migration) and is
--     already admin-only (RLS already restricts students writes to admin/
--     polling_assistant) — nothing to change there.
--   - votes.student_id / votes.computer_number are LEFT IN PLACE (still used
--     by station voting and all historical rows). The new cast_ballot()
--     function below simply never populates them for ballots cast through
--     the verified online flow, so those ballots cannot be linked back to a
--     voter — without touching the columns themselves.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- verification_codes — one row per code issued (never stores the plaintext
-- code, only a SHA-256 hash salted with the server-side CODE_PEPPER secret).
-- No RLS policies are defined, so with RLS enabled below, anon/authenticated
-- roles get zero access by default — only the service role (used server-side
-- by api/request-code.js and api/verify-code.js) can read or write this
-- table, exactly like the existing online-voting functions already do for
-- students/votes.
-- ---------------------------------------------------------------------------
create table if not exists public.verification_codes (
  id                 uuid primary key default gen_random_uuid(),
  election_id        uuid not null references public.elections(id) on delete cascade,
  computer_number    text not null,
  code_hash          text not null,
  expires_at         timestamptz not null,
  wrong_attempts     int not null default 0,
  replacements_used  int not null default 0,
  used_at            timestamptz,
  created_date       timestamptz not null default now()
);

create index if not exists idx_verification_codes_lookup
  on public.verification_codes (election_id, computer_number, created_date desc);

alter table public.verification_codes enable row level security;
-- Intentionally no policies: default-deny for anon/authenticated; service
-- role bypasses RLS and is the only caller.

-- ---------------------------------------------------------------------------
-- voter_audit_log — append-only. Records WHO verified/voted, WHEN (to the
-- minute — this is about the verification step, not the ballot), from where,
-- and how, but carries no link to ballot content. Never joinable to votes.
-- ---------------------------------------------------------------------------
create table if not exists public.voter_audit_log (
  id               uuid primary key default gen_random_uuid(),
  created_date     timestamptz not null default now(),
  election_id      uuid references public.elections(id) on delete cascade,
  computer_number  text,
  event_type       text not null check (event_type in (
                     'code_requested', 'code_emailed', 'code_failed_to_send',
                     'code_wrong', 'code_accepted', 'code_expired', 'locked',
                     'ballot_cast', 'ballot_notice_sent', 'ballot_notice_failed',
                     'admin_reset'
                   )),
  masked_email     text,
  ip_address       text,
  user_agent       text,
  admin_user_id    uuid references public.users(id),
  reason           text
);

create index if not exists idx_voter_audit_log_election
  on public.voter_audit_log (election_id, created_date desc);
create index if not exists idx_voter_audit_log_computer
  on public.voter_audit_log (election_id, computer_number);
-- Supports the "one IP across >10 computer numbers in 10 minutes" admin alert.
create index if not exists idx_voter_audit_log_ip
  on public.voter_audit_log (election_id, ip_address, created_date desc);

alter table public.voter_audit_log enable row level security;

-- Readable by admins (everything) and observers (their assigned election
-- only) — same scoping rule as the existing audit_logs table. No insert/
-- update/delete policy for authenticated users: writes only ever come from
-- the service role (server-side), which bypasses RLS for INSERT, and is
-- blocked from UPDATE/DELETE by the triggers below regardless of role.
create policy "voter_audit_log_select_scoped" on public.voter_audit_log
  for select using (
    public.current_ems_role() <> 'observer'
    or public.current_assigned_election() is null
    or election_id = public.current_assigned_election()
  );

create or replace function public.reject_voter_audit_log_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'voter_audit_log is append-only: % is not permitted', tg_op;
end;
$$;

drop trigger if exists voter_audit_log_no_update on public.voter_audit_log;
create trigger voter_audit_log_no_update
  before update on public.voter_audit_log
  for each row execute function public.reject_voter_audit_log_mutation();

drop trigger if exists voter_audit_log_no_delete on public.voter_audit_log;
create trigger voter_audit_log_no_delete
  before delete on public.voter_audit_log
  for each row execute function public.reject_voter_audit_log_mutation();

alter publication supabase_realtime add table public.voter_audit_log;

-- ---------------------------------------------------------------------------
-- Ballot secrecy: truncate the timestamp on every NEW vote (station + online)
-- to the day, so no one can correlate a ballot's cast time with a voter's
-- verification/sign-in time. Only affects rows inserted from now on —
-- existing votes are never touched (this is a BEFORE INSERT trigger).
-- ---------------------------------------------------------------------------
create or replace function public.truncate_ballot_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.created_date := date_trunc('day', now());
  return new;
end;
$$;

drop trigger if exists votes_truncate_timestamp on public.votes;
create trigger votes_truncate_timestamp
  before insert on public.votes
  for each row execute function public.truncate_ballot_timestamp();

-- ---------------------------------------------------------------------------
-- cast_ballot — atomic claim-and-insert for the verified online flow.
-- Runs as a single Postgres function call (one implicit transaction): claims
-- the voter (has_voted = false -> true) and inserts the ballot, or does
-- neither. Two simultaneous calls for the same computer number can never
-- both succeed, because the UPDATE ... WHERE has_voted = false can only ever
-- match one row once.
--
-- Deliberately does NOT take or store student_id/computer_number on the
-- ballot — this is what keeps verified online ballots unlinkable to a voter.
-- SECURITY DEFINER + execute restricted to service_role only (below), so it
-- runs with the owning role's BYPASSRLS and can never be invoked by a public
-- anon/authenticated client directly.
-- ---------------------------------------------------------------------------
create or replace function public.cast_ballot(
  p_election_id uuid,
  p_computer_number text,
  p_selections jsonb
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_student_id uuid;
  v_ballot_id  uuid;
begin
  update public.students
    set has_voted = true, voted_at = now()
    where election_id = p_election_id
      and computer_number = p_computer_number
      and has_voted = false
    returning id into v_student_id;

  if v_student_id is null then
    raise exception 'ALREADY_VOTED' using errcode = 'P0001';
  end if;

  insert into public.votes (election_id, station_name, channel, selections)
  values (p_election_id, 'Online', 'online', p_selections)
  returning id into v_ballot_id;

  return v_ballot_id;
end;
$$;

revoke all on function public.cast_ballot(uuid, text, jsonb) from public;
grant execute on function public.cast_ballot(uuid, text, jsonb) to service_role;
