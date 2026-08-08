import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { MonitorSmartphone, Plus, Trash2, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { setStation } from '@/lib/ems';
import PageHeader from '@/components/ems/PageHeader';
import EmptyState from '@/components/ems/EmptyState';
import Loader from '@/components/ems/Loader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export default function Stations() {
  const { election } = useOutletContext();
  const navigate = useNavigate();
  const [stations, setStations] = useState(null);
  const [form, setForm] = useState({ name: '', location: '', officer_name: '' });

  const load = async () => {
    if (!election) return setStations([]);
    setStations(await base44.entities.VotingStation.filter({ election_id: election.id }, '-created_date'));
  };
  useEffect(() => { load(); }, [election]);

  const add = async () => {
    if (!form.name.trim()) return;
    await base44.entities.VotingStation.create({ ...form, election_id: election.id, status: 'offline', votes_processed: 0 });
    setForm({ name: '', location: '', officer_name: '' });
    load();
  };

  const toggle = async (s) => {
    await base44.entities.VotingStation.update(s.id, { status: s.status === 'online' ? 'offline' : 'online', last_activity: new Date().toISOString() });
    load();
  };

  const launch = async (s) => {
    await base44.entities.VotingStation.update(s.id, { status: 'online', last_activity: new Date().toISOString() });
    setStation({ id: s.id, name: s.name, location: s.location });
    navigate('/vote');
  };

  const remove = async (s) => {
    if (!window.confirm(`Remove station "${s.name}"?`)) return;
    await base44.entities.VotingStation.delete(s.id);
    load();
  };

  if (!election) return <p className="text-slate-500">Create an election first.</p>;
  if (!stations) return <Loader />;

  return (
    <div>
      <PageHeader title="Voting Stations" subtitle={`${stations.filter(s => s.status === 'online').length} online of ${stations.length}`} />
      <div className="flex flex-wrap gap-3 mb-6">
        <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Station name" className="rounded-xl h-11 w-56" />
        <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Location" className="rounded-xl h-11 w-56" />
        <Input value={form.officer_name} onChange={e => setForm(f => ({ ...f, officer_name: e.target.value }))} placeholder="Election officer" className="rounded-xl h-11 w-56" />
        <Button onClick={add} className="rounded-xl h-11" style={{ background: 'var(--ems-primary)' }}><Plus className="h-4 w-4 mr-2" />Add station</Button>
      </div>

      {stations.length === 0 ? (
        <EmptyState icon={MonitorSmartphone} title="No stations configured" description="Register each polling laptop so activity can be tracked." />
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {stations.map(s => (
            <div key={s.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{s.name}</p>
                  <p className="text-sm text-slate-500">{s.location || 'No location'}</p>
                </div>
                <Badge className="rounded-lg" style={{ background: s.status === 'online' ? '#16a34a' : '#94a3b8' }}>{s.status}</Badge>
              </div>
              <div className="mt-4 text-sm text-slate-600 dark:text-slate-400 space-y-1">
                <p>Officer: {s.officer_name || '—'}</p>
                <p>Votes processed: {s.votes_processed || 0}</p>
                <p>Last activity: {s.last_activity ? format(new Date(s.last_activity), 'PP p') : '—'}</p>
              </div>
              <div className="mt-4 flex gap-2">
                <Button size="sm" className="rounded-lg" style={{ background: 'var(--ems-primary)' }} onClick={() => launch(s)}><ExternalLink className="h-3.5 w-3.5 mr-1.5" />Launch Portal</Button>
                <Button size="sm" variant="outline" className="rounded-lg" onClick={() => toggle(s)}>Mark {s.status === 'online' ? 'offline' : 'online'}</Button>
                <Button size="sm" variant="ghost" className="rounded-lg text-slate-400 hover:text-red-600" onClick={() => remove(s)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}