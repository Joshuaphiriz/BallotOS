// Vercel serverless function — POST /api/check-eligibility
// Public, no login. Never exposes the roster — only tells the caller the
// status for the one computer number they provided.
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

  const { election_id, computer_number, turnstileToken } = req.body || {};
  if (!election_id || !computer_number) {
    return res.status(400).json({ error: 'election_id and computer_number are required' });
  }

  const captcha = await verifyTurnstile(turnstileToken, req.headers['x-forwarded-for']);
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

  const { data: student } = await admin
    .from('students')
    .select('id, full_name, computer_number, has_voted')
    .eq('election_id', election_id)
    .eq('computer_number', computer_number.trim())
    .maybeSingle();

  if (!student) {
    return res.status(200).json({ status: 'not_found' });
  }
  if (student.has_voted) {
    return res.status(200).json({ status: 'already_voted' });
  }

  return res.status(200).json({
    status: 'eligible',
    student: { id: student.id, full_name: student.full_name, computer_number: student.computer_number },
  });
}
