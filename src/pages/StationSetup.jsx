import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { MonitorSmartphone, LogOut, ShieldCheck, ArrowRight } from 'lucide-react';
import { getActiveElection, applyTheme, setStation, logAudit, ROLES } from '@/lib/ems';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';

export default function StationSetup() {
  const [user, setUser] = useState(null);
  const [election, setElection] = useState(null);
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    getActiveElection().then((e) => { setElection(e); applyTheme(e); });
  }, []);

  const load = async () => {
    if (!election) return;
    setLoading(true);
    setStations(await base44.entities.VotingStation.filter({ election_id: election.id }, '-created_date'));
    setLoading(false);
  };
  useEffect(() => { load(); }, [election]);

  const activate = async (station) => {
    setActivating(station.id);
    // Bring the station online and stamp the officer on duty.
    await base44.entities.VotingStation.update(station.id, {
      status: 'online',
      officer_name: user?.full_name || user?.email || station.officer_name,
      last_activity: new Date().toISOString(),
    });
    setStation({ id: station.id, name: station.name, location: station.location });
    await logAudit(`Station activated: ${station.name}`, 'system', `Officer: ${user?.full_name || user?.email}`, election.id);
    toast({ title: 'Station is now online', description: `${station.name} ready for voting` });
    setActivating(null);
    navigate('/vote');
  };

  const signOut = () => base44.auth.logout('/login');

  if (!election) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <MonitorSmartphone className="h-10 w-10 mx-auto text-slate-400" />
          <p className="mt-4 font-medium text-slate-800 dark:text-slate-200">No active election</p>
          <p className="text-sm text-slate-500">Ask an administrator to publish an election first.</p>
          <Button variant="outline" className="mt-6 rounded-xl" onClick={signOut}>Sign out</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950/60 backdrop-blur-xl px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl grid place-items-center text-white font-bold" style={{ background: 'var(--ems-primary)' }}>B</div>
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">BallotOS · Polling Assistant</p>
            <p className="text-xs text-slate-500">{election.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{user?.full_name || user?.email}</p>
            <p className="text-[11px] text-slate-500">{ROLES[user?.ems_role] || 'Polling Assistant'}</p>
          </div>
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <ShieldCheck className="h-10 w-10 mx-auto" style={{ color: 'var(--ems-primary)' }} />
          <h1 className="mt-4 text-2xl font-semibold text-slate-900 dark:text-white">Select your polling station</h1>
          <p className="text-slate-500 mt-1">The station you pick will go online and be ready for voters on this computer.</p>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center"><div className="h-8 w-8 rounded-full border-4 border-slate-200 animate-spin" style={{ borderTopColor: 'var(--ems-primary)' }} /></div>
        ) : stations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 py-16 text-center">
            <p className="text-slate-500">No stations configured for this election.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {stations.map(s => (
              <div key={s.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl grid place-items-center" style={{ background: 'var(--ems-primary)10', color: 'var(--ems-primary)' }}>
                  <MonitorSmartphone className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-white">{s.name}</p>
                  <p className="text-sm text-slate-500 truncate">{s.location || 'No location'} · {s.votes_processed || 0} votes processed</p>
                </div>
                <Badge className="rounded-lg" style={{ background: s.status === 'online' ? '#16a34a' : '#94a3b8' }}>{s.status}</Badge>
                <Button className="rounded-xl h-11" style={{ background: 'var(--ems-primary)' }} disabled={activating === s.id}
                  onClick={() => activate(s)}>
                  {activating === s.id ? 'Activating…' : <>Open <ArrowRight className="h-4 w-4 ml-2" /></>}
                </Button>
              </div>
            ))}
          </div>
        )}

        {stations.length > 0 && (
          <p className="text-center text-xs text-slate-400 mt-8">
            Last activity {stations[0]?.last_activity ? format(new Date(stations[0].last_activity), 'PP p') : 'never'}
          </p>
        )}
      </main>
    </div>
  );
}