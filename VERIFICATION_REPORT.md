# Voter Verification — Verification Report

Branch: `feature/voter-verification` (pushed to `origin`, not merged to `main`)
Preview: https://ballot-pmib68pey-joshua-p-projects.vercel.app (Vercel "Preview" environment, confirmed via GitHub's deployment API — not production)

## What changed

### Database (two migrations, both applied by the user after review)
- `supabase/migrations/006_voter_verification.sql` — adds `verification_codes`, `voter_audit_log` (append-only, RLS-scoped like `audit_logs`), a `BEFORE INSERT` trigger truncating every new `votes.created_date` to midnight, and `cast_ballot()` — a `SECURITY DEFINER` function (execute restricted to `service_role`) that atomically claims the voter and inserts the ballot in one transaction, without ever writing `student_id`/`computer_number` onto the ballot.
- `supabase/migrations/007_voter_audit_log_cascade_fix.sql` — fixes a bug found during testing (see below).
- No existing table, column, or row was altered, dropped, or touched. `students.email` already existed pre-session and was already admin-only.

### Backend (`api/`)
- `request-code.js` (new) — validates the computer number against the roll, rate-limits (3/hour), emails a 6-digit code (Resend), masks the response, enforces the one-replacement-then-lock rule, logs every outcome.
- `verify-code.js` (new) — checks the code, invalidates it after 2 wrong attempts, issues a 15-minute signed voting pass on success.
- `cast-vote.js` (rewritten) — now requires a valid voting pass (derives election/computer number only from the pass, never the request body), calls `cast_ballot()`, emails a ballot confirmation (failure logged, never blocks the vote).
- `admin-reset-voter.js` (new) — admin-only (same bearer-token pattern as the existing `invite-user.js`), required reason, refuses to reset an already-voted computer number.
- `check-eligibility.js` — removed; its job is now done inside `request-code.js`.
- `_lib/verification.js`, `_lib/resend.js`, `_lib/voterAuditLog.js` — new shared helpers (code hashing with `CODE_PEPPER`, HMAC voting pass with `VOTE_PASS_SECRET`, email masking, Resend wrapper, audit logging).

### Frontend (`src/`)
- `pages/PublicVote.jsx` — new flow: computer number → emailed code → verified code → ballot → success, with distinct messaging for not-found/no-email/already-voted/locked/rate-limited/wrong-or-expired-code, a masked-email confirmation, and a one-click replacement-code request.
- `pages/VoterVerificationLog.jsx` (new) — live (Realtime) admin log with event-type/computer-number filters, red-highlighting when one IP touches >10 computer numbers in 10 minutes, and the admin reset dialog.
- `App.jsx`, `components/layout/Sidebar.jsx` — new `/voter-verification` route, gated by the same `logs` capability as the existing Audit Logs page.
- `components/voting/Ballot.jsx` — minor: handles a voter with no `full_name` to display (the verified flow intentionally fetches less voter detail into the browser than the old flow did).
- `api/base44Client.js` — adds `VoterAuditLog` entity and `voterVerification.resetVoter()`.

## Secrets
`CODE_PEPPER`, `VOTE_PASS_SECRET` generated and set in Vercel (Production + Preview) by the user via the dashboard, values never seen by or sent to me. `RESEND_API_KEY` / `TURNSTILE_SECRET_KEY` were already configured.

## Bugs found and fixed during this session
1. **Admin reset didn't clear the hourly rate limit** — only the lock counter. A voter reset within the same hour as their lockout would immediately hit `rate_limited` again. Fixed in `request-code.js` (commit `7aa7e2e`).
2. **`voter_audit_log`'s append-only trigger blocked the existing "Delete election" admin feature** — it rejected every DELETE unconditionally, including the cascade from deleting the parent election, which the pre-existing `Elections.jsx` delete flow already relies on (same as it does for `audit_logs`). Would have left any election with verification activity stuck in a half-deleted state. Fixed via `pg_trigger_depth()` in migration 007 (commit `fc85fbd`) — direct tampering is still rejected; only the legitimate cascade is now allowed.

