// Shared by request-code.js, verify-code.js and cast-vote.js.
//
// Two server-only secrets (never sent to the browser, never logged):
//   CODE_PEPPER      — mixed into the one-time code before hashing, so a
//                       leaked code_hash column alone can't be brute-forced
//                       offline without also having this secret.
//   VOTE_PASS_SECRET — HMAC key for the short-lived voting pass issued after
//                       a code is verified.
import crypto from 'node:crypto';

function requireSecret(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured on the server`);
  return value;
}

export function generateSixDigitCode() {
  // crypto.randomInt is uniform and cryptographically secure, unlike Math.random().
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashCode(code) {
  const pepper = requireSecret('CODE_PEPPER');
  return crypto.createHash('sha256').update(`${code}${pepper}`).digest('hex');
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

const VOTE_PASS_TTL_MS = 15 * 60 * 1000;

// Stateless signed pass — nothing is stored server-side. Binds the pass to
// one election + one computer number so it can't be replayed for a
// different voter or a different election.
export function issueVotingPass({ electionId, computerNumber }) {
  const secret = requireSecret('VOTE_PASS_SECRET');
  const payload = {
    election_id: electionId,
    computer_number: computerNumber,
    exp: Date.now() + VOTE_PASS_TTL_MS,
  };
  const payloadB64 = base64url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `${payloadB64}.${signature}`;
}

// Returns { election_id, computer_number } on success, or null if the pass
// is missing, malformed, expired, or the signature doesn't match.
export function verifyVotingPass(token) {
  const secret = requireSecret('VOTE_PASS_SECRET');
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payloadB64, signature] = token.split('.');
  const expected = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  const sigBuf = Buffer.from(signature || '');
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!payload.election_id || !payload.computer_number || typeof payload.exp !== 'number') return null;
  if (Date.now() > payload.exp) return null;
  return { election_id: payload.election_id, computer_number: payload.computer_number };
}

// "j****@domain.com" — reveals just enough for the voter to recognize their
// own inbox without exposing the full address in a response or log.
export function maskEmail(email) {
  const at = email.indexOf('@');
  if (at <= 0) return '****';
  return `${email[0]}****${email.slice(at)}`;
}

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers['x-real-ip'] || null;
}

export function getUserAgent(req) {
  return req.headers['user-agent'] || null;
}
