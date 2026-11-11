import { NavLink, useLocation } from 'react-router-dom';
import { BarChart3, BookOpen, CalendarCheck, CircleAlert, FileText, Lock, Plus, Settings, Sun, Timer } from 'lucide-react';
import { useData } from '../db/db';
import { openUI, settings } from '../lib/state';
import { lockNow } from '../lib/security';
import { todayPlan } from '../lib/plan';
import { dueMistakes, isCheckinDone } from '../lib/stats';
import { isSunday, weekStartKey } from '../lib/dates';
import { OWNER } from '../owner';
import { LogoMark, Wordmark } from './Logo';

type Item = { to: string; label: string; icon: typeof Sun; hue: string; match: (p: string) => boolean; badge?: number | string };

const SW = 1.9;

export function Sidebar() {
  const { pathname } = useLocation();
  const data = useData();
  const st = settings.use();

  const planLeft = data ? todayPlan(data, st.redoDays, st.lastSubjectId).filter((p) => !p.done).length : 0;
  const due = data ? dueMistakes(data, st.redoDays).length : 0;
  const reviewDue = data && isSunday() && !isCheckinDone(data.checkins.find((c) => c.weekStart === weekStartKey()));

  const groups: { label?: string; items: Item[] }[] = [
    {
      items: [
        { to: '/', label: 'Today', icon: Sun, hue: 'var(--clay)', match: (p) => p === '/', badge: planLeft || undefined },
        { to: '/progress', label: 'Progress', icon: BarChart3, hue: 'var(--lavender)', match: (p) => p.startsWith('/progress') },
      ],
    },
    {
      label: 'Study',
      items: [
        { to: '/subjects', label: 'Courses', icon: BookOpen, hue: 'var(--mist)', match: (p) => p.startsWith('/subjects') || p.startsWith('/notes') },
        { to: '/mistakes', label: 'Mistakes', icon: CircleAlert, hue: 'var(--rose)', match: (p) => p.startsWith('/mistakes') || p.startsWith('/redo'), badge: due || undefined },
        { to: '/papers', label: 'Tests', icon: FileText, hue: 'var(--sage)', match: (p) => p.startsWith('/papers') },
      ],
    },
    {
      label: 'Routine',
      items: [
        { to: '/timer', label: 'Focus', icon: Timer, hue: 'var(--sand)', match: (p) => p.startsWith('/timer') },
        { to: '/checkin', label: 'Review', icon: CalendarCheck, hue: 'var(--sage)', match: (p) => p.startsWith('/checkin'), badge: reviewDue ? '•' : undefined },
      ],
    },
  ];

  const settingsActive = pathname.startsWith('/settings');

  return (
    <nav className="sidebar" aria-label="Main">
      <NavLink to="/" className="side-brand" aria-label="Summit OS, Today">
        <LogoMark size="1.7rem" />
        <Wordmark />
      </NavLink>

      <button type="button" className="side-new" onClick={() => openUI({ quickAdd: { preset: { subjectId: st.lastSubjectId } } })}>
        <Plus size={16} strokeWidth={2.4} />
        <span>New mistake</span>
        <kbd className="k">N</kbd>
      </button>

      <div className="side-groups">
        {groups.map((g, gi) => (
          <div key={gi} className="side-group">
            {g.label && <span className="side-label">{g.label}</span>}
            {g.items.map(({ to, label, icon: Icon, hue, match, badge }) => {
              const on = match(pathname);
              return (
                <NavLink key={to} to={to} end={to === '/'} className={on ? 'side-item on' : 'side-item'} aria-current={on ? 'page' : undefined} style={{ ['--h' as string]: hue }}>
                  <span className="si-icon">
                    <Icon size={15} strokeWidth={SW} />
                  </span>
                  <span className="si-label">{label}</span>
                  {badge != null && <span className="si-badge num">{badge}</span>}
                </NavLink>
              );
            })}
          </div>
        ))}
      </div>

      <div className="side-foot">
        <NavLink to="/settings" className={settingsActive ? 'side-item on' : 'side-item'} style={{ ['--h' as string]: 'var(--text-2)' }}>
          <span className="si-icon">
            <Settings size={15} strokeWidth={SW} />
          </span>
          <span className="si-label">Settings</span>
        </NavLink>
        <div className="side-me">
          <span className="me-avatar">{OWNER.name[0]}</span>
          <span className="me-name">{OWNER.name}</span>
          <button type="button" className="me-lock" onClick={lockNow} aria-label="Lock Summit OS" title="Lock (⇧⌘L)">
            <Lock size={14} strokeWidth={2} />
          </button>
        </div>
      </div>
    </nav>
  );
}
