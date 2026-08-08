import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';

export default function VoteSuccess({ onDone }) {
  const [count, setCount] = useState(5);

  useEffect(() => {
    if (count === 0) { onDone(); return; }
    const t = setTimeout(() => setCount(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count, onDone]);

  return (
    <div className="py-24 text-center">
      <motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 160, damping: 14 }}
        className="mx-auto h-28 w-28 rounded-full grid place-items-center" style={{ background: 'var(--ems-primary)' }}>
        <CheckCircle2 className="h-14 w-14 text-white" />
      </motion.div>
      <h1 className="mt-8 text-3xl font-semibold text-slate-900 dark:text-white">Your vote has been successfully recorded.</h1>
      <p className="mt-3 text-slate-500">Returning to the computer number screen in</p>
      <motion.p key={count} initial={{ scale: 1.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="mt-4 text-6xl font-bold" style={{ color: 'var(--ems-accent)' }}>{count}</motion.p>
    </div>
  );
}