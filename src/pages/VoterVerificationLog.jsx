import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { KeyRound, AlertTriangle } from 'lucide-react';
import PageHeader from '@/components/ems/PageHeader';
import EmptyState from '@/components/ems/EmptyState';
import Loader from '@/components/ems/Loader';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';

const EVENT_TYPES = [
  'code_requested', 'code_emailed', 'code_failed_to_send', 'code_wrong',
  'code_accepted', 'code_expired', 'locked', 'ballot_cast',
  'ballot_notice_sent', 'ballot_notice_failed', 'admin_reset',
];

// A single IP touching this many distinct computer numbers inside the time
// window below is a strong signal of someone working through a list of
// numbers rather than one voter verifying themselves.
const FANOUT_THRESHOLD = 10;
const FANOUT_WINDOW_MS = 10 * 60 * 1000;

export default function VoterVerificationLog() {
  const { user, election } = useOutletContext();
  const [logs, setLogs] = useState(null);
  const [eventFilter, setEventFilter] = useState('all');
  const [numberFilter, setNumberFilter] = useState('');
  const [resetTarget, setResetTarget] = useState(null); // computer_number being reset
  const [resetReason, setResetReason] = useState('');
  const [resetting, setResetting] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    if (!election) return setLogs([]);
    const all = await base44.entities.VoterAuditLog.list('-created_date', 1000);
    const scoped = user?.ems_role === 'observer' ? all.filter((l) => l.election_id === election.id) : all;
    setLogs(scoped);
  };

  useEffect(() => { load(); }, [user, election]);

  // Live updates — any insert/update to voter_audit_log triggers a reload.
  useEffect(() => {
    const unsubscribe = base44.entities.VoterAuditLog.subscribe(load);
    return unsubscribe;
  }, [user, election]);

  // IPs that touched more than FANOUT_THRESHOLD distinct computer numbers
  // within any FANOUT_WINDOW_MS window, computed from the loaded page of logs.
  const suspiciousIps = useMemo(() => {
    if (!logs) return new Set();
    const byIp = {};
    logs.forEach((l) => {
      if (!l.ip_address) return;
      (byIp[l.ip_address] ||= []).push(l);
    });
    const flagged = new Set();
    Object.entries(byIp).forEach(([ip, entries]) => {
      const sorted = [...entries].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      for (let i = 0; i < sorted.length; i++) {
        const windowStart = new Date(sorted[i].created_date).getTime();
        const numbers = new Set();
        for (let j = i; j < sorted.length; j++) {
          const t = new Date(sorted[j].created_date).getTime();
          if (t - windowStart > FANOUT_WINDOW_MS) break;
          if (sorted[j].computer_number) numbers.add(sorted[j].computer_number);
        }
        if (numbers.size > FANOUT_THRESHOLD) { flagged.add(ip); break; }
      }
    });
    return flagged;
  }, [logs]);

  if (!logs) return <Loader />;

  const filtered = logs.filter((l) =>
    (eventFilter === 'all' || l.event_type === eventFilter) &&
    (!numberFilter.trim() || (l.computer_number || '').toLowerCase().includes(numberFilter.trim().toLowerCase())));

  const canReset = user?.ems_role === 'admin';

  const openReset = (computerNumber) => { setResetTarget(computerNumber); setResetReason(''); };

  const submitReset = async () => {
    if (!resetReason.trim() || !resetTarget) return;
    setResetting(true);
    try {
      await base44.voterVerification.resetVoter(election.id, resetTarget, resetReason.trim());
      toast({ title: 'Voter reset', description: `${resetTarget} can request a new code.` });
      setResetTarget(null);
      load();
    } catch (err) {
      toast({ title: 'Reset failed', description: err.message, variant: 'destructive' });
    }
    setResetting(false);
  };

  return (
    <div>
      <PageHeader
        title="Voter Verification"
        subtitle={user?.ems_role === 'observer' ? `Verification activity for ${election?.name || 'this election'}` : 'Append-only log of every code request, verification and ballot-cast event'}
      />

      <div className="flex flex-wrap gap-3 mb-6">
        <Select value={eventFilter} onValueChange={setEventFilter}>
          <SelectTrigger className="rounded-xl h-11 w-56"><SelectValue placeholder="Event type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All event types</SelectItem>
            {EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input value={numberFilter} onChange={(e) => setNumberFilter(e.target.value)} placeholder="Filter by computer number" className="rounded-xl h-11 max-w-xs" />
      </div>

      {suspiciousIps.size > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-5 py-4 mb-6">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-red-800 dark:text-red-200">
            {suspiciousIps.size} IP address{suspiciousIps.size !== 1 ? 'es' : ''} touched more than {FANOUT_THRESHOLD} different computer numbers within 10 minutes — rows below are highlighted. This may indicate one person working through a list of numbers rather than individual voters.
          </p>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState icon={KeyRound} title="No verification activity" description="Code requests, verifications and ballot-cast events will appear here as voters use the online portal." />
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>{['Time', 'Event', 'Computer No.', 'Email', 'IP', 'Device', 'Admin / Reason', canReset ? '' : null].filter((h) => h !== null).map((h) => (
                <th key={h} className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">{h}</th>))}</tr>
            </thead>
            <tbody>
              {filtered.map((l) => {
                const flagged = l.ip_address && suspiciousIps.has(l.ip_address);
                const isLocked = l.event_type === 'locked';
                return (
                  <tr key={l.id} className={`border-t border-slate-100 dark:border-slate-800 ${flagged ? 'bg-red-50 dark:bg-red-950/20' : ''}`}>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{format(new Date(l.created_date), 'PP p')}</td>
                    <td className="px-4 py-3"><Badge variant={isLocked ? 'destructive' : 'secondary'} className="rounded-lg">{l.event_type.replace(/_/g, ' ')}</Badge></td>
                    <td className="px-4 py-3 font-mono text-slate-800 dark:text-slate-200">{l.computer_number || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{l.masked_email || '—'}</td>
                    <td className={`px-4 py-3 font-mono text-xs ${flagged ? 'text-red-700 dark:text-red-300 font-semibold' : 'text-slate-500'}`}>{l.ip_address || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs max-w-[220px] truncate" title={l.user_agent}>{l.user_agent || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{l.reason || '—'}</td>
                    {canReset && (
                      <td className="px-4 py-3">
                        {isLocked && l.computer_number && (
                          <Button variant="ghost" size="sm" className="rounded-lg h-8 text-xs" onClick={() => openReset(l.computer_number)}>Reset</Button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!resetTarget} onOpenChange={(open) => !open && setResetTarget(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Reset voter {resetTarget}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500">This clears their lock so they can request a new code. It cannot un-cast a ballot that has already been submitted. A reason is required and will be permanently logged.</p>
          <Textarea value={resetReason} onChange={(e) => setResetReason(e.target.value)} placeholder="Reason for reset (required)" className="rounded-xl" />
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setResetTarget(null)}>Cancel</Button>
            <Button className="rounded-xl" disabled={!resetReason.trim() || resetting} onClick={submitReset}>{resetting ? 'Resetting…' : 'Confirm reset'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
