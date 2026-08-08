import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function CandidateForm({ positions, electionId, onSaved }) {
  const [form, setForm] = useState({ full_name: '', aka: '', position_id: '', manifesto: '', biography: '', photo_url: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const upload = async (file) => {
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    set('photo_url', file_url);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await base44.entities.Candidate.create({ ...form, election_id: electionId });
    setSaving(false);
    setForm({ full_name: '', aka: '', position_id: '', manifesto: '', biography: '', photo_url: '' });
    onSaved();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input required placeholder="Full name" value={form.full_name} onChange={e => set('full_name', e.target.value)} className="rounded-xl h-11" />
      <Input placeholder="AKA / nickname" value={form.aka} onChange={e => set('aka', e.target.value)} className="rounded-xl h-11" />
      <Select value={form.position_id} onValueChange={v => set('position_id', v)}>
        <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Position" /></SelectTrigger>
        <SelectContent>{positions.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
      </Select>
      <Textarea placeholder="Manifesto" value={form.manifesto} onChange={e => set('manifesto', e.target.value)} className="rounded-xl" />
      <Textarea placeholder="Biography" value={form.biography} onChange={e => set('biography', e.target.value)} className="rounded-xl" />
      <div>
        <p className="text-xs uppercase tracking-widest text-slate-500 mb-1.5">Photo</p>
        <Input type="file" accept="image/*" onChange={e => e.target.files[0] && upload(e.target.files[0])} className="rounded-xl" />
        {form.photo_url && <p className="text-xs text-green-600 mt-1">Photo uploaded</p>}
      </div>
      <Button type="submit" disabled={saving} className="w-full rounded-xl h-11" style={{ background: 'var(--ems-primary)' }}>{saving ? 'Saving…' : 'Save candidate'}</Button>
    </form>
  );
}