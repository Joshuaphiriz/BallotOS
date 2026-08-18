import React, { useEffect, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Trophy, BarChart3 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import PageHeader from '@/components/ems/PageHeader';
import EmptyState from '@/components/ems/EmptyState';
import Loader from '@/components/ems/Loader';
import StatCard from '@/components/ems/StatCard';

export function tallyResults(positions, candidates, votes) {
  return positions.map(p => {
    const rows = candidates.filter(c => c.position_id === p.id).map(c => ({
      name: c.full_name, aka: c.aka,
      votes: votes.filter(v => (v.selections || []).some(s => s.candidate_id === c.id)).length,
    })).sort((a, b) => b.votes - a.votes);
    const total = rows.reduce((s, r) => s + r.votes, 0);
    return { position: p.title, rows, total };
  });
}

const PALETTE = ['#1F365C', '#D4A437', '#637D97', '#8FA8BF', '#B58B25', '#3C5B85'];

export default function Results() {
  const { election: activeElection } = useOutletContext();
  // Archives links here as /results?election=<id> so an archived election's
  // results can be viewed/exported without switching it to "active".
  const [searchParams] = useSearchParams();
  const overrideId = searchParams.get('election');
  const [overrideElection, setOverrideElection] = useState(undefined);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!overrideId) { setOverrideElection(undefined); return; }
    base44.entities.Election.get(overrideId).then(setOverrideElection).catch(() => setOverrideElection(null));
  }, [overrideId]);

  const election = overrideId ? overrideElection : activeElection;
  const isArchivedView = !!overrideId;

  useEffect(() => {
    if (!election) return;
    const load = async () => {
      const [positions, candidates, votes, students] = await Promise.all([
        base44.entities.Position.filter({ election_id: election.id }, 'order'),
        base44.entities.Candidate.filter({ election_id: election.id }, '-created_date', 500),
        base44.entities.Vote.filter({ election_id: election.id }, '-created_date', 5000),
        base44.entities.Student.filter({ election_id: election.id }, '-created_date', 5000),
      ]);
      setData({ results: tallyResults(positions, candidates, votes), votes, students });
    };
    load();
    const unsub = base44.entities.Vote.subscribe(() => load());
    return unsub;
  }, [election]);

  if (overrideId && election === undefined) return <Loader label="Loading archived election" />;
  if (overrideId && election === null) return <p className="text-slate-500">That election could not be found.</p>;
  if (!election) return <p className="text-slate-500">No election available.</p>;
  if (!data) return <Loader label="Tallying results" />;
  if (!data.results.length) return <EmptyState icon={BarChart3} title="No results yet" description="Add positions and candidates to see live tallies." />;

  const turnout = data.students.length ? Math.round((data.votes.length / data.students.length) * 1000) / 10 : 0;
  const onlineVotes = data.votes.filter(v => v.channel === 'online').length;
  const stationVotes = data.votes.length - onlineVotes;

  return (
    <div>
      <PageHeader title="Results" subtitle={`${isArchivedView ? 'Archived tally' : 'Live tally'} · ${election.name}`} />
      <div className="grid sm:grid-cols-3 gap-4 mb-4">
        <StatCard icon={BarChart3} label="Ballots Cast" value={data.votes.length.toLocaleString()} />
        <StatCard icon={Trophy} label="Positions Contested" value={data.results.length} />
        <StatCard icon={BarChart3} label="Turnout" value={`${turnout}%`} accent />
      </div>
      {onlineVotes > 0 && (
        <p className="text-sm text-slate-500 mb-8">{stationVotes.toLocaleString()} in-person · {onlineVotes.toLocaleString()} online</p>
      )}
      {onlineVotes === 0 && <div className="mb-8" />}

      <div className="space-y-6">
        {data.results.map(r => (
          <div key={r.position} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4">{r.position}</h3>
              <div className="space-y-3">
                {r.rows.map((row, i) => (
                  <div key={row.name}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                        {i === 0 && row.votes > 0 && <Trophy className="h-4 w-4" style={{ color: 'var(--ems-accent)' }} />}
                        {row.name}{row.aka ? ` “${row.aka}”` : ''}
                      </span>
                      <span className="text-slate-500">{row.votes} · {r.total ? Math.round((row.votes / r.total) * 100) : 0}%</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${r.total ? (row.votes / r.total) * 100 : 0}%`, background: i === 0 ? 'var(--ems-primary)' : 'var(--ems-secondary)' }} />
                    </div>
                  </div>
                ))}
                {!r.rows.length && <p className="text-sm text-slate-500">No candidates.</p>}
              </div>
            </div>
            <div className="h-48">
              {r.total > 0 && (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={r.rows} dataKey="votes" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={3}>
                      {r.rows.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}