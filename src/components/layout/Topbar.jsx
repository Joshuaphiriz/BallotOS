import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Moon, Sun, LogOut, ArrowLeft, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { ROLES } from '@/lib/ems';

export default function Topbar({ user, query, setQuery, dark, toggleDark }) {
  const navigate = useNavigate();
  return (
    <header className="h-16 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950/60 backdrop-blur-xl px-6 flex items-center gap-4">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => navigate(-1)} title="Go back"><ArrowLeft className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => navigate(1)} title="Go forward"><ArrowRight className="h-4 w-4" /></Button>
      </div>
      <div className="relative max-w-md flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search students, candidates, elections…"
          className="pl-9 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
        />
      </div>
      <div className="ml-auto flex items-center gap-3">
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={toggleDark}>
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <div className="text-right hidden md:block">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{user?.full_name || user?.email}</p>
          <p className="text-[11px] text-slate-500">{ROLES[user?.ems_role] || 'System Administrator'}</p>
        </div>
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => base44.auth.logout('/login')}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}