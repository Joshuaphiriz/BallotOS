// Vercel serverless function — POST /api/cast-vote
// Public, no login. Requires a voting pass issued by verify-code.js (proof a
// one-time emailed code was already checked) — a computer number alone is
// no longer enough to vote. The election_id/computer_number used for the
// atomic claim come ONLY from the verified pass, never from the request
// body, so a tampered body can't target a different voter or election.
import { createClient } from '@supabase/supabase-js';
import { verifyTurnstile } from './_lib/turnstile.js';
import { verifyVotingPass, getClientIp, getUserAgent } from './_lib/verification.js';
import { sendEmail } from './_lib/resend.js';
import { logVoterEvent } from './_lib/voterAuditLog.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

  const { vote_pass, selections, turnstileToken } = req.body || {};
  if (!vote_pass || !selections || typeof selections !== 'object') {
    return res.status(400).json({ error: 'vote_pass and selections are required' });
  }

  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);

  const captcha = await verifyTurnstile(turnstileToken, ip);
  if (!captcha.success) {
    return res.status(400).json({ error: captcha.reason || 'Verification failed' });
  }

  const pass = verifyVotingPass(vote_pass);
  if (!pass) {
    return res.status(401).json({ error: 'Your voting session has expired. Please request a new code and try again.' });
  }
  const { election_id, computer_number } = pass;

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: election } = await admin
    .from('elections')
    .select('id, name, status, online_voting_enabled')
    .eq('id', election_id)
    .single();
  if (!election || !election.online_voting_enabled || election.status !== 'open') {
    return res.status(403).json({ error: 'This election is not open for online voting' });
  }

  const [{ data: positions }, { data: candidates }] = await Promise.all([
    admin.from('positions').select('id, title').eq('election_id', election_id),
    admin.from('candidates').select('id, position_id, full_name').eq('election_id', election_id),
  ]);

  // Require a complete ballot — a selection for every contested position.
  // Partial submissions are never accepted as final (see cast_ballot(): the
  // claim + insert happen in one transaction, so there's no half-recorded
  // state to clean up afterward either).
  const contestedPositions = positions.filter((p) => candidates.some((c) => c.position_id === p.id));
  const rows = [];
  for (const [positionId, candidateId] of Object.entries(selections)) {
    const position = positions.find((p) => p.id === positionId);
    const candidate = candidates.find((c) => c.id === candidateId && c.position_id === positionId);
    if (!position || !candidate) {
      return res.status(400).json({ error: 'Invalid ballot selection' });
    }
    rows.push({
      position_id: position.id,
      position_title: position.title,
      candidate_id: candidate.id,
      candidate_name: candidate.full_name,
    });
  }
  if (rows.length !== contestedPositions.length) {
    return res.status(400).json({ error: 'Please make a selection for every position before submitting.' });
  }

  const { error: castError } = await admin.rpc('cast_ballot', {
    p_election_id: election_id,
    p_computer_number: computer_number,
    p_selections: rows,
  });

  if (castError) {
    if (castError.message?.includes('ALREADY_VOTED')) {
      return res.status(409).json({ error: 'This computer number has already voted' });
    }
    return res.status(500).json({ error: 'Failed to record vote' });
  }

  await logVoterEvent(admin, { electionId: election_id, computerNumber: computer_number, eventType: 'ballot_cast', ipAddress: ip, userAgent });

  // Confirmation email — looked up fresh from students by computer number,
  // never from the vote itself (the vote carries no voter-identifying
  // column). A failed send must never block or roll back the vote above.
  const { data: student } = await admin
    .from('students')
    .select('email')
    .eq('election_id', election_id)
    .eq('computer_number', computer_number)
    .maybeSingle();

  if (student?.email) {
    const castAt = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
    const sendResult = await sendEmail({
      to: student.email,
      subject: `Ballot confirmation — ${election.name}`,
      text: `A ballot was cast under your student number in ${election.name} at ${castAt}. If this was not you, reply to alerts@ballotoszm.com immediately.`,
      html: `<p>A ballot was cast under your student number in <strong>${election.name}</strong> at ${castAt}.</p><p>If this was not you, reply to alerts@ballotoszm.com immediately.</p>`,
    });
    await logVoterEvent(admin, {
      electionId: election_id,
      computerNumber: computer_number,
      eventType: sendResult.success ? 'ballot_notice_sent' : 'ballot_notice_failed',
      ipAddress: ip,
      userAgent,
      reason: sendResult.success ? null : sendResult.error,
    });
  }

  return res.status(200).json({ success: true });
}
