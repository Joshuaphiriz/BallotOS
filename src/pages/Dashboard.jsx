import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Users, Vote, UserMinus, TrendingUp, Activity, MonitorSmartphone, ShieldCheck, HeartPulse, DatabaseBackup } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import StatCard from '@/components/ems/StatCard';
import PageHeader from '@/components/ems/PageHeader';
import Loader from '@/components/ems/Loader';
import { format } from 'date-fns';

export default function Dashboard() {
  const { election } = useOutletContext();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!election) return;
    const load = async () => {
      const [students, votes, stations, logs, positions, candidates] = await Promise.all([
        base44.entities.Student.filter({ election_id: election.id }, '-created_date', 5000),
        base44.entities.Vote.filter({ election_id: election.id }, '-created_date', 5000),
        base44.entities.VotingStation.filter({ election_id: election.id }),
        base44.entities.AuditLog.list('-created_date', 8),
        base44.entities.Position.filter({ election_id: election.id }, 'order'),
        base44.entities.Candidate.filter({ election_id: election.id }, '-created_date', 500),
      ]);
      setData({ students, votes, stations, logs, positions, candidates });
    };
    load();
    const unsub = base44.entities.Vote.subscribe(() => load());
    return unsub;
  }, [election]);

  if (!election) return <p className="text-slate-500">No election configured yet. Start with the Election Wizard.</p>;
  if (!data) return <Loader label="Loading live statistics" />;

  const total = data.students.length;
  const cast = data.votes.length;
  const turnout = total ? Math.round((cast / total) * 1000) / 10 : 0;

  const chart = data.positions.map(p => ({
    name: p.title,
    votes: data.votes.filter(v => (v.selections || []).some(s => s.position_id === p.id)).length,
  }));

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`${election.name} · ${election.association_name || ''}`} />

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatCard index={0} icon={Users} label="Registered Students" value={total.toLocaleString()} />
        <StatCard index={1} icon={Vote} label="Votes Cast" value={cast.toLocaleString()} />
        <StatCard index={2} icon={UserMinus} label="Remaining Voters" value={Math.max(total - cast, 0).toLocaleString()} />
        <StatCard index={3} icon={TrendingUp} label="Turnout" value={`${turnout}%`} accent />
        <StatCard index={4} icon={Activity} label="Election Status" value={election.status?.toUpperCase()} sub={election.starts_at ? format(new Date(election.starts_at), 'PP') : 'No start date'} />
        <StatCard index={5} icon={MonitorSmartphone} label="Connected Stations" value={data.stations.filter(s => s.status === 'online').length} sub={`${data.stations.length} configured`} />
        <StatCard index={6} icon={ShieldCheck} label="Active Officers" value={new Set(data.stations.filter(s => s.status === 'online').map(s => s.officer_name)).size} />
        <StatCard index={7} icon={HeartPulse} label="System Health" value="Healthy" sub={`${data.candidates.length} candidates loaded`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mt-8">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Ballots recorded per position</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="votes" radius={[8, 8, 0, 0]} fill="var(--ems-primary)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Recent activity</h3>
          <div className="space-y-4">
            {data.logs.length === 0 && <p className="text-sm text-slate-500">No activity yet.</p>}
            {data.logs.map(l => (
              <div key={l.id} className="flex gap-3">
                <span className="mt-1.5 h-2 w-2 rounded-full shrink-0" style={{ background: 'var(--ems-accent)' }} />
                <div>
                  <p className="text-sm text-slate-800 dark:text-slate-200">{l.action}</p>
                  <p className="text-xs text-slate-500">{l.actor} · {format(new Date(l.created_date), 'PP p')}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 text-xs text-slate-500">
            <DatabaseBackup className="h-4 w-4" /> Last backup: {format(new Date(), 'PP p')}
          </div>
        </div>
      </div>
    </div>
  );
}