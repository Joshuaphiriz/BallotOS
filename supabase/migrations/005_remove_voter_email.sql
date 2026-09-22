-- Reverts 004_voter_email.sql. The voter-email-collection feature was
-- removed — it only ever collected a self-reported, unverified email
-- address, which wasn't worth the added complexity. No data loss: no vote
-- has ever had voter_email set.

alter table public.elections drop column if exists collect_voter_email;

alter table public.votes drop column if exists voter_email;
