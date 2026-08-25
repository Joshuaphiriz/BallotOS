import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Users, Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import PageHeader from '@/components/ems/PageHeader';
import EmptyState from '@/components/ems/EmptyState';
import Loader from '@/components/ems/Loader';
import ImportPanel from '@/components/ems/ImportPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { logAudit } from '@/lib/ems';

export const STUDENT_FIELDS = [
  { key: 'computer_number', label: 'Computer Number', required: true },
  { key: 'full_name', label: 'Full Name' },
  { key: 'programme', label: 'Programme' },
  { key: 'year', label: 'Year of Study', required: true },
  { key: 'gender', label: 'Gender' },
  { key: 'faculty', label: 'Faculty' },
  { key: 'school', label: 'School' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
];

export default function Students() {
  const { election } = useOutletContext();
  const [students, setStudents] = useState(null);
  const [votesByStudent, setVotesByStudent] = useState({});
  const [requiredCount, setRequiredCount] = useState(0);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    if (!election) return setStudents([]);
    const [studentRows, votes, positions, candidates] = await Promise.all([
      base44.entities.Student.filter({ election_id: election.id }, '-created_date'),
      base44.entities.Vote.filter({ election_id: election.id }, '-created_date'),
      base44.entities.Position.filter({ election_id: election.id }),
      base44.entities.Candidate.filter({ election_id: election.id }),
    ]);
    setStudents(studentRows);
    setRequiredCount(positions.filter(p => candidates.some(c => c.position_id === p.id)).length);
    const map = {};
    votes.forEach(v => { map[v.student_id] = v; });
    setVotesByStudent(map);
  };
  useEffect(() => { load(); }, [election]);

  const handleImport = async (rows) => {
    setBusy(true);
    const existing = new Set((students || []).map(s => s.computer_number));
    const fresh = [], dupes = [];
    rows.forEach(r => {
      if (existing.has(r.computer_number)) dupes.push(r.computer_number);
      else { existing.add(r.computer_number); fresh.push({ ...r, election_id: election.id, has_voted: false }); }
    });
    for (let i = 0; i < fresh.length; i += 200) await base44.entities.Student.bulkCreate(fresh.slice(i, i + 200));
    await logAudit(`Imported ${fresh.length} students`, 'import', `${dupes.length} duplicates skipped`, election.id);
    toast({ title: 'Import complete', description: `${fresh.length} added · ${dupes.length} duplicates skipped` });
    setBusy(false);
    load();
  };

  const clearAll = async () => {
    if (!window.confirm(`Delete all ${students.length} students? This clears the voter roll so you can re-import.`)) return;
    setBusy(true);
    await base44.entities.Student.deleteMany({ election_id: election.id });
    await logAudit(`Cleared all students`, 'import', `${students.length} deleted`, election.id);
    toast({ title: 'All students deleted' });
    setBusy(false);
    load();
  };

  // Recovers a voter incorrectly locked out by an incomplete ballot (e.g. a
  // UI glitch that submitted before every position was selected) — deletes
  // the erroneous vote and reopens that computer number to vote again.
  // Always audit-logged so it's transparent, not silent.
  const resetVoter = async (s) => {
    const vote = votesByStudent[s.id];
    const detail = vote ? `Had recorded ${vote.selections?.length || 0}/${requiredCount} selections` : 'No vote record found';
    if (!window.confirm(`Reset voting status for ${s.full_name || s.computer_number}?\n\n${detail}. This deletes their existing vote (if any) and allows them to vote again.`)) return;
    setBusy(true);
    if (vote) await base44.entities.Vote.delete(vote.id);
    await base44.entities.Student.update(s.id, { has_voted: false, voted_at: null });
    await logAudit(`Voting status reset: ${s.computer_number}`, 'vote', detail, election.id);
    toast({ title: 'Voting status reset', description: `${s.computer_number} can vote again` });
    setBusy(false);
    load();
  };

  if (!election) return <p className="text-slate-500">Create an election first.</p>;
  if (!students) return <Loader />;

  const filtered = students.filter(s =>
    `${s.full_name} ${s.computer_number} ${s.programme}`.toLowerCase().includes(q.toLowerCase()));

  const incomplete = students.filter(s => s.has_voted && votesByStudent[s.id] && (votesByStudent[s.id].selections?.length || 0) < requiredCount);

  return (
    <div>
      <PageHeader title="Students" subtitle={`${students.length.toLocaleString()} registered voters · ${students.filter(s => s.has_voted).length} have voted`} />
      {incomplete.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 px-5 py-4 mb-6">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            {incomplete.length} voter{incomplete.length !== 1 ? 's have' : ' has'} an incomplete ballot on record (fewer selections than the {requiredCount} contested positions) — likely locked out by a submission glitch rather than an intentional partial vote. Search their computer number below and click <strong>Reset</strong> to let them vote again.
          </p>
        </div>
      )}
      <Tabs defaultValue="roll">
        <TabsList className="rounded-xl mb-6">
          <TabsTrigger value="roll" className="rounded-lg">Voter Roll</TabsTrigger>
          <TabsTrigger value="import" className="rounded-lg">Import</TabsTrigger>
        </TabsList>

        <TabsContent value="roll">
          {students.length === 0 ? (
            <EmptyState icon={Users} title="No students imported" description="Upload your voter roll from the Import tab." />
          ) : (
            <>
              <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name, computer number or programme" className="rounded-xl mb-4 max-w-md h-11" />
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/60">
                    <tr>{['Computer No.', 'Full Name', 'Programme', 'Year', 'Gender', 'Status', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">{h}</th>))}</tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 200).map(s => {
                      const vote = votesByStudent[s.id];
                      const selCount = vote?.selections?.length || 0;
                      const isIncomplete = s.has_voted && vote && selCount < requiredCount;
                      return (
                      <tr key={s.id} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="px-4 py-3 font-mono text-slate-800 dark:text-slate-200">{s.computer_number}</td>
                        <td className="px-4 py-3">{s.full_name}</td>
                        <td className="px-4 py-3 text-slate-500">{s.programme || '—'}</td>
                        <td className="px-4 py-3 text-slate-500">{s.year || '—'}</td>
                        <td className="px-4 py-3 text-slate-500">{s.gender || '—'}</td>
                        <td className="px-4 py-3">
                          {s.has_voted
                            ? (isIncomplete
                                ? <Badge className="rounded-lg bg-amber-500 hover:bg-amber-500">Incomplete ({selCount}/{requiredCount})</Badge>
                                : <Badge className="rounded-lg" style={{ background: 'var(--ems-secondary)' }}>Voted</Badge>)
                            : <Badge variant="outline" className="rounded-lg">Eligible</Badge>}
                        </td>
                        <td className="px-4 py-3">
                          {s.has_voted && (
                            <Button variant="ghost" size="sm" className="rounded-lg h-8 text-xs text-slate-500 hover:text-slate-900" onClick={() => resetVoter(s)} disabled={busy}>
                              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />Reset
                            </Button>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filtered.length > 200 && <p className="text-xs text-slate-500 mt-3">Showing first 200 of {filtered.length} matches.</p>}
            </>
          )}
        </TabsContent>

        <TabsContent value="import">
          {students.length > 0 && (
            <div className="flex items-center justify-between rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 px-5 py-4 mb-6">
              <p className="text-sm text-amber-800 dark:text-amber-200">{students.length.toLocaleString()} students currently imported. Clear them to start fresh.</p>
              <Button variant="outline" disabled={busy} onClick={clearAll} className="rounded-xl h-9 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"><Trash2 className="h-4 w-4 mr-2" />Delete all</Button>
            </div>
          )}
          <ImportPanel fields={STUDENT_FIELDS} onImport={handleImport} busy={busy} />
        </TabsContent>
      </Tabs>
    </div>
  );
}