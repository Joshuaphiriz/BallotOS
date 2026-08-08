import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Vote, Wand2, Users, UserSquare2, ListOrdered, MonitorSmartphone,
  BarChart3, FileText, Archive, Palette, ScrollText, ShieldCheck, Settings
} from 'lucide-react';
import { can } from '@/lib/ems';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, cap: null },
  { to: '/elections', label: 'Elections', icon: Vote, cap: 'manage' },
  { to: '/wizard', label: 'Election Wizard', icon: Wand2, cap: 'manage' },
  { to: '/students', label: 'Students', icon: Users, cap: 'manage' },
  { to: '/positions', label: 'Positions', icon: ListOrdered, cap: 'manage' },
  { to: '/candidates', label: 'Candidates', icon: UserSquare2, cap: 'manage' },
  { to: '/stations', label: 'Voting Stations', icon: MonitorSmartphone, cap: 'manage' },
  { to: '/results', label: 'Results', icon: BarChart3, cap: 'results' },
  { to: '/reports', label: 'Reports', icon: FileText, cap: 'reports' },
  { to: '/archives', label: 'Archives', icon: Archive, cap: 'manage' },
  { to: '/users', label: 'Users', icon: Users, cap: 'users' },
  { to: '/branding', label: 'Branding', icon: Palette, cap: 'manage' },
  { to: '/settings', label: 'Settings', icon: Settings, cap: 'manage' },
  { to: '/audit-logs', label: 'Audit Logs', icon: ScrollText, cap: 'logs' },
];

export default function Sidebar({ user, election }) {
  const items = NAV.filter(n => !n.cap || can(user, n.cap));
  return (
    <aside className="w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950/60 backdrop-blur-xl flex flex-col">
      <div className="px-5 py-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl grid place-items-center text-white font-bold" style={{ background: 'var(--ems-primary)' }}>B</div>
          <div>
            <p className="font-semibold tracking-tight text-slate-900 dark:text-white">BallotOS</p>
            <p className="text-[11px] text-slate-500">Election Management</p>
          </div>
        </div>
        {election && (
          <div className="mt-4 rounded-xl px-3 py-2 text-xs" style={{ background: 'var(--ems-primary)0f' }}>
            <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{election.name}</p>
            <p className="text-slate-500 truncate">{election.association_abbr || election.association_name}</p>
          </div>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {items.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${
                isActive ? 'text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'
              }`
            }
            style={({ isActive }) => (isActive ? { background: 'var(--ems-primary)' } : {})}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}