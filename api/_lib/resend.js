// Thin wrapper around the Resend HTTP API — no SDK dependency needed, same
// plain-fetch style as _lib/turnstile.js. RESEND_API_KEY is server-only.
const FROM = 'BallotOS <noreply@ballotoszm.com>';
const REPLY_TO = 'alerts@ballotoszm.com';

export async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'Resend is not configured on the server' };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM, reply_to: REPLY_TO, to: [to], subject, html, text }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { success: false, error: body.message || `Resend responded ${res.status}` };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message || 'Network error sending email' };
  }
}