## Automated test results — 18/18 passed

Run directly against the live Supabase project, using a disposable test election created and fully deleted by the script itself (Cloudflare Turnstile and Resend network calls mocked; everything else — the real database, the real `cast_ballot()` function, the real handler code — exercised for real):

- correct code → verify → cast → confirmation email sent
- resulting ballot has `student_id`/`computer_number` = null, `created_date` truncated to midnight
- voting again with the same (used) pass → 409; no pass → 400; garbage pass → 401
- two wrong codes → code invalidated; correct code no longer works afterward
- expired code rejected
- second code request invalidates the first (replacement); third request locks the voter
- admin reset clears both the lock and the rate limit
- two simultaneous `cast_ballot()` calls for the same voter → exactly one succeeds, the other gets `ALREADY_VOTED`
- `not_found` / `no_email` / `already_voted` messaging all correct
- `voter_audit_log` rejects direct UPDATE and DELETE
- deleting the parent election now cascades cleanly through `voter_audit_log` (post-fix)

Also confirmed directly against the schema:
- `votes` shares no populated column with `voter_audit_log` or `students` for any verified-flow ballot (`student_id`/`computer_number` are always null on those rows) — no query can deanonymize a verified ballot.
- `block_vote_updates`: **this trigger does not exist anywhere in the codebase** — flagged in the original plan; there was nothing to "keep working." The double-vote protections that do exist (`students.has_voted` atomic claim, now wrapped in `cast_ballot()`) were verified directly above.

## Not yet done / open questions
1. **No visual/browser testing was done by me** — I have no browser or UI access in this environment, and outbound network to `*.vercel.app` is blocked from this sandbox, so I could not even confirm the preview URL loads from here. Everything above is logic/data-layer verified against the real database; the actual voter-facing UI, email formatting/deliverability, and the admin log page's live Realtime updates still need your eyes. Checklist below.
2. **Station (in-person) voting is untouched by design** — `Voting.jsx`/`VerifyStudent.jsx` were not modified. The new midnight-truncation trigger on `votes.created_date` does apply to station ballots too (by design, discussed earlier), which is the one behavior change station voting will see.
3. **No PR has been opened** — branch is pushed to `origin/feature/voter-verification` but not merged. Say the word if you want one.
4. **Timeline** — this was built and logic-tested in one session; given the election is 3 days out, please don't skip the manual checklist below before relying on it for ~6,000 voters.

## Manual testing checklist (preview URL, do this yourself)

Use a **dedicated test election** so real voter data is never touched — same approach my automated tests used.

1. In the admin app (your normal login, on the preview URL), create a new election, add one position + one candidate, import 2–3 test students via CSV **with your own email address(es)** in the `email` column, turn on "Online voting", set status to "Open".
2. Open the public voting link (`/vote-online?election=<id>`) in an incognito window.
3. Enter a test computer number → confirm you receive a real email with a 6-digit code within a minute or two, and the page shows your masked email correctly.
4. Enter the **wrong** code twice → confirm you see "incorrect code" then "no longer valid", and that the original correct code no longer works either.
5. Request a new code ("Didn't get a code?") → confirm the old code stops working and the new one is accepted.
6. Request a third code → confirm you're told you're locked.
7. As admin, open **Voter Verification** in the sidebar, find that computer number, click **Reset**, enter a reason → confirm the voter page can request a code again.
8. Complete a full vote with a valid code → confirm the ballot submits, you land on the success screen, and a ballot-confirmation email arrives.
9. Try to vote again with the same computer number → confirm it's rejected as already voted.
10. On the Voter Verification page, confirm every step above shows up live (filter by computer number; try the event-type filter).
11. When done, delete the test election from the Elections page (confirms the cascade-delete fix works for you too) — it should succeed cleanly, including removing its Voter Verification log entries.

Once you're happy with the preview, let me know and I'll wait for your explicit "DEPLOY TO PRODUCTION" before touching production, per the safety rules.
