-- ============================================================================
-- Fix: voter_audit_log's append-only trigger (006) rejected every DELETE
-- unconditionally, which also blocked the pre-existing "Delete election"
-- admin feature (src/pages/Elections.jsx) — it cascades the delete through
-- every child table, including voter_audit_log, exactly as it already does
-- for the long-standing audit_logs table. Without this fix, deleting any
-- election that had online-voting verification activity would fail
-- part-way through and leave it half-deleted.
--
-- Function-only change — no table/column/data touched, no existing rows
-- affected. Still rejects any DIRECT update/delete on voter_audit_log; only
-- allows one that happens as a cascade side-effect of deleting the parent
-- election row. Distinguished via pg_trigger_depth(): a direct client
-- statement runs at depth 1 when this trigger fires; a delete cascading in
-- from the elections FK runs one level deeper (it's invoked from within
-- Postgres's own referential-integrity trigger).
-- ============================================================================
create or replace function public.reject_voter_audit_log_mutation()
returns trigger
language plpgsql
as $$
begin
  if pg_trigger_depth() <= 1 then
    raise exception 'voter_audit_log is append-only: % is not permitted', tg_op;
  end if;
  return coalesce(new, old);
end;
$$;
