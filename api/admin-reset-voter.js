// Vercel serverless function — POST /api/admin-reset-voter
// Admin-only (requires a signed-in admin's Supabase session token, same
// pattern as invite-user.js). Clears a locked voter so they can request a
// fresh code. Does NOT touch an already-cast ballot or un-vote anyone —
// that would undermine the atomic double-vote prevention cast_ballot()
// relies on, and there is no column linking a ballot back to a voter to
// safely reverse anyway. Every reset is logged with the admin's id and a
// required reason.
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server is missing Supabase service role configuration' });
  }

  const authHeader = req.headers.authorization || '';
  const callerToken = authHeader.replace('Bearer ', '');
  if (!callerToken) {
    return res.status(401).json({ error: 'Missing auth token' });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: callerData, error: callerError } = await admin.auth.getUser(callerToken);
  if (callerError || !callerData?.user) {
    return res.status(401).json({ error: 'Invalid session' });
  }
  const { data: callerProfile } = await admin
    .from('users')
    .select('ems_role')
    .eq('id', callerData.user.id)
    .single();
  if (callerProfile?.ems_role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can reset a voter' });
  }

  const { election_id, computer_number, reason } = req.body || {};
  if (!election_id || !computer_number || !reason?.trim()) {
    return res.status(400).json({ error: 'election_id, computer_number and reason are required' });
  }
  const computerNumber = computer_number.trim();

  const { data: student } = await admin
    .from('students')
    .select('id, has_voted')
    .eq('election_id', election_id)
    .eq('computer_number', computerNumber)
    .maybeSingle();
  if (!student) {
    return res.status(404).json({ error: 'No voter found with that computer number' });
  }
  if (student.has_voted) {
    return res.status(400).json({ error: 'This computer number has already cast a ballot and cannot be reset' });
  }

  const { error: logError } = await admin.from('voter_audit_log').insert({
    election_id,
    computer_number: computerNumber,
    event_type: 'admin_reset',
    admin_user_id: callerData.user.id,
    reason: reason.trim(),
  });
  if (logError) {
    return res.status(500).json({ error: 'Failed to record reset' });
  }

  return res.status(200).json({ success: true });
}
