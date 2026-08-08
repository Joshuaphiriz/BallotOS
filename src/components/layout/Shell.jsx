import React, { useEffect, useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import GlobalSearch from '@/components/ems/GlobalSearch';
import { getActiveElection, applyTheme } from '@/lib/ems';

export default function Shell() {
  const [user, setUser] = useState(null);
  const [election, setElection] = useState(null);
  const [query, setQuery] = useState('');
  const [dark, setDark] = useState(() => localStorage.getItem('ballotos-dark') === '1');

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    getActiveElection().then((e) => { setElection(e); applyTheme(e); });
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('ballotos-dark', dark ? '1' : '0');
  }, [dark]);

  // Polling assistants don't use the admin shell — send them to station setup.
  if (user && user.ems_role === 'polling_assistant') {
    return <Navigate to="/station-setup" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Sidebar user={user} election={election} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={user} query={query} setQuery={setQuery} dark={dark} toggleDark={() => setDark(d => !d)} />
        <main className="flex-1 overflow-y-auto relative">
          {query.trim().length > 1 && <GlobalSearch query={query} onClose={() => setQuery('')} />}
          <div className="mx-auto max-w-[1400px] px-8 py-8">
            <Outlet context={{ user, election, setElection }} />
          </div>
        </main>
      </div>
    </div>
  );
}