-- Adds per-election optional collection of voter email addresses for online
-- voting. No RLS changes needed — these are just new columns on tables that
-- already have correct RLS policies, and public voters never touch Supabase
-- directly (every write goes through the cast-vote serverless function,
-- which uses the service role key server-side).

alter table public.elections add column if not exists collect_voter_email boolean not null default false;

alter table public.votes add column if not exists voter_email text;
