import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { UserSquare2, Plus, Trash2 } from 'lucide-react';
import PageHeader from '@/components/ems/PageHeader';
import EmptyState from '@/components/ems/EmptyState';
import Loader from '@/components/ems/Loader';
import ImportPanel from '@/components/ems/ImportPanel';
import CandidateForm from '@/components/ems/CandidateForm';
import { Image } from '@/components/ui/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { logAudit } from '@/lib/ems';

const FIELDS = [
  { key: 'full_name', label: 'Full Name', required: true },
  { key: 'aka', label: 'AKA' },
  { key: 'position', label: 'Position', required: true },
  { key: 'manifesto', label: 'Manifesto' },
  { key: 'biography', label: 'Biography' },
  { key: 'photo_url', label: 'Photo URL' },
];

export default function Candidates() {
  const { election } = useOutletContext();
  const [candidates, setCandidates] = useState(null);
  const [positions, setPositions] = useState([]);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    if (!election) return setCandidates([]);
    const [c, p] = await Promise.all([
      base44.entities.Candidate.filter({ election_id: election.id }, '-created_date', 500),
      base44.entities.Position.filter({ election_id: election.id }, 'order'),
    ]);
    setCandidates(c); setPositions(p);
  };
  useEffect(() => { load(); }, [election]);

  const handleImport = async (rows) => {
    setBusy(true);
    const mapped = rows.map(r => {
      const pos = positions.find(p => p.title.toLowerCase() === String(r.position).toLowerCase());
      return { election_id: election.id, position_id: pos?.id, full_name: r.full_name, aka: r.aka, manifesto: r.manifesto, biography: r.biography, photo_url: r.photo_url };
    });
    await base44.entities.Candidate.bulkCreate(mapped);
    await logAudit(`Imported ${mapped.length} candidates`, 'import', '', election.id);
    toast({ title: 'Candidates imported', description: `${mapped.length} added` });
    setBusy(false); load();
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete candidate ${c.full_name}?`)) return;
    await base44.entities.Candidate.delete(c.id);
    toast({ title: 'Candidate deleted' });
    load();
  };

  const clearAll = async () => {
    if (!window.confirm(`Delete all ${candidates.length} candidates? This lets you re-import fresh data.`)) return;
    setBusy(true);
    await base44.entities.Candidate.deleteMany({ election_id: election.id });
    await logAudit(`Cleared all candidates`, 'import', `${candidates.length} deleted`, election.id);
    toast({ title: 'All candidates deleted' });
    setBusy(false);
    load();
  };

  if (!election) return <p className="text-slate-500">Create an election first.</p>;
  if (!candidates) return <Loader />;

  const filtered = candidates.filter(c => `${c.full_name} ${c.aka}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageHeader title="Candidates" subtitle={`${candidates.length} candidates across ${positions.length} positions`}>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl h-11" style={{ background: 'var(--ems-primary)' }}><Plus className="h-4 w-4 mr-2" />Add Candidate</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New candidate</DialogTitle></DialogHeader>
            <CandidateForm positions={positions} electionId={election.id} onSaved={() => { setOpen(false); load(); }} />
          </DialogContent>
        </Dialog>
      </PageHeader>

      <Tabs defaultValue="list">
        <TabsList className="rounded-xl mb-6">
          <TabsTrigger value="list" className="rounded-lg">All Candidates</TabsTrigger>
          <TabsTrigger value="import" className="rounded-lg">Bulk Import</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          {candidates.length === 0 ? (
            <EmptyState icon={UserSquare2} title="No candidates yet" description="Add candidates manually or import them in bulk." />
          ) : (
            <>
              <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search candidates" className="rounded-xl mb-5 max-w-md h-11" />
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
                {filtered.map(c => (
                  <div key={c.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex gap-4">
                    <div className="h-16 w-16 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
                      {c.photo_url ? <Image src={c.photo_url} alt={c.full_name} className="h-16 w-16 object-cover" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 dark:text-white truncate">{c.full_name}</p>
                      {c.aka && <p className="text-sm" style={{ color: 'var(--ems-accent)' }}>“{c.aka}”</p>}
                      <p className="text-xs text-slate-500 mt-1">{positions.find(p => p.id === c.position_id)?.title || 'Unassigned'}</p>
                      <p className="text-xs text-slate-500 mt-2 line-clamp-2">{c.manifesto}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="rounded-lg text-slate-400 hover:text-red-600 shrink-0" onClick={() => remove(c)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="import">
          {candidates.length > 0 && (
            <div className="flex items-center justify-between rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 px-5 py-4 mb-6">
              <p className="text-sm text-amber-800 dark:text-amber-200">{candidates.length} candidates currently imported. Clear them to start fresh.</p>
              <Button variant="outline" disabled={busy} onClick={clearAll} className="rounded-xl h-9 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"><Trash2 className="h-4 w-4 mr-2" />Delete all</Button>
            </div>
          )}
          <ImportPanel fields={FIELDS} onImport={handleImport} busy={busy} />
        </TabsContent>
      </Tabs>
    </div>
  );
}