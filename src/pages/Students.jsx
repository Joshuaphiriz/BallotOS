import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Users, Trash2 } from 'lucide-react';
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
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    if (!election) return setStudents([]);
    setStudents(await base44.entities.Student.filter({ election_id: election.id }, '-created_date', 5000));
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

  if (!election) return <p className="text-slate-500">Create an election first.</p>;
  if (!students) return <Loader />;

  const filtered = students.filter(s =>
    `${s.full_name} ${s.computer_number} ${s.programme}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageHeader title="Students" subtitle={`${students.length.toLocaleString()} registered voters · ${students.filter(s => s.has_voted).length} have voted`} />
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
                    <tr>{['Computer No.', 'Full Name', 'Programme', 'Year', 'Gender', 'Status'].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">{h}</th>))}</tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 200).map(s => (
                      <tr key={s.id} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="px-4 py-3 font-mono text-slate-800 dark:text-slate-200">{s.computer_number}</td>
                        <td className="px-4 py-3">{s.full_name}</td>
                        <td className="px-4 py-3 text-slate-500">{s.programme || '—'}</td>
                        <td className="px-4 py-3 text-slate-500">{s.year || '—'}</td>
                        <td className="px-4 py-3 text-slate-500">{s.gender || '—'}</td>
                        <td className="px-4 py-3">
                          {s.has_voted ? <Badge className="rounded-lg" style={{ background: 'var(--ems-secondary)' }}>Voted</Badge>
                            : <Badge variant="outline" className="rounded-lg">Eligible</Badge>}
                        </td>
                      </tr>
                    ))}
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