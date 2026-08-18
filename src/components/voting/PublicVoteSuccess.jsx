import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, RotateCcw } from 'lucide-react';

// Two phases, strictly in order: the countdown always runs to completion
// first, and only once it finishes does the "you're done" screen appear.
// There is no way to skip ahead of the countdown.
export default function PublicVoteSuccess({ onDone, onVoteAgain }) {
  const [count, setCount] = useState(5);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (finished) return undefined;
    if (count === 0) {
      setFinished(true);
      onDone();
      return undefined;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count, finished, onDone]);

  if (finished) {
    return (
      <div className="py-24 text-center">
        <motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="mx-auto h-28 w-28 rounded-full grid place-items-center" style={{ background: 'var(--ems-primary)' }}>
          <CheckCircle2 className="h-14 w-14 text-white" />
        </motion.div>
        <h1 className="mt-8 text-3xl font-semibold text-slate-900 dark:text-white">Finished voting</h1>
        <p className="mt-3 text-slate-500 max-w-sm mx-auto">Thank you for participating. You may now close this page.</p>
        <button
          type="button"
          onClick={onVoteAgain}
          className="mt-8 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-600"
        >
          <RotateCcw className="h-3.5 w-3.5" />Someone else voting on this device?
        </button>
      </div>
    );
  }

  return (
    <div className="py-24 text-center">
      <motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 160, damping: 14 }}
        className="mx-auto h-28 w-28 rounded-full grid place-items-center" style={{ background: 'var(--ems-primary)' }}>
        <CheckCircle2 className="h-14 w-14 text-white" />
      </motion.div>
      <h1 className="mt-8 text-3xl font-semibold text-slate-900 dark:text-white">Your vote has been successfully recorded.</h1>
      <p className="mt-3 text-slate-500">Finishing up in</p>
      <motion.p key={count} initial={{ scale: 1.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="mt-4 text-6xl font-bold" style={{ color: 'var(--ems-accent)' }}>{count}</motion.p>
    </div>
  );
}
