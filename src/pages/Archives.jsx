import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Archive, Trash2, Copy } from 'lucide-react';
import PageHeader from '@/components/ems/PageHeader';
import EmptyState from '@/components/ems/EmptyState';
import Loader from '@/components/ems/Loader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';

export default function Archives() {
  const [elections, setElections] = useState(null);
  const [q, setQ] = useState('');
  const { toast } = useToast();

  const load = async () => setElections(await base44.entities.Election.list('-created_date', 200));
  useEffect(() => { load(); }, []);

  const duplicate = async (e) => {
    const { id, created_date, updated_date, created_by_id, ...rest } = e;
    await base44.entities.Election.create({ ...rest, name: `${e.name} (Copy)`, status: 'draft', is_active: false });
    toast({ title: 'Election duplicated' });
    load();
  };

  const remove = async (e) => {
    if (!window.confirm(`Permanently delete "${e.name}"? This cannot be undone.`)) return;
    await base44.entities.Election.delete(e.id);
    toast({ title: 'Election deleted' });
    load();
  };

  if (!elections) return <Loader />;
  const past = elections.filter(e => ['closed', 'archived'].includes(e.status) && e.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageHeader title="Archives" subtitle="Closed elections, ready to review, duplicate or export" />
      <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search archived elections" className="rounded-xl mb-6 max-w-md h-11" />
      {past.length === 0 ? (
        <EmptyState icon={Archive} title="No archived elections" description="Elections appear here once they are closed." />
      ) : (
        <div className="space-y-3">
          {past.map(e => (
            <div key={e.id} className="flex items-center gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4">
              <div>
                <p className="font-medium text-slate-900 dark:text-white">{e.name}</p>
                <p className="text-sm text-slate-500">{e.association_name} · closed {format(new Date(e.updated_date), 'PP')}</p>
              </div>
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="outline" className="rounded-lg" onClick={() => duplicate(e)}><Copy className="h-3.5 w-3.5 mr-1.5" />Duplicate</Button>
                <Button size="sm" variant="ghost" className="rounded-lg text-slate-400 hover:text-red-600" onClick={() => remove(e)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}