import React, { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Check, ChevronRight, ChevronLeft, Plus, Trash2 } from 'lucide-react';
import PageHeader from '@/components/ems/PageHeader';
import ImportPanel from '@/components/ems/ImportPanel';
import CandidateForm from '@/components/ems/CandidateForm';
import { STUDENT_FIELDS } from './Students';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { logAudit, applyTheme, DEFAULT_THEME } from '@/lib/ems';

const STEPS = ['Branding', 'Students', 'Positions', 'Candidates', 'Review', 'Open'];

export default function ElectionWizard() {
  const { setElection } = useOutletContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [election, setLocalElection] = useState(null);
  const [form, setForm] = useState({ name: '', association_name: '', association_abbr: '', logo_url: '', ...DEFAULT_THEME });
  const [positions, setPositions] = useState([]);
  const [posTitle, setPosTitle] = useState('');
  const [studentCount, setStudentCount] = useState(0);
  const [candCount, setCandCount] = useState(0);
  const [busy, setBusy] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const createElection = async () => {
    setBusy(true);
    await base44.entities.Election.updateMany({ is_active: true }, { $set: { is_active: false } });
    const e = await base44.entities.Election.create({ ...form, status: 'draft', is_active: true });
    await logAudit(`Election created: ${e.name}`, 'election', '', e.id);
    setLocalElection(e); setElection(e); applyTheme(e);
    setBusy(false); setStep(1);
  };

  const addPosition = async () => {
    if (!posTitle.trim()) return;
    const p = await base44.entities.Position.create({ election_id: election.id, title: posTitle.trim(), order: positions.length });
    setPositions(ps => [...ps, p]); setPosTitle('');
  };

  const importStudents = async (rows) => {
    setBusy(true);
    const seen = new Set(); const fresh = [];
    rows.forEach(r => { if (!seen.has(r.computer_number)) { seen.add(r.computer_number); fresh.push({ ...r, election_id: election.id, has_voted: false }); } });
    for (let i = 0; i < fresh.length; i += 200) await base44.entities.Student.bulkCreate(fresh.slice(i, i + 200));
    await logAudit(`Imported ${fresh.length} students`, 'import', '', election.id);
    setStudentCount(c => c + fresh.length); setBusy(false);
    toast({ title: `${fresh.length} students imported` });
  };

  const openElection = async () => {
    await base44.entities.Election.update(election.id, { status: 'open' });
    await logAudit(`Election opened: ${election.name}`, 'election', '', election.id);
    toast({ title: 'Election is now open', description: 'Voting stations can begin processing voters.' });
    navigate('/');
  };

  return (
    <div>
      <PageHeader title="Election Wizard" subtitle="Six guided steps from branding to open polls" />

      <div className="flex items-center gap-2 mb-10 flex-wrap">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm ${i <= step ? 'text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
              style={i <= step ? { background: 'var(--ems-primary)' } : {}}>
              {i < step ? <Check className="h-3.5 w-3.5" /> : <span className="text-xs">{i + 1}</span>}{s}
            </div>
            {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-slate-300" />}
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8">
        {step === 0 && (
          <div className="max-w-xl space-y-4">
            <Input placeholder="Election name (e.g. UNZAHSSA General Elections 2027)" value={form.name} onChange={e => set('name', e.target.value)} className="rounded-xl h-11" />
            <Input placeholder="Association name" value={form.association_name} onChange={e => set('association_name', e.target.value)} className="rounded-xl h-11" />
            <Input placeholder="Abbreviation (e.g. UNZAHSSA)" value={form.association_abbr} onChange={e => set('association_abbr', e.target.value)} className="rounded-xl h-11" />
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500 mb-1.5">Association logo</p>
              <Input type="file" accept="image/*" className="rounded-xl" onChange={async e => {
                const f = e.target.files[0]; if (!f) return;
                const { file_url } = await base44.integrations.Core.UploadFile({ file: f }); set('logo_url', file_url);
              }} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[['primary_color', 'Primary'], ['secondary_color', 'Secondary'], ['accent_color', 'Accent']].map(([k, l]) => (
                <div key={k}>
                  <p className="text-xs uppercase tracking-widest text-slate-500 mb-1.5">{l}</p>
                  <Input type="color" value={form[k]} onChange={e => set(k, e.target.value)} className="rounded-xl h-11 p-1" />
                </div>
              ))}
            </div>
            <Button disabled={!form.name || busy} onClick={createElection} className="rounded-xl h-11" style={{ background: 'var(--ems-primary)' }}>Create election & continue</Button>
          </div>
        )}

        {step === 1 && (
          <div>
            <ImportPanel fields={STUDENT_FIELDS} onImport={importStudents} busy={busy} />
            <div className="mt-6 flex items-center justify-between">
              <Button variant="outline" onClick={() => setStep(0)} className="rounded-xl h-11"><ChevronLeft className="h-4 w-4 mr-2" />Back</Button>
              <div className="flex items-center gap-3">
                <p className="text-sm text-slate-500">{studentCount} students imported</p>
                <Button onClick={() => setStep(2)} className="rounded-xl h-11" style={{ background: 'var(--ems-primary)' }}>Continue to positions</Button>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="max-w-xl">
            <div className="flex gap-3">
              <Input value={posTitle} onChange={e => setPosTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPosition()} placeholder="Position title" className="rounded-xl h-11" />
              <Button onClick={addPosition} className="rounded-xl h-11" style={{ background: 'var(--ems-primary)' }}><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="mt-5 space-y-2">
              {positions.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3">
                  <span className="text-xs text-slate-400">{i + 1}</span>
                  <span className="flex-1 text-slate-800 dark:text-slate-200">{p.title}</span>
                  <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-600" onClick={async () => { await base44.entities.Position.delete(p.id); setPositions(ps => ps.filter(x => x.id !== p.id)); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-center justify-between">
              <Button variant="outline" onClick={() => setStep(1)} className="rounded-xl h-11"><ChevronLeft className="h-4 w-4 mr-2" />Back</Button>
              <Button disabled={!positions.length} onClick={() => setStep(3)} className="rounded-xl h-11" style={{ background: 'var(--ems-primary)' }}>Continue to candidates</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="max-w-lg">
            <CandidateForm positions={positions} electionId={election.id} onSaved={() => { setCandCount(c => c + 1); toast({ title: 'Candidate added' }); }} />
            <div className="mt-6 flex items-center justify-between">
              <Button variant="outline" onClick={() => setStep(2)} className="rounded-xl h-11"><ChevronLeft className="h-4 w-4 mr-2" />Back</Button>
              <div className="flex items-center gap-3">
                <p className="text-sm text-slate-500">{candCount} candidates added</p>
                <Button onClick={() => setStep(4)} className="rounded-xl h-11" style={{ background: 'var(--ems-primary)' }}>Review</Button>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="max-w-xl">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Summary</h3>
            <div className="space-y-2 text-sm">
              {[['Election', election?.name], ['Association', election?.association_name], ['Students imported', studentCount],
                ['Positions', positions.length], ['Candidates added', candCount]].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-slate-100 dark:border-slate-800 py-2">
                  <span className="text-slate-500">{k}</span><span className="font-medium text-slate-900 dark:text-white">{v}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-center justify-between">
              <Button variant="outline" onClick={() => setStep(3)} className="rounded-xl h-11"><ChevronLeft className="h-4 w-4 mr-2" />Back</Button>
              <Button onClick={() => setStep(5)} className="rounded-xl h-11" style={{ background: 'var(--ems-primary)' }}>Continue</Button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="text-center py-10">
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Ready to open {election?.name}</h3>
            <p className="text-slate-500 mt-2">Once open, voting stations can verify voters and record ballots.</p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button variant="outline" onClick={() => setStep(4)} className="rounded-xl h-12"><ChevronLeft className="h-4 w-4 mr-2" />Back</Button>
              <Button onClick={openElection} className="rounded-xl h-12 px-10 text-base" style={{ background: 'var(--ems-primary)' }}>Open election</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}