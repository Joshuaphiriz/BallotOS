// Append-only log of verification/voting events. Deliberately carries no
// column that also exists on `votes` (no ballot id, no selections) — this
// table records WHO/WHEN/HOW, never HOW SOMEONE VOTED.
export async function logVoterEvent(admin, {
  electionId,
  computerNumber = null,
  eventType,
  maskedEmail = null,
  ipAddress = null,
  userAgent = null,
  adminUserId = null,
  reason = null,
}) {
  const { error } = await admin.from('voter_audit_log').insert({
    election_id: electionId,
    computer_number: computerNumber,
    event_type: eventType,
    masked_email: maskedEmail,
    ip_address: ipAddress,
    user_agent: userAgent,
    admin_user_id: adminUserId,
    reason,
  });
  // Never let a logging failure break the caller's main flow — just surface
  // it to the server console (not to the client, not to any audit row).
  if (error) console.error('voter_audit_log insert failed:', error.message);
}
