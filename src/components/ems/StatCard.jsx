import React from 'react';
import { motion } from 'framer-motion';

export default function StatCard({ icon: Icon, label, value, sub, accent = false, index = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35 }}
      className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 backdrop-blur p-5 shadow-[0_1px_3px_rgba(16,24,40,0.06)] hover:shadow-lg transition-shadow"
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-widest text-slate-500">{label}</p>
        {Icon && (
          <span
            className="h-9 w-9 rounded-xl grid place-items-center"
            style={{ background: accent ? 'var(--ems-accent)22' : 'var(--ems-primary)14', color: accent ? 'var(--ems-accent)' : 'var(--ems-primary)' }}
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">{value}</p>
      {sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}
    </motion.div>
  );
}