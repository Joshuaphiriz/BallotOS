import React, { useState } from 'react';
import CandidateCard from './CandidateCard';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';

export default function Ballot({ election, student, positions, candidates, onSubmit, submitting }) {
  const [selections, setSelections] = useState({});
  const [confirm, setConfirm] = useState(false);
  const chosen = Object.keys(selections).length;

  return (
    <div className="pb-32">
      <div className="rounded-2xl p-6 mb-8 text-white" style={{ background: 'var(--ems-primary)' }}>
        <p className="text-sm opacity-80">{election.association_name}</p>
        <h1 className="text-2xl font-semibold">{election.name}</h1>
        <p className="mt-2 text-sm opacity-90">Voting as {student.full_name} · {student.computer_number}</p>
      </div>

      {positions.map(p => (
        <section key={p.id} className="mb-12">
          <div className="flex items-baseline gap-3 mb-4">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{p.title}</h2>
            <span className="text-xs uppercase tracking-widest text-slate-400">Select one</span>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {candidates.filter(c => c.position_id === p.id).map(c => (
              <CandidateCard key={c.id} candidate={c} selected={selections[p.id] === c.id}
                onSelect={() => setSelections(s => ({ ...s, [p.id]: c.id }))} />
            ))}
            {candidates.filter(c => c.position_id === p.id).length === 0 && (
              <p className="text-sm text-slate-500">No candidates standing for this position.</p>
            )}
          </div>
        </section>
      ))}

      <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl px-8 py-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">{chosen} of {positions.length} positions selected</p>
        <Button disabled={!chosen || submitting} onClick={() => setConfirm(true)} className="rounded-xl h-12 px-10 text-base" style={{ background: 'var(--ems-primary)' }}>
          {submitting ? 'Submitting…' : 'Submit Vote'}
        </Button>
      </div>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to submit your vote?</AlertDialogTitle>
            <AlertDialogDescription>Your ballot cannot be changed once submitted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl" style={{ background: 'var(--ems-primary)' }} onClick={() => onSubmit(selections)}>Submit</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}