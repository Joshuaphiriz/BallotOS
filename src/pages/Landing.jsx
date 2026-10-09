import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  ShieldCheck, MonitorSmartphone, BarChart3, ScrollText, Users, Vote,
  ClipboardList, Link as LinkIcon, LineChart,
} from 'lucide-react';

const TITLE = 'BallotOS | Election Management and Online Voting for Associations';
const DESCRIPTION = 'BallotOS is a secure election management system for associations, student unions and clubs in Zambia. Run polling stations or online voting, with live results and audit logs.';

function setMetaDescription(content) {
  let tag = document.querySelector('meta[name="description"]');
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', 'description');
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

const FEATURES = [
  { icon: ShieldCheck, title: 'Online voting with bot protection', desc: 'A secure, shareable voting link protected by Cloudflare Turnstile, so ballots can only be cast by real people.' },
  { icon: MonitorSmartphone, title: 'Polling station mode', desc: 'Run in-person voting from any device at a station, with each voter checked against the roll before casting a ballot.' },
  { icon: BarChart3, title: 'Live results', desc: 'Watch tallies update in real time as votes come in, with a full breakdown by position and candidate.' },
  { icon: ScrollText, title: 'Audit logs', desc: 'Every action — imports, votes, resets, admin changes — is recorded in an immutable trail you can review at any time.' },
  { icon: Users, title: 'Role-based access', desc: 'Admins, observers and polling assistants each see exactly what they need, nothing more.' },
  { icon: Vote, title: 'Built for associations', desc: 'Purpose-built for student unions, clubs and member associations running real elections.' },
];

const STEPS = [
  { icon: ClipboardList, title: 'Set up your election', desc: 'Create your election and import the voter roll in minutes.' },
  { icon: LinkIcon, title: 'Voters cast ballots', desc: 'At polling stations or through a secure online link — their choice.' },
  { icon: LineChart, title: 'Watch results live', desc: 'Results update as votes come in, and you can export the records afterwards.' },
];

export default function Landing() {
  useEffect(() => {
    document.title = TITLE;
    setMetaDescription(DESCRIPTION);
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
      <header className="border-b border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl grid place-items-center text-white font-bold bg-[#1e3a8a]">B</div>
            <span className="font-semibold tracking-tight">BallotOS</span>
          </div>
          <Button asChild className="rounded-xl">
            <Link to="/login">Sign in</Link>
          </Button>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 py-20 sm:py-28 text-center">
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight max-w-3xl mx-auto">
            Run fair, transparent elections for your association
          </h1>
          <p className="mt-6 text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            BallotOS handles voter rolls, polling stations, secure online voting, live results and audit logs, built for associations and student unions in Zambia.
          </p>
          <div className="mt-8">
            <Button asChild size="lg" className="rounded-xl h-12 px-8 text-base bg-[#1e3a8a] hover:bg-[#1e3a8a]/90">
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-center">What BallotOS does</h2>
            <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
                  <div className="h-10 w-10 rounded-xl grid place-items-center bg-[#1e3a8a]/10 text-[#1e3a8a] dark:bg-[#1e3a8a]/20 dark:text-blue-300">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-center">How it works</h2>
          <ol className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-8">
            {STEPS.map(({ icon: Icon, title, desc }, i) => (
              <li key={title} className="text-center">
                <div className="mx-auto h-12 w-12 rounded-2xl grid place-items-center bg-[#1e3a8a] text-white font-semibold">
                  {i + 1}
                </div>
                <Icon className="h-5 w-5 mx-auto mt-4 text-slate-400" aria-hidden="true" />
                <h3 className="mt-2 font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{desc}</p>
              </li>
            ))}
          </ol>
          <div className="mt-14 text-center">
            <Button asChild size="lg" className="rounded-xl h-12 px-8 text-base bg-[#1e3a8a] hover:bg-[#1e3a8a]/90">
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-6xl px-6 py-8 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} BallotOS. Developed by Joshua Phiri — phirijoshua784@gmail.com
        </div>
      </footer>
    </div>
  );
}
