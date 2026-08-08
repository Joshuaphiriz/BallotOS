import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';

export default function GlobalSearch({ query, onClose }) {
  const [res, setRes] = useState({ students: [], candidates: [], elections: [] });

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const q = query.trim().toLowerCase();
      const [students, candidates, elections] = await Promise.all([
        base44.entities.Student.list('-created_date', 300),
        base44.entities.Candidate.list('-created_date', 300),
        base44.entities.Election.list('-created_date', 100),
      ]);
      const m = (v) => String(v || '').toLowerCase().includes(q);
      if (!cancelled) setRes({
        students: students.filter(s => m(s.full_name) || m(s.computer_number)).slice(0, 5),
        candidates: candidates.filter(c => m(c.full_name) || m(c.aka)).slice(0, 5),
        elections: elections.filter(e => m(e.name) || m(e.association_name)).slice(0, 5),
      });
    };
    const t = setTimeout(run, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  const empty = !res.students.length && !res.candidates.length && !res.elections.length;

  return (
    <div className="absolute z-40 left-6 right-6 top-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl p-4 max-w-2xl">
      {empty && <p className="text-sm text-slate-500">No matches found.</p>}
      {[['Students', res.students, '/students', s => `${s.full_name} · ${s.computer_number}`],
        ['Candidates', res.candidates, '/candidates', c => `${c.full_name}${c.aka ? ` "${c.aka}"` : ''}`],
        ['Elections', res.elections, '/elections', e => e.name]].map(([label, items, to, fmt]) => (
        items.length ? (
          <div key={label} className="mb-3 last:mb-0">
            <p className="text-[11px] uppercase tracking-widest text-slate-400 mb-1">{label}</p>
            {items.map(i => (
              <Link key={i.id} to={to} onClick={onClose} className="block rounded-lg px-2 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
                {fmt(i)}
              </Link>
            ))}
          </div>
        ) : null
      ))}
    </div>
  );
}