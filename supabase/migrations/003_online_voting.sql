-- Adds per-election online voting support. No RLS changes needed — public
-- voters never touch Supabase directly at all; every public interaction goes
-- through the three new serverless functions (get-ballot, check-eligibility,
-- cast-vote), which use the service role key server-side. Anonymous direct
-- database access remains fully blocked, exactly as before.

alter table public.elections add column if not exists online_voting_enabled boolean not null default false;

alter table public.votes add column if not exists channel text not null default 'station'
  check (channel in ('station', 'online'));

create index if not exists idx_votes_channel on public.votes (election_id, channel);
