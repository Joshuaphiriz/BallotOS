import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, ShieldAlert, CalendarClock, MailCheck, Lock } from 'lucide-react';
import Ballot from '@/components/voting/Ballot';
import PublicVoteSuccess from '@/components/voting/PublicVoteSuccess';
import Turnstile from '@/components/voting/Turnstile';
import Loader from '@/components/ems/Loader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { applyTheme } from '@/lib/ems';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

// Kept as a single exported constant so it's easy to find and edit later —
// this is plain-language guidance for a student/association election, not
// legal boilerplate.
export const TERMS_AND_CONDITIONS = `By voting online, you agree to the following:

1. One vote per eligible person. Your computer number may only be used to cast a single ballot in this election.
2. Votes are final. Once submitted, your vote cannot be changed, withdrawn, or resubmitted.
3. A one-time code will be emailed to the address on file for your computer number, to confirm it's really you.
4. In the event of a dispute, the verification record (not your ballot) may be reviewed by election administrators.

If you do not agree with the above, please do not proceed with online voting.`;

const ENTRY_MESSAGES = {
  not_found: ['Not on the voter roll', (n) => `No student found with computer number ${n}.`],
  no_email: ['No email on file', () => 'Your computer number is registered but has no email on file. Please contact the election team.'],
  already_voted: ['Already voted', () => 'This computer number has already cast a ballot.'],
  locked: ['Locked', () => 'Too many code attempts. Please contact the election team to have this computer number reset.'],
  election_closed: ['Voting is closed', () => 'This election is no longer accepting votes.'],
  captcha_failed: ['Verification failed', () => 'Please complete the verification and try again.'],
  rate_limited: ['Too many requests', () => 'Please wait a while before requesting another code.'],
  send_failed: ['Could not send code', () => 'We could not email your code just now. Please try again shortly.'],
  error: ['Something went wrong', () => 'Please check your connection and try again.'],
};

const CODE_MESSAGES = {
  wrong_code: (body) => `Incorrect code. ${body.attempts_remaining ?? 0} attempt${body.attempts_remaining === 1 ? '' : 's'} remaining.`,
  invalidated: () => 'Too many incorrect attempts — this code is no longer valid. Request a new one below.',
  expired: () => 'This code has expired. Request a new one below.',
  no_active_code: () => 'No active code found. Request a new one below.',
  captcha_failed: () => 'Please complete the verification and try again.',
  error: () => 'Please check your connection and try again.',
};

