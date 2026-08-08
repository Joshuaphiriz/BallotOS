import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import jsPDF from 'jspdf';
import { FileText, Download, Printer, Sheet } from 'lucide-react';
import PageHeader from '@/components/ems/PageHeader';
import Loader from '@/components/ems/Loader';
import { Button } from '@/components/ui/button';
import { tallyResults } from './Results';
import { format } from 'date-fns';

export default function Reports() {
  const { election } = useOutletContext();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!election) return;
    Promise.all([
      base44.entities.Position.filter({ election_id: election.id }, 'order'),
      base44.entities.Candidate.filter({ election_id: election.id }, '-created_date', 500),
      base44.entities.Vote.filter({ election_id: election.id }, '-created_date', 5000),
      base44.entities.Student.filter({ election_id: election.id }, '-created_date', 5000),
    ]).then(([positions, candidates, votes, students]) =>
      setData({ results: tallyResults(positions, candidates, votes), votes, students }));
  }, [election]);

  if (!election) return <p className="text-slate-500">No election available.</p>;
  if (!data) return <Loader label="Compiling report" />;

  const turnout = data.students.length ? ((data.votes.length / data.students.length) * 100).toFixed(1) : '0';

  const exportPdf = () => {
    const doc = new jsPDF();
    let y = 18;
    doc.setFontSize(16); doc.text(election.name, 14, y); y += 7;
    doc.setFontSize(10); doc.text(`${election.association_name || ''} · Generated ${format(new Date(), 'PPpp')}`, 14, y); y += 10;
    doc.text(`Registered voters: ${data.students.length}   Ballots cast: ${data.votes.length}   Turnout: ${turnout}%`, 14, y); y += 10;
    data.results.forEach(r => {
      doc.setFontSize(12); doc.text(r.position, 14, y); y += 6;
      doc.setFontSize(10);
      r.rows.forEach((row, i) => {
        doc.text(`${i === 0 ? '★ ' : '  '}${row.name} — ${row.votes} votes`, 18, y); y += 5.5;
        if (y > 275) { doc.addPage(); y = 18; }
      });
      y += 4;
    });
    doc.save(`${election.name.replace(/\s+/g, '_')}_report.pdf`);
  };

  const exportCsv = () => {
    const lines = [['Position', 'Candidate', 'Votes', 'Winner'].join(',')];
    data.results.forEach(r => r.rows.forEach((row, i) =>
      lines.push([r.position, row.name, row.votes, i === 0 && row.votes > 0 ? 'YES' : ''].join(','))));
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `${election.name.replace(/\s+/g, '_')}_results.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader title="Reports" subtitle="Official election summary, vote totals and winners">
        <Button variant="outline" className="rounded-xl h-11" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Print</Button>
        <Button variant="outline" className="rounded-xl h-11" onClick={exportCsv}><Sheet className="h-4 w-4 mr-2" />Excel (CSV)</Button>
        <Button className="rounded-xl h-11" style={{ background: 'var(--ems-primary)' }} onClick={exportPdf}><Download className="h-4 w-4 mr-2" />PDF</Button>
      </PageHeader>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8">
        <div className="flex items-center gap-3 mb-6">
          <FileText className="h-5 w-5" style={{ color: 'var(--ems-primary)' }} />
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">{election.name} — Election Summary</h2>
            <p className="text-sm text-slate-500">Generated {format(new Date(), 'PPpp')}</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-4 mb-8 text-sm">
          {[['Registered voters', data.students.length], ['Ballots cast', data.votes.length], ['Turnout', `${turnout}%`]].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-slate-50 dark:bg-slate-800 px-4 py-3">
              <p className="text-xs uppercase tracking-widest text-slate-500">{k}</p>
              <p className="text-xl font-semibold text-slate-900 dark:text-white">{v}</p>
            </div>
          ))}
        </div>
        {data.results.map(r => (
          <div key={r.position} className="mb-6">
            <h3 className="font-medium text-slate-900 dark:text-white mb-2">{r.position}</h3>
            <table className="w-full text-sm">
              <tbody>
                {r.rows.map((row, i) => (
                  <tr key={row.name} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2">{row.name}{i === 0 && row.votes > 0 && <span className="ml-2 text-xs font-medium" style={{ color: 'var(--ems-accent)' }}>WINNER</span>}</td>
                    <td className="py-2 text-right text-slate-500">{row.votes} votes</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}