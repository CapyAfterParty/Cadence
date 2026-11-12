import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, FileText, Layers, Plus, Search, Square, Timer } from 'lucide-react';
import { useData, type AllData } from '../db/db';
import type { Subject } from '../db/types';
import { addDays, daysBetween, fmtClock, fmtDay, greeting, parseDay, todayKey, weekStartKey } from '../lib/dates';
import { activeSubjects, cardsByDay, dueMistakes, loopScore, minutesByDay, pct, subjectAverage } from '../lib/stats';
import { todayPlan, type PlanItem } from '../lib/plan';
import { courseTitle, splitCourse } from '../lib/course';
import { openUI, settings, timer } from '../lib/state';
import { OWNER } from '../owner';
import { Skeleton, cx } from '../components/ui';
import { useScans } from '../components/Scans';
import { startStudy, stopStudy } from '../features/timerActions';
import { timerSeconds, useNow } from '../features/TimerController';
import './today.css';

export default function Today() {
  const data = useData();
  const today = todayKey();
  return (
    <div className="page today2">
      <header className="t-head">
        <div>
          <span className="eyebrow">{parseDay(today).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <h1>
            {greeting()}, {OWNER.name}
          </h1>
        </div>
        <RunningPill data={data} />
      </header>
      {data ? <Body data={data} /> : <Skeleton height="26rem" />}
    </div>
  );
}

function RunningPill({ data }: { data?: AllData }) {
  const t = timer.use();
  const now = useNow(t?.kind === 'study');
  if (!t || t.kind !== 'study') return null;
  const s = data?.subjects.find((x) => x.id === t.subjectId);
  return (
    <div className="t-running">
      <span className="pulse" />
      <span className="dots">{fmtClock(timerSeconds(t, now))}</span>
      <span className="muted small">{s ? courseTitle(s.name) : ''}</span>
      <button type="button" className="round white" onClick={stopStudy} aria-label="Stop and save">
        <Square size={11} strokeWidth={2.4} fill="currentColor" />
      </button>
    </div>
  );
}

function Body({ data }: { data: AllData }) {
  const subjects = activeSubjects(data);
  if (!subjects.length)
    return (
      <Link to="/subjects" className="t-empty">
        Add your courses to begin <ArrowRight size={16} />
      </Link>
    );
  return (
    <>
      <div className="hero-row">
        <WeekCard data={data} />
        <NextCard data={data} />
        <MistakesCard data={data} />
        <ComingCard data={data} />
      </div>
      <ChipRow data={data} />
      <Timeline data={data} />
    </>
  );
}

/* ---------- Shared bits ---------- */

function ArrowBtn({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="round white" aria-label={label}>
      <ArrowUpRight size={16} strokeWidth={2.2} />
    </Link>
  );
}

const weekDays = () => {
  const ws = weekStartKey();
  return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
};

/* ---------- 1. This week (magenta) ---------- */

function WeekCard({ data }: { data: AllData }) {
  const st = settings.use();
  const days = weekDays();
  const today = todayKey();
  const cards = cardsByDay(data);
  const mins = minutesByDay(data);
  const attempts = new Set(data.attempts.map((a) => a.date));
  const tests = new Set(data.papers.map((p) => p.date));
  const rows: { label: string; on: (d: string) => boolean }[] = [
    { label: 'Cards', on: (d) => (cards.get(d) ?? 0) > 0 },
    { label: 'Study', on: (d) => (mins.get(d) ?? 0) > 0 },
    { label: 'Redo', on: (d) => attempts.has(d) },
    { label: 'Tests', on: (d) => tests.has(d) },
  ];
  const week = days.reduce((a, d) => a + (mins.get(d) ?? 0), 0);
  const sessions = data.sessions.filter((s) => days.includes(s.date)).length;
  const loop = loopScore(data, weekStartKey(), st.redoDays).score;
  return (
    <article className="hero magenta" style={{ ['--i' as string]: 0 }}>
      <div className="h-top">
        <h2>This week</h2>
        <ArrowBtn to="/progress" label="Open progress" />
      </div>
      <div className="h-meta">
        <div className="h-count">
          <span className="dots big">{sessions}</span>
          <span className="small">sessions</span>
        </div>
        <ul className="legend-dots">
          <li>
            <i className="on" /> Done
          </li>
          <li>
            <i /> Missed
          </li>
        </ul>
      </div>
      <div className="dot-grid" role="img" aria-label="This week's habits by day">
        {rows.map((r, ri) => (
          <div key={r.label} className="dg-row">
            {days.map((d, di) => {
              const future = d > today;
              return <span key={d} className={cx('dg', r.on(d) && 'on', future && 'future', d === today && 'is-today')} style={{ animationDelay: `${300 + (ri * 7 + di) * 18}ms` }} title={`${r.label} · ${fmtDay(d, { weekday: 'short' })}`} />;
            })}
          </div>
        ))}
        <div className="dg-days">
          {days.map((d) => (
            <span key={d} className={d === today ? 'on' : undefined}>
              {parseDay(d).toLocaleDateString(undefined, { weekday: 'narrow' })}
            </span>
          ))}
        </div>
      </div>
      <div className="h-bottom">
        <span className="dots huge">
          {Math.floor(week / 60)}
          <small>h</small>
          {String(Math.round(week % 60)).padStart(2, '0')}
          <small>m</small>
        </span>
        <span className="h-sub">studied · loop {loop}%</span>
      </div>
    </article>
  );
}

/* ---------- 2. Next up (reeded glass) ---------- */

function useHeroPhoto() {
  const photos = useScans('hero', 'hero');
  const photo = photos?.[0];
  const url = useMemo(() => (photo ? URL.createObjectURL(photo.blob) : null), [photo]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  return url;
}

function NextCard({ data }: { data: AllData }) {
  const st = settings.use();
  const nav = useNavigate();
  const photo = useHeroPhoto();
  const today = todayKey();
  const next = activeSubjects(data)
    .filter((s) => s.nextTestDate && s.nextTestDate >= today)
    .sort((a, b) => (a.nextTestDate! < b.nextTestDate! ? -1 : 1))[0];
  const plan = todayPlan(data, st.redoDays, st.lastSubjectId).filter((p) => !p.done).slice(0, 3);
  const run = (p: PlanItem) => {
    const a = p.action;
    if (a.kind === 'nav') nav(a.to);
    else if (a.kind === 'flash') openUI({ flashLog: true });
    else if (a.kind === 'study') startStudy(a.subjectId);
    else openUI({ logPaper: { preset: { subjectId: a.subjectId } } });
  };
  const { code, title } = next ? splitCourse(next.name) : { code: null, title: '' };
  return (
    <article className="hero reed" style={{ ['--i' as string]: 1 }}>
      <div className="reed-scene" aria-hidden="true">
        {photo ? (
          <img src={photo} alt="" />
        ) : (
          <svg viewBox="0 0 300 420" preserveAspectRatio="xMidYMid slice">
            <defs>
              <linearGradient id="rsky" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#f4f4f8" />
                <stop offset="0.55" stopColor="#c9c9d3" />
                <stop offset="1" stopColor="#6e6e7a" />
              </linearGradient>
              <radialGradient id="rsun" cx="0.62" cy="0.3" r="0.35">
                <stop offset="0" stopColor="#ffd2e6" />
                <stop offset="0.5" stopColor="#c9b8ff" stopOpacity="0.6" />
                <stop offset="1" stopColor="#c9b8ff" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="300" height="420" fill="url(#rsky)" />
            <rect width="300" height="420" fill="url(#rsun)" />
            <path d="M-10 300 L70 190 L105 225 L160 120 L215 210 L245 180 L310 260 V420 H-10Z" fill="#2c2c34" />
            <path d="M160 120 L178 150 L168 146 L160 160 L150 145 L142 150Z" fill="#f4f4f8" opacity="0.9" />
            <path d="M-10 340 L60 270 L120 310 L190 250 L310 320 V420 H-10Z" fill="#16161b" />
          </svg>
        )}
        <div className="reeds" />
      </div>

      <div className="glass-panel next-test">
        {next ? (
          <>
            <span className="mini-card" style={{ ['--c' as string]: next.colour }}>
              <em>{code ?? title.slice(0, 3).toUpperCase()}</em>
            </span>
            <span className="np-main">
              <strong>{title}</strong>
              <span>
                Test · {fmtDay(next.nextTestDate!, { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
            </span>
            <button type="button" className="round white" onClick={() => nav(`/redo?subject=${next.id}`)} aria-label={`Redo ${title} mistakes`}>
              <ArrowRight size={16} strokeWidth={2.2} />
            </button>
          </>
        ) : (
          <span className="np-main">
            <strong>No test dates</strong>
            <span>Set one on a course</span>
          </span>
        )}
      </div>

      <div className="glass-panel plan-panel">
        <div className="pp-head">
          <h3>Next up</h3>
          <button type="button" className="round dark" onClick={() => openUI({ quickAdd: { preset: { subjectId: st.lastSubjectId } } })} aria-label="New mistake">
            <Plus size={16} strokeWidth={2.2} />
          </button>
        </div>
        {plan.length === 0 && <p className="pp-clear">All done for today.</p>}
        {plan.map((p) => (
          <button key={p.id} type="button" className="pp-row" onClick={() => run(p)}>
            <span className="pp-dot" style={{ background: `var(--${p.hue})` }} />
            <span className="pp-title">{p.title}</span>
            <span className="pp-detail">{p.detail}</span>
          </button>
        ))}
      </div>
    </article>
  );
}

/* ---------- 3. Mistakes (smoke, orbit) ---------- */

function MistakesCard({ data }: { data: AllData }) {
  const st = settings.use();
  const nav = useNavigate();
  const due = dueMistakes(data, st.redoDays);
  const open = data.mistakes.filter((m) => !m.cleared).length;
  const by = activeSubjects(data)
    .map((s) => ({ s, n: due.filter((m) => m.subjectId === s.id).length }))
    .sort((a, b) => b.n - a.n);
  const centre = by[0];
  const ring = by.slice(1, 5);
  const ws = weekStartKey();
  const logged = data.mistakes.filter((m) => m.date >= ws).length;
  const pos = ['top', 'right', 'bottom', 'left'];
  return (
    <article className="hero smoke" style={{ ['--i' as string]: 2 }}>
      <div className="h-top">
        <h2>Mistakes</h2>
        <span className="glass-tab">
          Due now
          <i />
        </span>
      </div>
      <div className="h-count">
        <span className="dots big">{open}</span>
        <span className="small">open</span>
      </div>
      <div className="orbit">
        <span className="orbit-ring r1" />
        <span className="orbit-ring r2" />
        {centre && (
          <button type="button" className="orb-centre" onClick={() => nav(`/redo?subject=${centre.s.id}`)} title={`${courseTitle(centre.s.name)}: ${centre.n} due`}>
            <span style={{ color: centre.s.colour }}>{(splitCourse(centre.s.name).code ?? courseTitle(centre.s.name)).slice(0, 3)}</span>
            <em className="num">{centre.n}</em>
          </button>
        )}
        {ring.map(({ s, n }, i) => (
          <button key={s.id} type="button" className={`orb-sat ${pos[i]}`} onClick={() => nav(`/redo?subject=${s.id}`)} title={`${courseTitle(s.name)}: ${n} due`}>
            <span style={{ background: s.colour }} />
            <em className="num">{n}</em>
          </button>
        ))}
      </div>
      <div className="glass-panel due-pop">
        <span className="dp-value">
          {due.length}
          <small>due</small>
        </span>
        <span className="dp-delta">+{logged} logged this week</span>
      </div>
      <div className="h-foot">
        <span className="pager">
          {by.slice(0, 4).map(({ s }, i) => (
            <i key={s.id} className={i === 0 ? 'on' : undefined} />
          ))}
        </span>
        <button type="button" className="pill-dark" disabled={!due.length} onClick={() => nav(`/redo?subject=${centre?.s.id ?? ''}`)}>
          Start redo
        </button>
      </div>
    </article>
  );
}

/* ---------- 4. Coming up (blue, rings) ---------- */

function ComingCard({ data }: { data: AllData }) {
  const today = todayKey();
  const tests = activeSubjects(data)
    .filter((s) => s.nextTestDate && s.nextTestDate >= today)
    .sort((a, b) => (a.nextTestDate! < b.nextTestDate! ? -1 : 1));
  const [first, second] = tests;
  const avg = first ? subjectAverage(data, first.id) : null;
  return (
    <article className="hero blue" style={{ ['--i' as string]: 3 }}>
      <div className="h-top">
        <h2>Coming up</h2>
        <ArrowBtn to={first ? `/subjects/${first.id}` : '/subjects'} label="Open course" />
      </div>
      {first ? (
        <>
          <div className="cu-row">
            <div>
              <span className="dots big">{avg == null ? '--' : `${Math.round(avg)}%`}</span>
              <span className="cu-label">{courseTitle(first.name)} · target {first.targetPct}%</span>
            </div>
            <div className="cu-date">
              <span className="dots big">{parseDay(first.nextTestDate!).getDate().toString().padStart(2, '0')}</span>
              <span className="cu-label">{parseDay(first.nextTestDate!).toLocaleDateString(undefined, { month: 'short' })}</span>
            </div>
          </div>
          <div className="rings">
            <span className="ring dashed" />
            <span className="ring solid" />
            <span className="ring-days">
              <span className="dots">{daysBetween(today, first.nextTestDate!)}</span>
              <small>days</small>
            </span>
            {second && <span className="ring-sat" style={{ background: second.colour }} title={courseTitle(second.name)} />}
          </div>
          <div className="cu-row bottom">
            <div>
              <span className="cu-label">{second ? courseTitle(second.name) : 'Nothing after that yet'}</span>
              <span className="dots mid">{second ? `${daysBetween(today, second.nextTestDate!)}d` : ''}</span>
            </div>
            {second && (
              <div className="cu-date">
                <span className="cu-label">{parseDay(second.nextTestDate!).toLocaleDateString(undefined, { month: 'short' })}</span>
                <span className="dots mid">{parseDay(second.nextTestDate!).getDate().toString().padStart(2, '0')}</span>
              </div>
            )}
          </div>
        </>
      ) : (
        <p className="cu-empty">No tests set. Add a date on a course.</p>
      )}
    </article>
  );
}

/* ---------- Chip row ---------- */

function ChipRow({ data }: { data: AllData }) {
  const nav = useNavigate();
  const st = settings.use();
  return (
    <div className="chip-bar">
      <div className="bar-group">
        <span className="bg-label">Courses</span>
        {activeSubjects(data).map((s) => (
          <Link key={s.id} to={`/subjects/${s.id}`} className="bg-dot" style={{ background: s.colour }} title={courseTitle(s.name)}>
            <span className="sr-only">{courseTitle(s.name)}</span>
          </Link>
        ))}
        <Link to="/subjects" className="bg-more" aria-label="All courses">
          <ChevronRight size={15} />
        </Link>
      </div>
      <div className="bar-group">
        <span className="bg-label">Log</span>
        <button type="button" className="bg-icon" onClick={() => openUI({ flashLog: true })} aria-label="Log flashcards" title="Flashcards">
          <Layers size={15} strokeWidth={2} />
        </button>
        <button type="button" className="bg-icon" onClick={() => openUI({ logPaper: { preset: { subjectId: st.lastSubjectId } } })} aria-label="Log a test" title="Test result">
          <FileText size={15} strokeWidth={2} />
        </button>
        <button type="button" className="bg-icon" onClick={() => nav('/timer')} aria-label="Focus timer" title="Focus">
          <Timer size={15} strokeWidth={2} />
        </button>
      </div>
      <span className="bar-spacer" />
      <button type="button" className="bar-search" onClick={() => openUI({ palette: true })}>
        Search <kbd className="k">⌘K</kbd>
        <Search size={15} strokeWidth={2} />
      </button>
    </div>
  );
}

/* ---------- Timeline: this week, by course ---------- */

function Timeline({ data }: { data: AllData }) {
  const [offset, setOffset] = useState(0);
  const today = todayKey();
  const ws = addDays(weekStartKey(), offset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const subjects = activeSubjects(data);
  const todayIdx = days.indexOf(today);
  return (
    <section className="timeline-panel">
      <div className="tl-head">
        <div className="tl-switch">
          <button type="button" onClick={() => setOffset((o) => o - 1)} aria-label="Previous week">
            <ChevronLeft size={15} />
          </button>
          <span>{offset === 0 ? 'This week' : `${fmtDay(ws)} – ${fmtDay(addDays(ws, 6))}`}</span>
          <button type="button" onClick={() => setOffset((o) => o + 1)} aria-label="Next week">
            <ChevronRight size={15} />
          </button>
        </div>
        <div className="tl-days" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
          {days.map((d) => (
            <span key={d} className={d === today ? 'on' : undefined}>
              {parseDay(d).toLocaleDateString(undefined, { weekday: 'short' })} {parseDay(d).getDate()}
            </span>
          ))}
        </div>
      </div>
      <div className="tl-body">
        {todayIdx >= 0 && <span className="tl-now" style={{ ['--x' as string]: (todayIdx + 0.5) / 7 }} />}
        {subjects.map((s, i) => (
          <TimelineRow key={s.id} data={data} subject={s} days={days} index={i} />
        ))}
      </div>
    </section>
  );
}

function TimelineRow({ data, subject, days, index }: { data: AllData; subject: Subject; days: string[]; index: number }) {
  const open = data.mistakes.filter((m) => m.subjectId === subject.id && !m.cleared).length;
  const avg = subjectAverage(data, subject.id);
  const { code, title } = splitCourse(subject.name);
  return (
    <div className="tl-row" style={{ ['--i' as string]: index }}>
      <Link to={`/subjects/${subject.id}`} className="tl-course">
        <span className="tl-swatch" style={{ background: subject.colour }} />
        <span className="tl-name">
          {title}
          {code && <em>{code}</em>}
        </span>
        <span className="round white sm num" title="Open mistakes">
          {open}
        </span>
        <span className="tl-avg num">{avg == null ? '–' : `${Math.round(avg)}%`}</span>
      </Link>
      <div className="tl-cells" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
        {days.map((d) => {
          const mins = data.sessions.filter((x) => x.subjectId === subject.id && x.date === d).reduce((a, x) => a + x.minutes, 0);
          const papers = data.papers.filter((p) => p.subjectId === subject.id && p.date === d);
          const test = subject.nextTestDate === d;
          return (
            <div key={d} className="tl-cell">
              {test && <span className="tl-chip test">Test</span>}
              {papers.map((p) => (
                <span key={p.id} className="tl-chip paper">
                  {p.kind === 'past_paper' ? 'Practice' : 'Unit test'} {Math.round(pct(p))}%
                </span>
              ))}
              {mins > 0 && (
                <span className="tl-chip study" style={{ ['--c' as string]: subject.colour }}>
                  {mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}` : `${mins}m`}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

