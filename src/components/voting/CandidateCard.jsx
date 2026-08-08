import React from 'react';
import { Image } from '@/components/ui/image';
import { Check } from 'lucide-react';

export default function CandidateCard({ candidate, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left rounded-2xl border-2 bg-white dark:bg-slate-900 p-5 transition-all hover:shadow-lg ${
        selected ? 'shadow-lg' : 'border-slate-200 dark:border-slate-800'
      }`}
      style={selected ? { borderColor: 'var(--ems-primary)' } : {}}
    >
      <div className="flex gap-4">
        <div className="h-20 w-20 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
          {candidate.photo_url && <Image src={candidate.photo_url} alt={candidate.full_name} className="h-20 w-20 object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900 dark:text-white">{candidate.full_name}</p>
          {candidate.aka && <p className="text-sm" style={{ color: 'var(--ems-accent)' }}>“{candidate.aka}”</p>}
          <p className="mt-2 text-sm text-slate-500 line-clamp-3">{candidate.manifesto || candidate.biography}</p>
        </div>
        <span className={`h-6 w-6 rounded-full border-2 shrink-0 grid place-items-center ${selected ? 'text-white' : 'border-slate-300'}`}
          style={selected ? { background: 'var(--ems-primary)', borderColor: 'var(--ems-primary)' } : {}}>
          {selected && <Check className="h-4 w-4" />}
        </span>
      </div>
    </button>
  );
}