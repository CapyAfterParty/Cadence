import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, type NavigateFunction } from 'react-router-dom';
import {
  BookOpen,
  CalendarCheck,
  CircleAlert,
  Download,
  FileText,
  Layers,
  ListPlus,
  NotebookPen,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Timer,
  House,
  Zap,
  Lock,
  CornerDownLeft,
} from 'lucide-react';
import { useData, type AllData } from '../db/db';
import { errorLabel } from '../db/types';
import { openUI, settings, ui } from '../lib/state';
import { exportBackup } from '../lib/backup';
import { fmtDay } from '../lib/dates';
import { activeSubjects } from '../lib/stats';
import { startStudy } from './timerActions';
import { lockNow } from '../lib/security';
import { Modal, cx } from '../components/ui';

interface Item {
  key: string;
  group: string;
  label: string;
  hint?: string;
  icon: ReactNode;
  run: () => void;
}

const I = (C: typeof Search) => <C size={16} strokeWidth={1.5} />;

function commands(nav: NavigateFunction): Item[] {
  const last = () => settings.get().lastSubjectId;
  const a = (key: string, label: string, icon: ReactNode, run: () => void, hint?: string): Item => ({ key, group: 'Actions', label, icon, run, hint });
  const s = (path: string, label: string, icon: ReactNode): Item => ({ key: 'go' + path, group: 'Go to', label, icon, run: () => nav(path) });
  return [
    a('add-mistake', 'Add mistake', I(Plus), () => openUI({ quickAdd: { preset: { subjectId: last() } } }), 'N'),
    a('bulk', 'Bulk add mistakes', I(ListPlus), () => openUI({ bulk: { subjectId: last() } })),
    a('start-timer', 'Start timer', I(Play), () => (last() ? startStudy(last()!) : nav('/timer'))),
    a('sprint', 'Start timed sprint', I(Zap), () => nav('/timer?sprint=1')),
    a('log-paper', 'Log paper', I(FileText), () => openUI({ logPaper: { preset: { subjectId: last() } } })),
    a('log-flash', 'Log flashcards', I(Layers), () => openUI({ flashLog: true })),
    a('redo', 'Start redo', I(RotateCcw), () => nav(last() ? `/redo?subject=${last()}` : '/redo')),
    a('export', 'Export backup', I(Download), () => exportBackup()),
    a('lock', 'Lock Cadence', I(Lock), () => lockNow(), '⇧⌘L'),
    s('/', 'Home', I(House)),
    s('/subjects', 'Subjects', I(BookOpen)),
    s('/mistakes', 'Mistakes', I(CircleAlert)),
    s('/papers', 'Papers', I(FileText)),
    s('/timer', 'Timer', I(Timer)),
    s('/checkin', 'Weekly check-in', I(CalendarCheck)),
    s('/settings', 'Settings', I(Settings)),
  ];
}

const matches = (hay: string, terms: string[]) => {
  const h = hay.toLowerCase();
  return terms.every((t) => h.includes(t));
};

function search(data: AllData, q: string, nav: NavigateFunction): Item[] {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const cmds = commands(nav);
  const subjectName = new Map(data.subjects.map((s) => [s.id, s.name]));
  const topicName = new Map(data.topics.map((t) => [t.id, t.name]));
  const subjects: Item[] = activeSubjects(data).map((s) => ({
    key: 's' + s.id,
    group: 'Subjects',
    label: s.name,
    icon: <span className="subject-dot" style={{ background: s.colour }} />,
    run: () => nav(`/subjects/${s.id}`),
  }));
  if (!terms.length) return [...cmds.filter((c) => c.group === 'Actions').slice(0, 6), ...subjects, ...cmds.filter((c) => c.group === 'Go to')];

  const cap = (items: Item[], n = 6) => items.slice(0, n);
  const notes = data.notes
    .filter((n) => matches(`${n.title} ${n.body} ${subjectName.get(n.subjectId)}`, terms))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map<Item>((n) => ({
      key: 'n' + n.id,
      group: 'Notes',
      label: n.title || 'Untitled note',
      hint: subjectName.get(n.subjectId),
      icon: I(NotebookPen),
      run: () => nav(`/notes/${n.id}`),
    }));
  const mistakes = data.mistakes
    .filter((m) =>
      matches(`${m.source} ${m.fix} ${topicName.get(m.topicId ?? '') ?? ''} ${subjectName.get(m.subjectId)} ${errorLabel(m.errorType)} ${m.cardRef ?? ''}`, terms),
    )
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map<Item>((m) => ({
      key: 'm' + m.id,
      group: 'Mistakes',
      label: [m.source, topicName.get(m.topicId ?? '')].filter(Boolean).join(' · ') || 'Mistake',
      hint: `${subjectName.get(m.subjectId) ?? ''}${m.cleared ? ' · cleared' : ''}`,
      icon: I(CircleAlert),
      run: () => nav(`/mistakes?subject=${m.subjectId}&open=${m.id}`),
    }));
  const papers = data.papers
    .filter((p) => matches(`${p.name} ${p.year ?? ''} ${subjectName.get(p.subjectId)} ${p.date}`, terms))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map<Item>((p) => ({
      key: 'p' + p.id,
      group: 'Papers',
      label: [p.name, p.year].filter(Boolean).join(' '),
      hint: `${subjectName.get(p.subjectId) ?? ''} · ${Math.round((p.score / (p.maxScore || 1)) * 100)}%`,
      icon: I(FileText),
      run: () => nav(`/papers?subject=${p.subjectId}&open=${p.id}`),
    }));
  const checkins = data.checkins
    .filter((c) => matches(`${c.didThisWeek} ${c.distractions} ${c.changes} ${c.goals.join(' ')}`, terms))
    .map<Item>((c) => ({
      key: 'c' + c.id,
      group: 'Check-ins',
      label: `Week of ${fmtDay(c.weekStart)}`,
      hint: c.didThisWeek.slice(0, 40),
      icon: I(CalendarCheck),
      run: () => nav(`/checkin?week=${c.weekStart}`),
    }));
  return [
    ...cap(cmds.filter((c) => matches(c.label, terms)), 4),
    ...cap(subjects.filter((s) => matches(s.label, terms)), 4),
    ...cap(notes),
    ...cap(mistakes),
    ...cap(papers),
    ...cap(checkins, 4),
  ];
}

