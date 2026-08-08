import React from 'react';

export default function Loader({ label = 'Loading' }) {
  return (
    <div className="py-24 flex flex-col items-center justify-center gap-3">
      <div className="h-8 w-8 rounded-full border-4 border-slate-200 animate-spin" style={{ borderTopColor: 'var(--ems-primary)' }} />
      <p className="text-sm text-slate-500">{label}…</p>
    </div>
  );
}