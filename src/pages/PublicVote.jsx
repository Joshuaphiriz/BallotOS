import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, ShieldAlert, ShieldCheck, Vote as VoteIcon, CalendarClock } from 'lucide-react';
import { motion } from 'framer-motion';
import Ballot from '@/components/voting/Ballot';
import PublicVoteSuccess from '@/components/voting/PublicVoteSuccess';
import Turnstile from '@/components/voting/Turnstile';
import Loader from '@/components/ems/Loader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { applyTheme } from '@/lib/ems';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

// PUBLIC route — /vote?election=<id> — no login, no admin chrome. Every
// write goes through cast-vote.js / check-eligibility.js (service role,
// server-side validated) — this page never talks to Supabase directly.
export default function PublicVote() {
  const [searchParams] = useSearchParams();
  const electionId = searchParams.get('election');

  const [loaded, setLoaded] = useState(false);
  const [ballot, setBallot] = useState(null); // { election, positions, candidates }
  const [loadError, setLoadError] = useState(null);

  const [stage, setStage] = useState('entry'); // entry | ballot | success
  const [number, setNumber] = useState('');
  const [turnstileToken, setTurnstileToken] = useState(null);
  const [checking, setChecking] = useState(false);
  const [eligibility, setEligibility] = useState(null); // { status, student? }
  const [student, setStudent] = useState(null);
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
    setNumber(''); setTurnstileToken(null); setEligibility(null); setStudent(null);
    setSubmitError(''); setStage('entry');
  };

  const checkEligibility = async (e) => {
    e.preventDefault();
    if (!number.trim() || !turnstileToken) return;
    setChecking(true);
    setEligibility(null);
    try {
      const res = await fetch(`${API_BASE}/api/check-eligibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ election_id: electionId, computer_number: number.trim(), turnstileToken }),
      });
      const body = await res.json();
      setEligibility(body);
    } catch {
      setEligibility({ status: 'error' });
    }
    setChecking(false);
  };

  const startVoting = () => {
    setStudent(eligibility.student);
    setStage('ballot');
  };

  const submitVote = async (selections) => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch(`${API_BASE}/api/cast-vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ election_id: electionId, student_id: student.id, selections, turnstileToken }),
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
        <Ballot election={election} student={student} positions={positions} candidates={candidates} onSubmit={submitVote} submitting={submitting} />
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

        <form onSubmit={checkEligibility} className="space-y-4">
          <Input
            autoFocus
            value={number}
            onChange={(e) => { setNumber(e.target.value); setEligibility(null); }}
            placeholder="Computer number"
            className="rounded-xl h-14 text-lg font-mono text-center"
          />
          <Turnstile onVerify={setTurnstileToken} onExpire={() => setTurnstileToken(null)} />
          <Button type="submit" disabled={checking || !number.trim() || !turnstileToken} className="w-full rounded-xl h-14 text-base" style={{ background: 'var(--ems-primary)' }}>
            <Search className="h-5 w-5 mr-2" />{checking ? 'Checking…' : 'Check eligibility'}
          </Button>
        </form>

        {eligibility?.status === 'not_found' && (
          <StatusCard icon={ShieldAlert} tone="red" title="Not on the voter roll" desc={`No student found with computer number ${number}.`} />
        )}
        {eligibility?.status === 'already_voted' && (
          <StatusCard icon={ShieldAlert} tone="red" title="Already voted" desc="This computer number has already cast a ballot." />
        )}
        {eligibility?.status === 'election_closed' && (
          <StatusCard icon={CalendarClock} tone="red" title="Voting is closed" desc="This election is no longer accepting votes." />
        )}
        {eligibility?.status === 'captcha_failed' && (
          <StatusCard icon={ShieldAlert} tone="red" title="Verification failed" desc="Please complete the verification and try again." />
        )}
        {eligibility?.status === 'error' && (
          <StatusCard icon={ShieldAlert} tone="red" title="Something went wrong" desc="Please check your connection and try again." />
        )}

        {eligibility?.status === 'eligible' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center">
            <ShieldCheck className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--ems-primary)' }} />
            <p className="font-medium text-slate-900 dark:text-white">Welcome, {eligibility.student.full_name}</p>
            <p className="text-sm text-slate-500">Computer number {eligibility.student.computer_number}</p>
            <Button onClick={startVoting} className="mt-4 rounded-xl h-12 px-8 text-base" style={{ background: 'var(--ems-primary)' }}>
              <VoteIcon className="h-4 w-4 mr-2" />Start Voting
            </Button>
          </motion.div>
        )}
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-4xl px-6 py-8">{children}</div>
    </div>
  );
}
