// Vercel serverless function — POST /api/delete-user
// Fully removes a user: deletes their Supabase Auth account, which cascades
// (via the users.id -> auth.users.id foreign key with ON DELETE CASCADE) to
// remove their public.users profile row automatically. Deleting only the
// profile row (what the browser's anon key can do) leaves an orphaned auth
// account behind, which then blocks re-inviting that same email.
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
    return res.status(403).json({ error: 'Only admins can remove users' });
  }

  const { userId } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  if (userId === callerData.user.id) {
    return res.status(400).json({ error: 'You cannot remove your own account. Ask another admin to do it.' });
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(200).json({ deleted: true });
}