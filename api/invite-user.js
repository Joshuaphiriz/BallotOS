// Vercel serverless function — POST /api/invite-user
// Uses the Supabase service role key to invite a new user by email.
// The service role key must ONLY ever be set as a server-side env var
// (SUPABASE_SERVICE_ROLE_KEY) — never prefix it with VITE_ or it will be
// bundled into the browser build.
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
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

  // Verify the caller is a signed-in admin before inviting anyone.
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
    return res.status(403).json({ error: 'Only admins can invite users' });
  }

  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${req.headers.origin || ''}/reset-password`,
  });
  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(200).json({ id: data.user.id, email: data.user.email });
}