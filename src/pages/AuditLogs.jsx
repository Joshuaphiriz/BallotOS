import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ScrollText } from 'lucide-react';
import PageHeader from '@/components/ems/PageHeader';
import EmptyState from '@/components/ems/EmptyState';
import Loader from '@/components/ems/Loader';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export default function AuditLogs() {
  const { user, election } = useOutletContext();
  const [logs, setLogs] = useState(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    const load = async () => {
      const all = await base44.entities.AuditLog.list('-created_date', 500);
      // Observers only see logs for the current election; admins see everything.
      const scoped = user?.ems_role === 'observer' ? all.filter(l => l.election_id === election?.id) : all;
      setLogs(scoped);
    };
    load();
  }, [user, election]);
  if (!logs) return <Loader />;

  const filtered = logs.filter(l => `${l.action} ${l.actor} ${l.category}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageHeader title="Audit Logs" subtitle={user?.ems_role === 'observer' ? `Activity for ${election?.name || 'this election'}` : 'Immutable trail of every action in the system'} />
      <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Filter logs" className="rounded-xl mb-6 max-w-md h-11" />
      {filtered.length === 0 ? (
        <EmptyState icon={ScrollText} title="No log entries" description="Activity will appear here as the election progresses." />
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>{['Time', 'Category', 'Action', 'Actor', 'Details'].map(h => <th key={h} className="text-left px-5 py-3 font-medium text-slate-600 dark:text-slate-400">{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-5 py-3 text-slate-500 whitespace-nowrap">{format(new Date(l.created_date), 'PP p')}</td>
                  <td className="px-5 py-3"><Badge variant="secondary" className="rounded-lg capitalize">{l.category}</Badge></td>
                  <td className="px-5 py-3 text-slate-900 dark:text-white">{l.action}</td>
                  <td className="px-5 py-3 text-slate-500">{l.actor}</td>
                  <td className="px-5 py-3 text-slate-500">{l.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}