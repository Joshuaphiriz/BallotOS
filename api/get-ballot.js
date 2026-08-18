// Vercel serverless function — GET /api/get-ballot?election=<id>
// Public, no login. Returns only what a voter needs to see a ballot — never
// the student roster, never anything beyond this one election, and never
// anything at all unless that election has online voting explicitly enabled
// by an admin and is currently open.
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server is missing Supabase service role configuration' });
  }

  const electionId = req.query.election;
  if (!electionId) {
    return res.status(400).json({ error: 'election is required' });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: election, error: electionError } = await admin
    .from('elections')
    .select('id, name, association_name, association_abbr, logo_url, primary_color, secondary_color, accent_color, status, online_voting_enabled')
    .eq('id', electionId)
    .single();

  if (electionError || !election) {
    return res.status(404).json({ error: 'Election not found' });
  }
  if (!election.online_voting_enabled) {
    return res.status(403).json({ error: 'Online voting is not enabled for this election' });
  }
  if (election.status !== 'open') {
    return res.status(403).json({ error: 'This election is not currently open for voting', status: election.status });
  }

  const [{ data: positions, error: posError }, { data: candidates, error: candError }] = await Promise.all([
    admin.from('positions').select('id, title, description, order, max_selections').eq('election_id', electionId).order('order'),
    admin.from('candidates').select('id, position_id, full_name, aka, photo_url, biography, manifesto').eq('election_id', electionId),
  ]);
  if (posError || candError) {
    return res.status(500).json({ error: 'Failed to load ballot' });
  }

  return res.status(200).json({ election, positions, candidates });
}
