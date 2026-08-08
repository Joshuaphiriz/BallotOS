import React, { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Vote, Plus, CheckCircle2, Lock, Star, Trash2 } from 'lucide-react';
import PageHeader from '@/components/ems/PageHeader';
import EmptyState from '@/components/ems/EmptyState';
import Loader from '@/components/ems/Loader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { logAudit, applyTheme } from '@/lib/ems';

export default function Elections() {
  const { user, setElection } = useOutletContext();
  const [elections, setElections] = useState(null);
  const { toast } = useToast();

  const load = async () => setElections(await base44.entities.Election.list('-created_date', 100));
  useEffect(() => { load(); }, []);

  const setStatus = async (e, status) => {
    await base44.entities.Election.update(e.id, { status });
    await logAudit(`Election ${status === 'open' ? 'opened' : 'closed'}: ${e.name}`, 'election', '', e.id);
    toast({ title: `Election ${status}`, description: e.name });
    load();
  };

  const makeActive = async (e) => {
    await base44.entities.Election.updateMany({ is_active: true }, { $set: { is_active: false } });
    await base44.entities.Election.update(e.id, { is_active: true });
    setElection({ ...e, is_active: true });
    applyTheme(e);
    toast({ title: 'Active election switched', description: e.name });
    load();
  };

  const remove = async (e) => {
    if (!window.confirm(`Delete "${e.name}"? This permanently removes all positions, candidates, students, votes, stations and logs for this election.`)) return;
    await base44.entities.Vote.deleteMany({ election_id: e.id });
    await base44.entities.Candidate.deleteMany({ election_id: e.id });
    await base44.entities.Position.deleteMany({ election_id: e.id });
    await base44.entities.Student.deleteMany({ election_id: e.id });
    await base44.entities.VotingStation.deleteMany({ election_id: e.id });
    await base44.entities.AuditLog.deleteMany({ election_id: e.id });
    await base44.entities.Election.delete(e.id);
    await logAudit(`Election deleted: ${e.name}`, 'election');
    toast({ title: 'Election deleted', description: e.name });
    load();
  };

  if (!elections) return <Loader />;

  return (
    <div>
      <PageHeader title="Elections" subtitle="Every election with its own branding and voter roll">
        <Link to="/wizard"><Button className="rounded-xl h-11" style={{ background: 'var(--ems-primary)' }}><Plus className="h-4 w-4 mr-2" />New Election</Button></Link>
      </PageHeader>

      {elections.length === 0 ? (
        <EmptyState icon={Vote} title="No elections yet" description="Create your first election with the six-step wizard."
          action={<Link to="/wizard"><Button className="rounded-xl" style={{ background: 'var(--ems-primary)' }}>Launch Election Wizard</Button></Link>} />
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {elections.map(e => (
            <div key={e.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="h-12 w-12 rounded-xl overflow-hidden grid place-items-center text-white font-semibold" style={{ background: e.primary_color || 'var(--ems-primary)' }}>
                  {e.logo_url ? <img src={e.logo_url} alt="" className="h-full w-full object-cover" /> : (e.association_abbr || e.name || '?').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex items-center gap-2">
                  {e.is_active && <Badge style={{ background: 'var(--ems-accent)' }} className="rounded-lg">Active</Badge>}
                  <Badge variant="secondary" className="rounded-lg capitalize">{e.status}</Badge>
                </div>
              </div>
              <h3 className="mt-4 font-semibold text-slate-900 dark:text-white">{e.name}</h3>
              <p className="text-sm text-slate-500">{e.association_name}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {!e.is_active && <Button size="sm" variant="outline" className="rounded-lg" onClick={() => makeActive(e)}><Star className="h-3.5 w-3.5 mr-1.5" />Set active</Button>}
                {e.status !== 'open' && <Button size="sm" className="rounded-lg" style={{ background: 'var(--ems-primary)' }} onClick={() => setStatus(e, 'open')}><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Open</Button>}
                {e.status === 'open' && <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setStatus(e, 'closed')}><Lock className="h-3.5 w-3.5 mr-1.5" />Close</Button>}
                {user?.ems_role === 'admin' && <Button size="sm" variant="outline" className="rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => remove(e)}><Trash2 className="h-3.5 w-3.5 mr-1.5" />Delete</Button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}