// Shared by check-eligibility.js and cast-vote.js. Verifies a Cloudflare
// Turnstile token server-side — this is the real anti-bot check; the widget
// in the browser only produces the token, it proves nothing on its own.
export async function verifyTurnstile(token, remoteIp) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // Fail closed: if the server isn't configured, don't silently allow.
    return { success: false, reason: 'Turnstile is not configured on the server' };
  }
  if (!token) {
    return { success: false, reason: 'Missing verification token' };
  }

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.append('remoteip', remoteIp);

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  return { success: !!data.success, reason: data.success ? null : 'Verification failed' };
}
