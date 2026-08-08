import React, { useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/ems/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';

export default function Settings() {
  const { election, setElection } = useOutletContext();
  const [dark, setDark] = useState(localStorage.getItem('ballotos-dark') === '1');
  const [timeout, setTimeoutMins] = useState(localStorage.getItem('ballotos-timeout') || '15');
  const [dates, setDates] = useState({ starts_at: '', ends_at: '' });
  const { toast } = useToast();

  useEffect(() => {
    if (election) setDates({ starts_at: election.starts_at?.slice(0, 16) || '', ends_at: election.ends_at?.slice(0, 16) || '' });
  }, [election]);

  const toggleDark = (v) => {
    setDark(v);
    document.documentElement.classList.toggle('dark', v);
    localStorage.setItem('ballotos-dark', v ? '1' : '0');
  };

  const saveRules = async () => {
    await base44.entities.Election.update(election.id, {
      starts_at: dates.starts_at ? new Date(dates.starts_at).toISOString() : undefined,
      ends_at: dates.ends_at ? new Date(dates.ends_at).toISOString() : undefined,
    });
    setElection({ ...election, ...dates });
    toast({ title: 'Election rules saved' });
  };

  return (
    <div>
      <PageHeader title="Settings" subtitle="System preferences, election rules and access" />
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Appearance</h3>
          <div className="flex items-center justify-between">
            <div><p className="text-sm font-medium text-slate-800 dark:text-slate-200">Dark mode</p>
              <p className="text-xs text-slate-500">Reduces glare in polling rooms</p></div>
            <Switch checked={dark} onCheckedChange={toggleDark} />
          </div>
          <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
            <p className="text-sm text-slate-600 dark:text-slate-400">Association name, logo and theme colors live in <Link to="/branding" className="underline">Branding</Link>.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Election rules</h3>
          {election ? (
            <div className="space-y-4">
              <div><p className="text-xs uppercase tracking-widest text-slate-500 mb-1.5">Polls open</p>
                <Input type="datetime-local" value={dates.starts_at} onChange={e => setDates(d => ({ ...d, starts_at: e.target.value }))} className="rounded-xl h-11" /></div>
              <div><p className="text-xs uppercase tracking-widest text-slate-500 mb-1.5">Polls close</p>
                <Input type="datetime-local" value={dates.ends_at} onChange={e => setDates(d => ({ ...d, ends_at: e.target.value }))} className="rounded-xl h-11" /></div>
              <Button onClick={saveRules} className="rounded-xl h-11" style={{ background: 'var(--ems-primary)' }}>Save rules</Button>
            </div>
          ) : <p className="text-sm text-slate-500">No active election.</p>}
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Security</h3>
          <p className="text-xs uppercase tracking-widest text-slate-500 mb-1.5">Auto-logout after inactivity (minutes)</p>
          <Input type="number" min="1" value={timeout} className="rounded-xl h-11 max-w-[160px]"
            onChange={e => { setTimeoutMins(e.target.value); localStorage.setItem('ballotos-timeout', e.target.value); }} />
          <p className="text-xs text-slate-500 mt-2">Idle sessions are signed out automatically to protect the polling station.</p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">User management</h3>
          <p className="text-sm text-slate-500 mb-4">Invite administrators, officers and auditors and assign their permissions.</p>
          <Link to="/users"><Button variant="outline" className="rounded-xl h-11">Manage users</Button></Link>
        </div>
      </div>
    </div>
  );
}