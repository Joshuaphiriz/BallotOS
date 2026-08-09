import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '@/components/ems/PageHeader';
import Loader from '@/components/ems/Loader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { ROLES } from '@/lib/ems';
import { UserPlus, Trash2 } from 'lucide-react';

export default function Users() {
  const [users, setUsers] = useState(null);
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('admin');
  const [inviting, setInviting] = useState(false);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const load = async () => setUsers(await base44.entities.User.list('-created_date', 200));
  useEffect(() => { load(); }, []);

  const invite = async () => {
    if (!email.trim()) return;
    setInviting(true);
    try {
      // Platform role: 'admin' for admin, 'user' for observer/polling_assistant.
      await base44.users.inviteUser(email.trim(), inviteRole === 'admin' ? 'admin' : 'user');
      // Set the custom EMS role on the newly created user record.
      const created = await base44.entities.User.filter({ email: email.trim() });
      if (created.length) await base44.entities.User.update(created[0].id, { ems_role: inviteRole });
      toast({ title: 'Invitation sent', description: `${email} · ${ROLES[inviteRole]}` });
      setEmail(''); load();
    } catch (err) {
      toast({ title: 'Invitation failed', description: err?.message || 'Could not invite user', variant: 'destructive' });
    }
    setInviting(false);
  };

  const setRole = async (u, ems_role) => {
    try {
      await base44.entities.User.update(u.id, { ems_role });
      toast({ title: 'Role updated', description: `${u.full_name || u.email} → ${ROLES[ems_role]}` });
      load();
    } catch (err) {
      toast({ title: 'Could not update role', description: err?.message || 'Try again', variant: 'destructive' });
    }
  };

  const removeUser = async (u) => {
    if (!window.confirm(`Remove ${u.full_name || u.email}? This will revoke their access.`)) return;
    try {
      await base44.users.deleteUser(u.id);
      toast({ title: 'User removed', description: u.email });
      load();
    } catch (err) {
      toast({ title: 'Could not remove user', description: err?.message || 'Try again', variant: 'destructive' });
    }
  };

  if (!users) return <Loader />;

  return (
    <div>
      <PageHeader title="Users" subtitle="Administrators, election officers and auditors" />
      <div className="flex gap-3 mb-6 max-w-2xl">
        <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="Invite by email" className="rounded-xl h-11" />
        <Select value={inviteRole} onValueChange={setInviteRole}>
          <SelectTrigger className="rounded-xl h-11 w-52"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(ROLES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
        </Select>
        <Button onClick={invite} disabled={inviting} className="rounded-xl h-11" style={{ background: 'var(--ems-primary)' }}><UserPlus className="h-4 w-4 mr-2" />{inviting ? 'Inviting…' : 'Invite'}</Button>
      </div>
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/60">
            <tr>{['Name', 'Email', 'System Role', ''].map(h => <th key={h} className="text-left px-5 py-3 font-medium text-slate-600 dark:text-slate-400">{h}</th>)}</tr>
          </thead>
          <tbody>
            {users.map(u => {
              const isSelf = currentUser?.id === u.id;
              return (
              <tr key={u.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-5 py-3 text-slate-900 dark:text-white">{u.full_name || '—'}{isSelf && <span className="ml-2 text-xs text-slate-400">(you)</span>}</td>
                <td className="px-5 py-3 text-slate-500">{u.email}</td>
                <td className="px-5 py-3">
                  <Select value={u.ems_role || 'admin'} onValueChange={v => setRole(u, v)} disabled={isSelf}>
                    <SelectTrigger className="rounded-lg w-56 h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(ROLES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                <td className="px-5 py-3">
                  <Button variant="ghost" size="icon" className="rounded-lg text-slate-400 hover:text-red-600 disabled:opacity-30 disabled:hover:text-slate-400" disabled={isSelf} onClick={() => removeUser(u)}><Trash2 className="h-4 w-4" /></Button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}