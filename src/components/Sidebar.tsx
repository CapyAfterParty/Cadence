import { NavLink } from 'react-router-dom';
import { BookOpen, CalendarCheck, CircleAlert, FileText, House, Plus, Settings, Timer } from 'lucide-react';
import { openUI, settings } from '../lib/state';

const SW = 1.5;

const items = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/subjects', label: 'Subjects', icon: BookOpen },
  { to: '/mistakes', label: 'Mistakes', icon: CircleAlert },
  { to: '/papers', label: 'Papers', icon: FileText },
  { to: '/timer', label: 'Timer', icon: Timer },
  { to: '/checkin', label: 'Check-in', icon: CalendarCheck },
];

export function Sidebar() {
  return (
    <nav className="sidebar" aria-label="Main">
      <NavLink to="/" className="logo" aria-label="Cadence home">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M17 7.5a6.5 6.5 0 1 0 0 9" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      </NavLink>
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'side-btn active' : 'side-btn')} aria-label={label}>
          <Icon size={20} strokeWidth={SW} />
          <span className="tip">{label}</span>
        </NavLink>
      ))}
      <div className="spacer" />
      <button
        type="button"
        className="side-btn"
        aria-label="Add mistake (N)"
        onClick={() => openUI({ quickAdd: { preset: { subjectId: settings.get().lastSubjectId } } })}
      >
        <Plus size={20} strokeWidth={SW} />
        <span className="tip">Add mistake · N</span>
      </button>
      <NavLink to="/settings" className={({ isActive }) => (isActive ? 'side-btn active' : 'side-btn')} aria-label="Settings">
        <Settings size={20} strokeWidth={SW} />
        <span className="tip">Settings</span>
      </NavLink>
    </nav>
  );
}
