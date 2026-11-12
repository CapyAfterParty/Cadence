import { NavLink, useLocation } from 'react-router-dom';
import { FileText, Layers, ListPlus, Lock, Plus, Search, Settings, Timer } from 'lucide-react';
import { useData } from '../db/db';
import { openUI, settings } from '../lib/state';
import { lockNow } from '../lib/security';
import { todayPlan } from '../lib/plan';
import { dueMistakes, isCheckinDone } from '../lib/stats';
import { isSunday, weekStartKey } from '../lib/dates';
import { OWNER } from '../owner';
import { LogoMark } from './Logo';

/** Top bar: the mark, the labelled pill navigation, and search / lock / you. */
export function TopNav() {
  const { pathname } = useLocation();
  const data = useData();
  const st = settings.use();
  const planLeft = data ? todayPlan(data, st.redoDays, st.lastSubjectId).filter((p) => !p.done).length : 0;
  const due = data ? dueMistakes(data, st.redoDays).length : 0;
  const reviewDue = !!data && isSunday() && !isCheckinDone(data.checkins.find((c) => c.weekStart === weekStartKey()));

  const items: { to: string; label: string; match: (p: string) => boolean; badge?: number | string }[] = [
    { to: '/', label: 'Today', match: (p) => p === '/', badge: planLeft || undefined },
    { to: '/progress', label: 'Progress', match: (p) => p.startsWith('/progress') },
    { to: '/subjects', label: 'Courses', match: (p) => p.startsWith('/subjects') || p.startsWith('/notes') },
    { to: '/mistakes', label: 'Mistakes', match: (p) => p.startsWith('/mistakes') || p.startsWith('/redo'), badge: due || undefined },
    { to: '/papers', label: 'Tests', match: (p) => p.startsWith('/papers') },
    { to: '/timer', label: 'Focus', match: (p) => p.startsWith('/timer') },
    { to: '/checkin', label: 'Review', match: (p) => p.startsWith('/checkin'), badge: reviewDue ? '•' : undefined },
  ];

  return (
    <header className="topnav">
      <NavLink to="/" className="tn-logo" aria-label="Summit OS, Today">
        <LogoMark size="1.35rem" />
      </NavLink>
      <nav className="tn-pills" aria-label="Main">
        {items.map((it) => {
          const on = it.match(pathname);
          return (
            <NavLink key={it.to} to={it.to} end={it.to === '/'} className={on ? 'tn-pill on' : 'tn-pill'} aria-current={on ? 'page' : undefined}>
              {it.label}
              {it.badge != null && <span className="tn-badge num">{it.badge}</span>}
            </NavLink>
          );
        })}
      </nav>
      <div className="tn-right">
        <button type="button" className="tn-circle" aria-label="Search (⌘K)" onClick={() => openUI({ palette: true })}>
          <Search size={16} strokeWidth={1.9} />
        </button>
        <button type="button" className="tn-circle" aria-label="Lock Summit OS (⇧⌘L)" onClick={lockNow}>
          <Lock size={15} strokeWidth={1.9} />
        </button>
        <NavLink to="/settings" className={pathname.startsWith('/settings') ? 'tn-me on' : 'tn-me'} aria-label="Settings">
          {OWNER.name[0]}
        </NavLink>
      </div>
    </header>
  );
}

/** Floating action rail. */
export function Sidebar() {
  const { pathname } = useLocation();
  const st = settings.use();
  const actions = [
    { label: 'Log flashcards', icon: Layers, run: () => openUI({ flashLog: true }) },
    { label: 'Mistakes from a test', icon: ListPlus, run: () => openUI({ bulk: { subjectId: st.lastSubjectId } }) },
    { label: 'Log a test', icon: FileText, run: () => openUI({ logPaper: { preset: { subjectId: st.lastSubjectId } } }) },
  ];
  return (
    <>
      <TopNav />
      <aside className="rail" aria-label="Quick actions">
        <button type="button" className="rail-btn primary" onClick={() => openUI({ quickAdd: { preset: { subjectId: st.lastSubjectId } } })} aria-label="New mistake (N)">
          <Plus size={18} strokeWidth={2.4} />
          <span className="tip">
            New mistake <kbd className="k">N</kbd>
          </span>
        </button>
        <NavLink to="/timer" className={pathname.startsWith('/timer') ? 'rail-btn white' : 'rail-btn'} aria-label="Focus timer">
          <Timer size={17} strokeWidth={1.9} />
          <span className="tip">Focus timer</span>
        </NavLink>
        <span className="rail-sep" />
        {actions.map(({ label, icon: Icon, run }) => (
          <button key={label} type="button" className="rail-btn" onClick={run} aria-label={label}>
            <Icon size={17} strokeWidth={1.9} />
            <span className="tip">{label}</span>
          </button>
        ))}
        <span className="rail-sep" />
        <NavLink to="/settings" className={pathname.startsWith('/settings') ? 'rail-btn white' : 'rail-btn'} aria-label="Settings">
          <Settings size={17} strokeWidth={1.9} />
          <span className="tip">Settings</span>
        </NavLink>
      </aside>
    </>
  );
}
