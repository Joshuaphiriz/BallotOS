import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/ems/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { applyTheme, DEFAULT_THEME } from '@/lib/ems';

export default function Branding() {
  const { election, setElection } = useOutletContext();
  const [form, setForm] = useState(null);
  const { toast } = useToast();

  useEffect(() => { if (election) setForm({ ...DEFAULT_THEME, ...election }); }, [election]);
  if (!election || !form) return <p className="text-slate-500">Create an election first.</p>;

  const set = (k, v) => { const next = { ...form, [k]: v }; setForm(next); applyTheme(next); };

  const save = async () => {
    const { name, association_name, association_abbr, logo_url, primary_color, secondary_color, accent_color } = form;
    await base44.entities.Election.update(election.id, { name, association_name, association_abbr, logo_url, primary_color, secondary_color, accent_color });
    setElection({ ...election, ...form });
    toast({ title: 'Branding saved' });
  };

  return (
    <div>
      <PageHeader title="Branding" subtitle="Make BallotOS look like your organization" />
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 space-y-4">
          <Input value={form.name || ''} onChange={e => set('name', e.target.value)} placeholder="Election name" className="rounded-xl h-11" />
          <Input value={form.association_name || ''} onChange={e => set('association_name', e.target.value)} placeholder="Association name" className="rounded-xl h-11" />
          <Input value={form.association_abbr || ''} onChange={e => set('association_abbr', e.target.value)} placeholder="Abbreviation" className="rounded-xl h-11" />
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500 mb-1.5">Logo</p>
            <Input type="file" accept="image/*" className="rounded-xl" onChange={async e => {
              const f = e.target.files[0]; if (!f) return;
              const { file_url } = await base44.integrations.Core.UploadFile({ file: f }); set('logo_url', file_url);
            }} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[['primary_color', 'Primary'], ['secondary_color', 'Secondary'], ['accent_color', 'Accent']].map(([k, l]) => (
              <div key={k}>
                <p className="text-xs uppercase tracking-widest text-slate-500 mb-1.5">{l}</p>
                <Input type="color" value={form[k] || '#1F365C'} onChange={e => set(k, e.target.value)} className="rounded-xl h-11 p-1" />
              </div>
            ))}
          </div>
          <Button onClick={save} className="rounded-xl h-11" style={{ background: 'var(--ems-primary)' }}>Save branding</Button>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-8 text-white" style={{ background: form.primary_color }}>
            <div className="h-14 w-14 rounded-xl overflow-hidden bg-white/20 grid place-items-center font-bold">
              {form.logo_url ? <img src={form.logo_url} alt="" className="h-full w-full object-cover" /> : (form.association_abbr || 'B').slice(0, 2)}
            </div>
            <p className="mt-4 text-sm opacity-80">{form.association_name}</p>
            <h3 className="text-2xl font-semibold">{form.name}</h3>
          </div>
          <div className="p-8 bg-white dark:bg-slate-900">
            <div className="rounded-xl border-2 p-4" style={{ borderColor: form.primary_color }}>
              <p className="font-medium text-slate-900 dark:text-white">Sample candidate card</p>
              <p className="text-sm" style={{ color: form.accent_color }}>“Preview”</p>
              <p className="text-sm text-slate-500 mt-2">This is how ballots will appear to voters.</p>
            </div>
            <Button className="mt-5 rounded-xl h-11 w-full" style={{ background: form.primary_color }}>Submit Vote</Button>
          </div>
        </div>
      </div>
    </div>
  );
}