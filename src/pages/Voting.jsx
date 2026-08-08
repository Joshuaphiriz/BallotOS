import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { MonitorSmartphone, ShieldOff, CalendarClock, Vote as VoteIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import VerifyStudent from '@/components/voting/VerifyStudent';
import Ballot from '@/components/voting/Ballot';
import VoteSuccess from '@/components/voting/VoteSuccess';
import Loader from '@/components/ems/Loader';
import { getActiveElection, applyTheme, getStation, logAudit } from '@/lib/ems';
import { useToast } from '@/components/ui/use-toast';

// PUBLIC route — voters never log in. The polling assistant's session (already
// authenticated on this PC) powers the API calls. A station must be active.
export default function Voting() {
  const [election, setElection] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [station, setStationState] = useState(() => getStation());
  const [stage, setStage] = useState('verify');
  const [student, setStudent] = useState(null);
  const [data, setData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    getActiveElection().then((e) => { setElection(e); applyTheme(e); }).finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!election) return;
    Promise.all([
      base44.entities.Position.filter({ election_id: election.id }, 'order'),
      base44.entities.Candidate.filter({ election_id: election.id }, '-created_date', 500),
    ]).then(([positions, candidates]) => setData({ positions, candidates }));
  }, [election]);

  if (!loaded) return <Loader label="Loading election" />;

  if (!election) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50 dark:bg-slate-950 px-6">
        <div className="text-center max-w-sm">
          <div className="mx-auto h-16 w-16 rounded-2xl grid place-items-center bg-slate-200 dark:bg-slate-800 text-slate-500">
            <VoteIcon className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-xl font-semibold text-slate-900 dark:text-white">No election available</h1>
          <p className="mt-2 text-sm text-slate-500">There is no active election configured yet. Please check back later or contact the administrator.</p>
        </div>
      </div>
    );
  }

  if (election.status !== 'open') {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50 dark:bg-slate-950 px-6">
        <div className="text-center max-w-sm">
          <div className="mx-auto h-16 w-16 rounded-2xl grid place-items-center bg-slate-200 dark:bg-slate-800 text-slate-500">
            <CalendarClock className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-xl font-semibold text-slate-900 dark:text-white">
            {election.status === 'draft' ? 'Voting has not started' : 'Voting is closed'}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {election.status === 'draft'
              ? 'The election is still being prepared. Please check back once polling opens.'
              : 'This election has concluded. Thank you for participating.'}
          </p>
        </div>
      </div>
    );
  }

  // No station activated on this PC — voter cannot proceed.
  if (!station) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50 dark:bg-slate-950 px-6">
        <div className="text-center max-w-sm">
          <div className="mx-auto h-16 w-16 rounded-2xl grid place-items-center bg-slate-200 dark:bg-slate-800 text-slate-500">
            <ShieldOff className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-xl font-semibold text-slate-900 dark:text-white">This station is not ready</h1>
          <p className="mt-2 text-sm text-slate-500">A polling assistant must sign in and activate this computer before voting can begin.</p>
          <p className="mt-4 text-xs text-slate-400 flex items-center justify-center gap-1.5"><MonitorSmartphone className="h-3.5 w-3.5" /> Contact the election officer on duty.</p>
          <Link to="/station-setup" className="mt-6 inline-block text-sm font-medium underline" style={{ color: 'var(--ems-primary)' }}>Activate a station →</Link>
        </div>
      </div>
    );
  }

  if (!data) return <Loader label="Preparing the ballot" />;

  const submit = async (selections) => {
    setSubmitting(true);
    // Re-check eligibility right before recording — prevents a double submit.
    const fresh = await base44.entities.Student.filter({ id: student.id });
    if (fresh[0]?.has_voted) {
      toast({ title: 'Already voted', description: 'This computer number has already cast a ballot.', variant: 'destructive' });
      setSubmitting(false); setStage('verify'); return;
    }
    const rows = Object.entries(selections).map(([position_id, candidate_id]) => ({
      position_id,
      position_title: data.positions.find(p => p.id === position_id)?.title,
      candidate_id,
      candidate_name: data.candidates.find(c => c.id === candidate_id)?.full_name,
    }));
    await base44.entities.Vote.create({
      election_id: election.id, student_id: student.id, computer_number: student.computer_number,
      station_name: station.name, selections: rows,
    });
    await base44.entities.Student.update(student.id, { has_voted: true, voted_at: new Date().toISOString() });
    await base44.entities.VotingStation.update(station.id, {
      votes_processed: (await base44.entities.VotingStation.filter({ id: station.id }))[0]?.votes_processed + 1,
      last_activity: new Date().toISOString(),
    });
    await logAudit(`Vote submitted by ${student.computer_number}`, 'vote', `Station: ${station.name}`, election.id);
    setSubmitting(false);
    setStage('success');
  };

  if (stage === 'verify') return <Fullscreen election={election}><VerifyStudent election={election} onVerified={(s) => { setStudent(s); setStage('ballot'); }} /></Fullscreen>;
  if (stage === 'ballot') return <Fullscreen election={election}><Ballot election={election} student={student} positions={data.positions} candidates={data.candidates} onSubmit={submit} submitting={submitting} /></Fullscreen>;
  return <Fullscreen election={election}><VoteSuccess onDone={() => { setStudent(null); setStage('verify'); }} /></Fullscreen>;
}

function Fullscreen({ election, children }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-4xl px-6 py-8">{children}</div>
    </div>
  );
}