/** The one search box: global search, command palette and quick add. */
export function SearchBox({ variant, onDone }: { variant: 'modal' | 'hero'; onDone?: () => void }) {
  const data = useData();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const [focused, setFocused] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const items = useMemo(() => (data ? search(data, q, nav) : []), [data, q, nav]);

  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector('.result.sel')?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  const run = (it?: Item) => {
    if (!it) return;
    setQ('');
    onDone?.();
    (document.activeElement as HTMLElement | null)?.blur?.();
    it.run();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((s) => Math.min(items.length - 1, s + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((s) => Math.max(0, s - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(items[sel]);
    } else if (e.key === 'Escape' && variant === 'hero') {
      setQ('');
      (e.target as HTMLElement).blur();
    }
  };

  const showResults = variant === 'modal' || (focused && q.length > 0);
  let lastGroup = '';

  const results = (
    <div className="results" ref={listRef} role="listbox">
      {items.length === 0 && <div className="none">Nothing found for “{q}”.</div>}
      {items.map((it, i) => {
        const head = it.group !== lastGroup ? <div className="group">{it.group}</div> : null;
        lastGroup = it.group;
        return (
          <div key={it.key}>
            {head}
            <button
              type="button"
              role="option"
              aria-selected={i === sel}
              className={cx('result', i === sel && 'sel')}
              onMouseMove={() => setSel(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => run(it)}
            >
              <span className="r-icon">{it.icon}</span>
              <span className="r-main">{it.label}</span>
              {it.hint && <span className="r-hint">{it.hint}</span>}
              <CornerDownLeft size={14} strokeWidth={1.8} className="r-go" />
            </button>
          </div>
        );
      })}
    </div>
  );

  if (variant === 'modal')
    return (
      <>
        <div className="palette-input">
          <Search size={18} strokeWidth={1.5} className="muted" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="Search or run a command…" aria-label="Search or run a command" />
          <span className="kbd">
            <kbd>esc</kbd>
          </span>
        </div>
        {results}
      </>
    );

  return (
    <div className="hero-search">
      <div className="cmd">
        <Search size={18} strokeWidth={1.7} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Search, jump to, or add anything"
          aria-label="Search, jump to, or add anything"
        />
        <span className="kbd">
          <kbd>⌘</kbd>
          <kbd>K</kbd>
        </span>
      </div>
      {showResults && <div className="hero-results">{results}</div>}
    </div>
  );
}

export function Palette() {
  const close = () => ui.set((s) => ({ ...s, palette: false }));
  return (
    <Modal onClose={close} className="palette">
      <SearchBox variant="modal" onDone={close} />
    </Modal>
  );
}

export function SearchTrigger() {
  return (
    <button type="button" className="search-trigger" onClick={() => openUI({ palette: true })} aria-label="Search (Ctrl K)">
      <Search size={16} strokeWidth={1.5} />
      <span className="label">Search or jump to…</span>
      <span className="kbd">
        <kbd>⌘</kbd>
        <kbd>K</kbd>
      </span>
    </button>
  );
}
