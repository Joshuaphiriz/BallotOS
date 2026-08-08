import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';

export default function VerifyStudent({ election, onVerified }) {
  const [number, setNumber] = useState('');
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(false);

  const search = async (e) => {
    e.preventDefault();
    if (!number.trim()) return;
    setLoading(true);
    const found = await base44.entities.Student.filter({ election_id: election.id, computer_number: number.trim() });
    setState(found[0] ? { student: found[0] } : { notFound: true });
    setLoading(false);
  };

  const reset = () => { setNumber(''); setState(null); };

  return (
    <div className="max-w-2xl mx-auto py-10">
      <div className="text-center mb-8">
        <div className="h-16 w-16 rounded-2xl mx-auto grid place-items-center text-white text-xl font-bold overflow-hidden" style={{ background: 'var(--ems-primary)' }}>
          {election.logo_url ? <img src={election.logo_url} alt="" className="h-full w-full object-cover" /> : (election.association_abbr || 'B').slice(0, 2)}
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-slate-900 dark:text-white">{election.name}</h1>
        <p className="text-slate-500">Enter the voter's computer number to verify eligibility</p>
      </div>

      <form onSubmit={search} className="flex gap-3">
        <Input autoFocus value={number} onChange={e => { setNumber(e.target.value); setState(null); }}
          placeholder="Computer number" className="rounded-xl h-14 text-lg font-mono" />
        <Button type="submit" disabled={loading} className="rounded-xl h-14 px-8 text-base" style={{ background: 'var(--ems-primary)' }}>
          <Search className="h-5 w-5 mr-2" />{loading ? 'Searching…' : 'Verify'}
        </Button>
      </form>

      {state?.notFound && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 dark:bg-red-950/30 p-6 flex gap-4">
          <ShieldAlert className="h-6 w-6 text-red-600 shrink-0" />
          <div><p className="font-medium text-red-800 dark:text-red-300">Not on the voter roll</p>
            <p className="text-sm text-red-700/80">No student found with computer number {number}.</p></div>
        </div>
      )}

      {state?.student && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            {[['Full Name', state.student.full_name], ['Computer Number', state.student.computer_number],
              ['Programme', state.student.programme || '—'], ['Year', state.student.year || '—'],
              ['Gender', state.student.gender || '—']].map(([k, v]) => (
              <div key={k}><p className="text-xs uppercase tracking-widest text-slate-400">{k}</p>
                <p className="mt-0.5 font-medium text-slate-900 dark:text-white">{v}</p></div>
            ))}
            <div><p className="text-xs uppercase tracking-widest text-slate-400">Voting Status</p>
              <p className="mt-0.5 font-medium" style={{ color: state.student.has_voted ? '#dc2626' : '#16a34a' }}>
                {state.student.has_voted ? 'Already Voted' : 'Eligible'}</p></div>
          </div>
          <div className="mt-6 flex gap-3">
            {state.student.has_voted ? (
              <>
                <div className="flex-1 rounded-xl bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                  Voting disabled — this computer number has already cast a ballot.
                </div>
                <Button variant="outline" className="rounded-xl h-11" onClick={reset}>Next voter</Button>
              </>
            ) : (
              <>
                <Button className="rounded-xl h-12 px-8 text-base" style={{ background: 'var(--ems-primary)' }} onClick={() => onVerified(state.student)}>
                  <ShieldCheck className="h-5 w-5 mr-2" />Identity verified — Start voting
                </Button>
                <Button variant="ghost" className="rounded-xl h-12" onClick={reset}>Cancel</Button>
              </>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}