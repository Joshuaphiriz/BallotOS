// Vercel serverless function — POST /api/cast-vote
// Public, no login. This is the sensitive write, so everything is
// re-verified here independently — never trust that check-eligibility
// already ran. The has_voted claim is a single atomic UPDATE ... WHERE
// has_voted = false, so two simultaneous requests for the same computer
// number can never both succeed, no matter how they're timed.
import { createClient } from '@supabase/supabase-js';
import { verifyTurnstile } from './_lib/turnstile.js';

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

  const { election_id, student_id, selections, turnstileToken } = req.body || {};
  if (!election_id || !student_id || !selections || typeof selections !== 'object') {
    return res.status(400).json({ error: 'election_id, student_id and selections are required' });
  }

  const captcha = await verifyTurnstile(turnstileToken, req.headers['x-forwarded-for']);
  if (!captcha.success) {
    return res.status(400).json({ error: captcha.reason || 'Verification failed' });
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
    return res.status(403).json({ error: 'This election is not open for online voting' });
  }

  const [{ data: positions }, { data: candidates }] = await Promise.all([
    admin.from('positions').select('id, title').eq('election_id', election_id),
    admin.from('candidates').select('id, position_id, full_name').eq('election_id', election_id),
  ]);

  // Validate every submitted position/candidate actually belongs to this
  // election — never trust IDs supplied by the client as-is.
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
  if (!rows.length) {
    return res.status(400).json({ error: 'No selections submitted' });
  }

  // Atomic claim: only succeeds if this student hadn't already voted.
  const { data: claimed, error: claimError } = await admin
    .from('students')
    .update({ has_voted: true, voted_at: new Date().toISOString() })
    .eq('id', student_id)
    .eq('election_id', election_id)
    .eq('has_voted', false)
    .select('id, computer_number')
    .maybeSingle();

  if (claimError) {
    return res.status(500).json({ error: 'Failed to record vote' });
  }
  if (!claimed) {
    return res.status(409).json({ error: 'This computer number has already voted' });
  }

  const { error: voteError } = await admin.from('votes').insert({
    election_id,
    student_id: claimed.id,
    computer_number: claimed.computer_number,
    station_name: 'Online',
    channel: 'online',
    selections: rows,
  });
  if (voteError) {
    return res.status(500).json({ error: 'Failed to record vote' });
  }

  await admin.from('audit_logs').insert({
    election_id,
    actor: 'system',
    action: `Online vote submitted by ${claimed.computer_number}`,
    category: 'vote',
  });

  return res.status(200).json({ success: true });
}
