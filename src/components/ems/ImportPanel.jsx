import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { parseDelimited } from '@/lib/ems';

export default function ImportPanel({ fields, onImport, busy }) {
  const [headers, setHeaders] = useState(null);
  const [rows, setRows] = useState(null);
  const [map, setMap] = useState({});

  const autoMatch = (hdrs) => {
    const auto = {};
    fields.forEach(f => {
      const hit = hdrs.find(h => h.toLowerCase().replace(/[^a-z]/g, '') === f.key.replace(/[^a-z]/g, '')
        || h.toLowerCase().includes(f.label.toLowerCase()));
      if (hit) auto[f.key] = hit;
    });
    return auto;
  };

  const isExcel = (f) => /\.(xlsx|xls|xlsm|ods)$/i.test(f.name);

  const parseExcel = async (file) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
    if (!json.length) return { headers: [], rows: [] };
    const headers = json[0].map(h => String(h ?? '').trim());
    const rows = json.slice(1).map(r => r.map(c => String(c ?? '').trim()));
    return { headers, rows };
  };

  const handleFile = async (file) => {
    const { headers: rawHeaders, rows: rawRows } = isExcel(file)
      ? await parseExcel(file)
      : parseDelimited(await file.text());
    setHeaders(rawHeaders);
    setRows(rawRows);
    setMap(autoMatch(rawHeaders));
  };

  const renameHeader = (idx, value) => {
    setHeaders(prev => {
      const next = [...prev];
      next[idx] = value;
      setMap(autoMatch(next));
      return next;
    });
  };

  const records = () => rows.map(r => {
    const obj = {};
    fields.forEach(f => {
      const idx = headers.indexOf(map[f.key]);
      if (idx > -1) obj[f.key] = String(r[idx] ?? '').trim();
    });
    return obj;
  }).filter(o => fields.filter(f => f.required).every(f => o[f.key]));

  return (
    <div className="space-y-6">
      <label className="block rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 p-10 text-center cursor-pointer hover:border-slate-400 transition-colors">
        <input type="file" accept=".csv,.tsv,.txt,.xlsx,.xls,.xlsm,.ods" className="hidden" onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])} />
        <div className="flex items-center justify-center gap-2 text-slate-400">
          <Upload className="h-6 w-6" />
          <FileSpreadsheet className="h-6 w-6" />
        </div>
        <p className="mt-3 font-medium text-slate-800 dark:text-slate-200">Upload a CSV or Excel file</p>
        <p className="text-sm text-slate-500">Drop a .csv, .xlsx or .xls file here. You can rename and remap columns before importing.</p>
      </label>

      {headers && (
        <>
          <div>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">Edit column titles</p>
            <p className="text-xs text-slate-500 mb-3">Rename any column header before matching it to a field. Matching updates automatically.</p>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              {headers.map((h, idx) => (
                <Input key={idx} value={h} onChange={(e) => renameHeader(idx, e.target.value)}
                  className="rounded-xl h-10 text-sm" placeholder={`Column ${idx + 1}`} />
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {fields.map(f => (
              <div key={f.key}>
                <p className="text-xs uppercase tracking-widest text-slate-500 mb-1.5">{f.label}{f.required && ' *'}</p>
                <Select value={map[f.key] || '__none'} onValueChange={(v) => setMap(m => ({ ...m, [f.key]: v === '__none' ? undefined : v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Not mapped" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Not mapped</SelectItem>
                    {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>{fields.map(f => <th key={f.key} className="text-left px-4 py-2.5 font-medium text-slate-600">{f.label}</th>)}</tr>
              </thead>
              <tbody>
                {records().slice(0, 5).map((r, i) => (
                  <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                    {fields.map(f => <td key={f.key} className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{r[f.key] || '—'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{records().length} valid rows of {rows.length} · {rows.length - records().length} skipped</p>
            <Button disabled={busy || !records().length} className="rounded-xl h-11" style={{ background: 'var(--ems-primary)' }}
              onClick={() => onImport(records())}>{busy ? 'Importing…' : `Import ${records().length} records`}</Button>
          </div>
        </>
      )}
    </div>
  );
}