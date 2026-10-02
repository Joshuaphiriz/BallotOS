// Vercel serverless function — POST /api/request-code
// Public, no login. Step 1 of the verified-voting flow: checks the computer
// number against the roll, emails a one-time code, and never reveals
// anything an attacker could use to enumerate the voter roll beyond what
// check-eligibility already exposed (not_found / already_voted).
import { createClient } from '@supabase/supabase-js';
import { verifyTurnstile } from './_lib/turnstile.js';
import { generateSixDigitCode, hashCode, maskEmail, getClientIp, getUserAgent } from './_lib/verification.js';
import { sendEmail } from './_lib/resend.js';
import { logVoterEvent } from './_lib/voterAuditLog.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CODE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_REQUESTS_PER_HOUR = 3;
const MAX_CODES_BEFORE_LOCK = 2; // 1 initial + 1 replacement

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

  const { election_id, computer_number, turnstileToken } = req.body || {};
  if (!election_id || !computer_number) {
    return res.status(400).json({ error: 'election_id and computer_number are required' });
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

  const { data: election } = await admin
    .from('elections')
    .select('id, status, online_voting_enabled')
    .eq('id', election_id)
    .single();
  if (!election || !election.online_voting_enabled || election.status !== 'open') {
    return res.status(200).json({ status: 'election_closed' });
  }

  // Rate limit: max 3 requests/hour for this computer number, regardless of
  // whether it matches a real voter — this also throttles roster-guessing.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentRequests } = await admin
    .from('voter_audit_log')
    .select('id', { count: 'exact', head: true })
    .eq('election_id', election_id)
    .eq('computer_number', computerNumber)
    .eq('event_type', 'code_requested')
    .gte('created_date', oneHourAgo);
  if ((recentRequests || 0) >= MAX_REQUESTS_PER_HOUR) {
    return res.status(429).json({ status: 'rate_limited', error: 'Too many requests. Please try again later.' });
  }

  await logVoterEvent(admin, { electionId: election_id, computerNumber, eventType: 'code_requested', ipAddress: ip, userAgent });

  const { data: student } = await admin
    .from('students')
    .select('id, email, has_voted')
    .eq('election_id', election_id)
    .eq('computer_number', computerNumber)
    .maybeSingle();

  if (!student) {
    return res.status(200).json({ status: 'not_found' });
  }
  if (!student.email) {
    return res.status(200).json({ status: 'no_email' });
  }
  if (student.has_voted) {
    return res.status(200).json({ status: 'already_voted' });
  }

  // Lock check: count codes issued since the last admin reset.
  const { data: lastReset } = await admin
    .from('voter_audit_log')
    .select('created_date')
    .eq('election_id', election_id)
    .eq('computer_number', computerNumber)
    .eq('event_type', 'admin_reset')
    .order('created_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  let codesQuery = admin
    .from('verification_codes')
    .select('id, expires_at, used_at, replacements_used', { count: 'exact' })
    .eq('election_id', election_id)
    .eq('computer_number', computerNumber);
  if (lastReset) codesQuery = codesQuery.gte('created_date', lastReset.created_date);
  const { data: priorCodes, count: priorCount } = await codesQuery;

  if ((priorCount || 0) >= MAX_CODES_BEFORE_LOCK) {
    await logVoterEvent(admin, { electionId: election_id, computerNumber, eventType: 'locked', ipAddress: ip, userAgent });
    return res.status(200).json({ status: 'locked' });
  }

  // Invalidate any still-active code before issuing the new one (the "one
  // replacement cancels the old" rule).
  const activeCode = (priorCodes || []).find((c) => !c.used_at && new Date(c.expires_at) > new Date());
  if (activeCode) {
    await admin.from('verification_codes').update({ expires_at: new Date().toISOString() }).eq('id', activeCode.id);
  }

  const code = generateSixDigitCode();
  const replacementsUsed = priorCount || 0; // 0 for the first code, 1 for the one allowed replacement
  const { error: insertError } = await admin.from('verification_codes').insert({
    election_id,
    computer_number: computerNumber,
    code_hash: hashCode(code),
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    replacements_used: replacementsUsed,
  });
  if (insertError) {
    return res.status(500).json({ error: 'Failed to generate code' });
  }

  const masked = maskEmail(student.email);
  const { data: electionName } = await admin.from('elections').select('name').eq('id', election_id).single();

  const sendResult = await sendEmail({
    to: student.email,
    subject: `Your voting code for ${electionName?.name || 'the election'}`,
    text: `Your one-time voting code is: ${code}\n\nThis code is valid for 2 hours and can only be used once. If you did not request this code, you can safely ignore this email.`,
    html: `<p>Your one-time voting code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px;">${code}</p><p>This code is valid for 2 hours and can only be used once. If you did not request this code, you can safely ignore this email.</p>`,
  });

  await logVoterEvent(admin, {
    electionId: election_id,
    computerNumber,
    eventType: sendResult.success ? 'code_emailed' : 'code_failed_to_send',
    maskedEmail: masked,
    ipAddress: ip,
    userAgent,
    reason: sendResult.success ? null : sendResult.error,
  });

  if (!sendResult.success) {
    return res.status(502).json({ status: 'send_failed', error: 'Could not send the code email. Please try again shortly.' });
  }

  return res.status(200).json({ status: 'sent', masked_email: masked });
}
