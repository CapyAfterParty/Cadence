import { NavLink, useLocation } from 'react-router-dom';
import { BookOpen, CalendarCheck, CircleAlert, FileText, House, Lock, Plus, Settings, Timer } from 'lucide-react';
import { openUI, settings } from '../lib/state';
import { lockNow } from '../lib/security';
import { LogoMark } from './Logo';

const SW = 1.6;

const items = [
  { to: '/', label: 'Home', icon: House, match: (p: string) => p === '/' },
  { to: '/subjects', label: 'Subjects', icon: BookOpen, match: (p: string) => p.startsWith('/subjects') || p.startsWith('/notes') },
  { to: '/mistakes', label: 'Mistakes', icon: CircleAlert, match: (p: string) => p.startsWith('/mistakes') || p.startsWith('/redo') },
  { to: '/papers', label: 'Papers', icon: FileText, match: (p: string) => p.startsWith('/papers') },
  { to: '/timer', label: 'Timer', icon: Timer, match: (p: string) => p.startsWith('/timer') },
  { to: '/checkin', label: 'Check-in', icon: CalendarCheck, match: (p: string) => p.startsWith('/checkin') },
  { to: '/settings', label: 'Settings', icon: Settings, match: (p: string) => p.startsWith('/settings') },
];

export function Sidebar() {
  const { pathname } = useLocation();
  const st = settings.use();
  const active = items.findIndex((i) => i.match(pathname));
  const initials = st.name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <nav className="sidebar" aria-label="Main">
      <NavLink to="/" className="side-logo" aria-label="Cadence home">
        <LogoMark size="2.4rem" />
      </NavLink>
      <div className="dock" style={{ ['--active' as string]: active }}>
        {active >= 0 && <span className="dock-glow" aria-hidden="true" />}
        {active >= 0 && <span className="dock-thumb" aria-hidden="true" />}
        {items.map(({ to, label, icon: Icon }, i) => (
          <NavLink key={to} to={to} className={i === active ? 'side-btn active' : 'side-btn'} aria-label={label} aria-current={i === active ? 'page' : undefined}>
            <Icon size={19} strokeWidth={SW} />
            <span className="tip">{label}</span>
          </NavLink>
        ))}
      </div>
      <div className="side-foot">
        <button
          type="button"
          className="side-add"
          aria-label="Add mistake (N)"
          onClick={() => openUI({ quickAdd: { preset: { subjectId: settings.get().lastSubjectId } } })}
        >
          <Plus size={20} strokeWidth={2.2} />
          <span className="tip">
            Add mistake <kbd className="k">N</kbd>
          </span>
        </button>
        <button type="button" className="side-btn plain" aria-label="Lock Cadence" onClick={lockNow}>
          <Lock size={17} strokeWidth={SW} />
          <span className="tip">
            Lock <kbd className="k">⇧⌘L</kbd>
          </span>
        </button>
        <NavLink to="/settings" className="side-avatar" aria-label="Profile and settings">
          {initials || '·'}
        </NavLink>
      </div>
    </nav>
  );
}
