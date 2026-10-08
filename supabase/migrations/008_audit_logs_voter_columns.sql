-- Adds voter_email, ip_address, user_agent to audit_logs so the general
-- "Online vote submitted by X" entry can show who, from where, and on what
-- device — same info already shown on Voter Verification, now visible on
-- the main Audit Logs page too. Nullable, additive only: no existing row or
-- column touched. Populated only on vote-submission entries; every other
-- action type leaves these null.
alter table public.audit_logs add column if not exists voter_email text;
alter table public.audit_logs add column if not exists ip_address text;
alter table public.audit_logs add column if not exists user_agent text;
