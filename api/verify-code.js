// Vercel serverless function — POST /api/verify-code
// Public, no login. Step 2 of the verified-voting flow: checks the 6-digit
// code, invalidates it after 2 wrong attempts, and on success issues a
// short-lived signed voting pass (never a database session) for cast-vote.js.
import { createClient } from '@supabase/supabase-js';
import { verifyTurnstile } from './_lib/turnstile.js';
import { hashCode, issueVotingPass, getClientIp, getUserAgent } from './_lib/verification.js';
import { logVoterEvent } from './_lib/voterAuditLog.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MAX_WRONG_ATTEMPTS = 2;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server is missing Supabase service role configuration' });
  }

  const { election_id, computer_number, code, turnstileToken } = req.body || {};
  if (!election_id || !computer_number || !code) {
    return res.status(400).json({ error: 'election_id, computer_number and code are required' });
  }
  const computerNumber = computer_number.trim();
  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);

  const captcha = await verifyTurnstile(turnstileToken, ip);
  if (!captcha.success) {
    return res.status(400).json({ status: 'captcha_failed', error: captcha.reason });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: codeRow } = await admin
    .from('verification_codes')
    .select('id, code_hash, expires_at, used_at, wrong_attempts')
    .eq('election_id', election_id)
    .eq('computer_number', computerNumber)
    .order('created_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!codeRow || codeRow.used_at || codeRow.wrong_attempts >= MAX_WRONG_ATTEMPTS) {
    await logVoterEvent(admin, { electionId: election_id, computerNumber, eventType: 'code_expired', ipAddress: ip, userAgent });
    return res.status(200).json({ status: 'no_active_code' });
  }
  if (new Date(codeRow.expires_at) <= new Date()) {
    await logVoterEvent(admin, { electionId: election_id, computerNumber, eventType: 'code_expired', ipAddress: ip, userAgent });
    return res.status(200).json({ status: 'expired' });
  }

  const submittedHash = hashCode(code.trim());
  if (submittedHash !== codeRow.code_hash) {
    const wrongAttempts = codeRow.wrong_attempts + 1;
    await admin.from('verification_codes').update({ wrong_attempts: wrongAttempts }).eq('id', codeRow.id);
    await logVoterEvent(admin, { electionId: election_id, computerNumber, eventType: 'code_wrong', ipAddress: ip, userAgent });

    if (wrongAttempts >= MAX_WRONG_ATTEMPTS) {
      await logVoterEvent(admin, { electionId: election_id, computerNumber, eventType: 'code_expired', ipAddress: ip, userAgent, reason: 'Invalidated after 2 wrong attempts' });
      return res.status(200).json({ status: 'invalidated' });
    }
    return res.status(200).json({ status: 'wrong_code', attempts_remaining: MAX_WRONG_ATTEMPTS - wrongAttempts });
  }

  // Atomic claim — only one concurrent verify can win the race to mark this
  // code used, even if the same correct code is submitted twice at once.
  const { data: claimed } = await admin
    .from('verification_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('id', codeRow.id)
    .is('used_at', null)
    .select('id')
    .maybeSingle();

  if (!claimed) {
    return res.status(200).json({ status: 'no_active_code' });
  }

  await logVoterEvent(admin, { electionId: election_id, computerNumber, eventType: 'code_accepted', ipAddress: ip, userAgent });

  // full_name is for display only (so the ballot screen can greet the voter
  // by name) — it is never embedded in the pass and never reaches the vote.
  const { data: student } = await admin
    .from('students')
    .select('full_name')
    .eq('election_id', election_id)
    .eq('computer_number', computerNumber)
    .maybeSingle();

  const votePass = issueVotingPass({ electionId: election_id, computerNumber });
  return res.status(200).json({ status: 'accepted', vote_pass: votePass, full_name: student?.full_name || null });
}