// PUBLIC route — /vote-online?election=<id> — no login, no admin chrome.
// Every write goes through request-code.js / verify-code.js / cast-vote.js
// (service role, server-side validated) — this page never talks to
// Supabase directly. A computer number alone is no longer enough to vote:
// a one-time code emailed to the address on file must be verified first.
export default function PublicVote() {
  const [searchParams] = useSearchParams();
  const electionId = searchParams.get('election');

  const [loaded, setLoaded] = useState(false);
  const [ballot, setBallot] = useState(null); // { election, positions, candidates }
  const [loadError, setLoadError] = useState(null);

  const [stage, setStage] = useState('entry'); // entry | code | ballot | success
  const [number, setNumber] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [entryToken, setEntryToken] = useState(null);
  const [codeToken, setCodeToken] = useState(null);
  const [voteToken, setVoteToken] = useState(null); // separate token per step — Turnstile tokens are single-use
  const [requesting, setRequesting] = useState(false);
  const [entryStatus, setEntryStatus] = useState(null); // { status, masked_email? }
  const [maskedEmail, setMaskedEmail] = useState('');
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [codeStatus, setCodeStatus] = useState(null);
  const [votePass, setVotePass] = useState(null);
  const [fullName, setFullName] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!electionId) { setLoadError('missing'); setLoaded(true); return; }
    fetch(`${API_BASE}/api/get-ballot?election=${encodeURIComponent(electionId)}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) { setLoadError(body.status || 'unavailable'); return; }
        setBallot(body);
        applyTheme(body.election);
      })
      .catch(() => setLoadError('unavailable'))
      .finally(() => setLoaded(true));
  }, [electionId]);

  const resetEntry = () => {
    setNumber(''); setAgreedToTerms(false); setEntryToken(null); setCodeToken(null); setVoteToken(null);
    setEntryStatus(null); setMaskedEmail(''); setCode(''); setCodeStatus(null); setVotePass(null); setFullName(null);
    setSubmitError(''); setStage('entry');
  };

  const requestCode = async (e) => {
    e.preventDefault();
    if (!number.trim() || !entryToken || !agreedToTerms) return;
    setRequesting(true);
    setEntryStatus(null);
    try {
      const res = await fetch(`${API_BASE}/api/request-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ election_id: electionId, computer_number: number.trim(), turnstileToken: entryToken }),
      });
      const body = await res.json();
      if (body.status === 'sent') {
        setMaskedEmail(body.masked_email || '');
        setCodeStatus(null);
        setStage('code');
      } else {
        setEntryStatus(body);
      }
    } catch {
      setEntryStatus({ status: 'error' });
    }
    setEntryToken(null);
    setRequesting(false);
  };

  const requestReplacementCode = async () => {
    // Same endpoint, same number — request-code.js handles the "one
    // replacement cancels the old code" rule server-side.
    if (!codeToken) return;
    setRequesting(true);
    try {
      const res = await fetch(`${API_BASE}/api/request-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ election_id: electionId, computer_number: number.trim(), turnstileToken: codeToken }),
      });
      const body = await res.json();
      if (body.status === 'sent') {
        setMaskedEmail(body.masked_email || maskedEmail);
        setCodeStatus(null);
      } else if (body.status === 'locked') {
        setStage('entry');
        setEntryStatus(body);
      } else {
        setCodeStatus({ status: 'error' });
      }
    } catch {
      setCodeStatus({ status: 'error' });
    }
    setCodeToken(null);
    setRequesting(false);
  };

  const verifyCode = async (e) => {
    e.preventDefault();
    if (code.trim().length !== 6) return;
    setVerifying(true);
    setCodeStatus(null);
    try {
      const res = await fetch(`${API_BASE}/api/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ election_id: electionId, computer_number: number.trim(), code: code.trim() }),
      });
      const body = await res.json();
      if (body.status === 'accepted') {
        setVotePass(body.vote_pass);
        setFullName(body.full_name || null);
        setStage('ballot');
      } else {
        setCodeStatus(body);
      }
    } catch {
      setCodeStatus({ status: 'error' });
    }
    setCode('');
    setVerifying(false);
  };

  const submitVote = async (selections) => {
    if (!voteToken) {
      setSubmitError('Still verifying — please wait a moment and try submitting again.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch(`${API_BASE}/api/cast-vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote_pass: votePass, selections, turnstileToken: voteToken }),
      });
      const body = await res.json();
      if (!res.ok) {
        setSubmitError(body.error || 'Could not submit your vote. Please try again.');
        setSubmitting(false);
        return;
      }
      setStage('success');
    } catch {
      setSubmitError('Network error — please check your connection and try again.');
    }
    setSubmitting(false);
  };

  if (!loaded) return <div className="min-h-screen grid place-items-center"><Loader label="Loading ballot" /></div>;

  if (loadError) {
    const messages = {
      missing: ['No election specified', 'This link is missing an election. Please check the link and try again.'],
      not_enabled: ['Online voting not available', 'This election is not open for online voting.'],
      unavailable: ['Ballot unavailable', 'This voting link is not currently active. Please check back later or contact the election team.'],
    };
    const [title, desc] = messages[loadError] || messages.unavailable;
    return (
      <FullscreenPublic>
        <div className="text-center max-w-sm mx-auto py-24">
          <div className="mx-auto h-16 w-16 rounded-2xl grid place-items-center bg-slate-200 dark:bg-slate-800 text-slate-500">
            <CalendarClock className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-xl font-semibold text-slate-900 dark:text-white">{title}</h1>
          <p className="mt-2 text-sm text-slate-500">{desc}</p>
        </div>
      </FullscreenPublic>
    );
  }

  const { election, positions, candidates } = ballot;

  if (stage === 'ballot') {
    return (
      <FullscreenPublic>
        {/* Fresh Turnstile check for the actual vote submission — earlier
            tokens were already spent. Mounted as soon as the ballot loads
            so it has time to verify in the background while the voter is
            browsing candidates. */}
        <div className="max-w-md mx-auto mb-6 flex flex-col items-center gap-2">
          <p className="text-xs text-slate-400">Verifying your session…</p>
          <Turnstile onVerify={setVoteToken} onExpire={() => setVoteToken(null)} />
        </div>
        <Ballot election={election} student={{ full_name: fullName, computer_number: number }} positions={positions} candidates={candidates} onSubmit={submitVote} submitting={submitting} />
        {submitError && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
            {submitError}
          </div>
        )}
      </FullscreenPublic>
    );
  }

  if (stage === 'success') {
    return (
      <FullscreenPublic>
        <PublicVoteSuccess onDone={resetEntry} onVoteAgain={resetEntry} />
      </FullscreenPublic>
    );
  }

  if (stage === 'code') {
    return (
      <FullscreenPublic>
        <div className="max-w-md mx-auto py-10">
          <div className="text-center mb-8">
            <div className="h-16 w-16 rounded-2xl mx-auto grid place-items-center text-white" style={{ background: 'var(--ems-primary)' }}>
              <MailCheck className="h-7 w-7" />
            </div>
            <h1 className="mt-4 text-xl font-semibold text-slate-900 dark:text-white">Check your email</h1>
            <p className="text-slate-500 text-sm mt-1">We sent a 6-digit code to <span className="font-medium">{maskedEmail}</span></p>
          </div>

          <form onSubmit={verifyCode} className="space-y-4">
            <Input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit code"
              inputMode="numeric"
              className="rounded-xl h-14 text-2xl font-mono text-center tracking-[0.3em]"
            />
            <Button type="submit" disabled={verifying || code.length !== 6} className="w-full rounded-xl h-14 text-base" style={{ background: 'var(--ems-primary)' }}>
              {verifying ? 'Checking…' : 'Verify code'}
            </Button>
          </form>

          {codeStatus && (
            <StatusCard icon={ShieldAlert} tone="red" title="Code not accepted" desc={(CODE_MESSAGES[codeStatus.status] || CODE_MESSAGES.error)(codeStatus)} />
          )}

          {/* Turnstile only guards the replacement-code request below (it
              goes through request-code.js, same as the entry screen) — not
              the Verify button above, which needs no CAPTCHA of its own. */}
          <div className="mt-6 flex flex-col items-center gap-2">
            <Turnstile onVerify={setCodeToken} onExpire={() => setCodeToken(null)} />
            <button type="button" disabled={requesting || !codeToken} onClick={requestReplacementCode} className="text-sm text-slate-500 underline disabled:opacity-50">
              {requesting ? 'Sending…' : "Didn't get a code? Send a new one"}
            </button>
          </div>

          <div className="mt-2 text-center">
            <button type="button" onClick={resetEntry} className="text-xs text-slate-400 underline">Use a different computer number</button>
          </div>
        </div>
      </FullscreenPublic>
    );
  }

  // entry
  return (
    <FullscreenPublic>
      <div className="max-w-2xl mx-auto py-10">
        <div className="text-center mb-8">
          <div className="h-16 w-16 rounded-2xl mx-auto grid place-items-center text-white text-xl font-bold overflow-hidden" style={{ background: 'var(--ems-primary)' }}>
            {election.logo_url ? <img src={election.logo_url} alt="" className="h-full w-full object-cover" /> : (election.association_abbr || 'B').slice(0, 2)}
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-slate-900 dark:text-white">{election.name}</h1>
          <p className="text-slate-500">Enter your computer number to vote online</p>
        </div>

        <form onSubmit={requestCode} className="space-y-4">
          <Input
            autoFocus
            value={number}
            onChange={(e) => { setNumber(e.target.value); setEntryStatus(null); }}
            placeholder="Computer number"
            className="rounded-xl h-14 text-lg font-mono text-center"
          />
          <Turnstile onVerify={setEntryToken} onExpire={() => setEntryToken(null)} />

          <details className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-3 text-sm text-slate-500">
            <summary className="cursor-pointer font-medium text-slate-600 dark:text-slate-300">Terms &amp; Conditions</summary>
            <p className="mt-2 whitespace-pre-line">{TERMS_AND_CONDITIONS}</p>
          </details>
          <label className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
            <Checkbox checked={agreedToTerms} onCheckedChange={(v) => setAgreedToTerms(!!v)} className="mt-0.5" />
            I agree to the Terms &amp; Conditions
          </label>

          <Button type="submit" disabled={requesting || !number.trim() || !entryToken || !agreedToTerms} className="w-full rounded-xl h-14 text-base" style={{ background: 'var(--ems-primary)' }}>
            <Search className="h-5 w-5 mr-2" />{requesting ? 'Sending code…' : 'Send me a voting code'}
          </Button>
        </form>

        {entryStatus && (() => {
          const [title, descFn] = ENTRY_MESSAGES[entryStatus.status] || ENTRY_MESSAGES.error;
          const icon = entryStatus.status === 'locked' ? Lock : ShieldAlert;
          return <StatusCard icon={icon} tone="red" title={title} desc={descFn(number)} />;
        })()}
      </div>
    </FullscreenPublic>
  );
}

function StatusCard({ icon: Icon, tone, title, desc }) {
  const colors = tone === 'red' ? 'border-red-200 bg-red-50 dark:bg-red-950/30 text-red-800' : '';
  return (
    <div className={`mt-6 rounded-2xl border p-6 flex gap-4 ${colors}`}>
      <Icon className="h-6 w-6 text-red-600 shrink-0" />
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm opacity-80">{desc}</p>
      </div>
    </div>
  );
}

function FullscreenPublic({ children }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <div className="mx-auto max-w-4xl px-6 py-8 flex-1 w-full">{children}</div>
      <footer className="text-center text-xs text-slate-400 px-6 py-4">
        © {new Date().getFullYear()} BallotOS. All rights reserved. Developed by Joshua Phiri — phirijoshua784@gmail.com
      </footer>
    </div>
  );
}
