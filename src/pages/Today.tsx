import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Layers,
  ListPlus,
  Play,
  Plus,
  RotateCcw,
  Search,
  Square,
  Timer,
  X,
  Zap,
} from 'lucide-react';
import { useData, type AllData } from '../db/db';
import type { Subject } from '../db/types';
import { addDays, daysBetween, fmtClock, fmtDay, fmtHours, parseDay, todayKey, weekStartKey } from '../lib/dates';
import { activeSubjects, cardsByDay, dueMistakes, minutesByDay, pct, subjectAverage } from '../lib/stats';
import { todayPlan, type PlanItem } from '../lib/plan';
import { courseTitle, splitCourse } from '../lib/course';
import { openUI, settings, timer } from '../lib/state';
import { cx, Skeleton } from '../components/ui';
import { useSize } from '../components/charts/fancy';
import { SUMMIT_ART, useHomePhoto } from '../components/Backdrop';
import { CornerLink, Glass } from '../components/glass';
import { startStudy, stopStudy } from '../features/timerActions';
import { timerSeconds, useNow } from '../features/TimerController';
import './today.css';

const ICONS: Record<PlanItem['icon'], typeof Check> = {
  test: CalendarClock,
  cards: Layers,
  redo: RotateCcw,
  study: Play,
  timed: Zap,
  review: CalendarCheck,
};

const vars = (o: Record<string, string | number>) => o as CSSProperties;

/** Short code for a course bubble: SPH4U → SPH, otherwise the first letters. */
const badge = (s: Subject) => {
  const { code, title } = splitCourse(s.name);
  return code ? code.slice(0, 3) : title.slice(0, 2).toUpperCase();
};

export default function Today() {
  const data = useData();
  if (!data) return <Skeleton height="40rem" />;
  if (!activeSubjects(data).length)
    return (
      <Link to="/subjects" className="t-empty">
        Add your courses to begin <ChevronRight size={16} />
      </Link>
    );
  return <Home data={data} />;
}

function Home({ data }: { data: AllData }) {
  const [week, setWeek] = useState(0);
  return (
    <div className="home">
      <div className="h-cards">
        <StudyCard data={data} />
        <PlanCard data={data} />
        <MistakesCard data={data} />
        <TestsCard data={data} />
      </div>
      <Strip data={data} />
      <Timeline data={data} offset={week} setOffset={setWeek} />
    </div>
  );
}

function HomeCard({ className, index, children }: { className: string; index: number; children: ReactNode }) {
  const tone = className.includes('gel-pink') ? 'pink' : className.includes('gel-blue') ? 'blue' : className.includes('smoke') ? 'smoke' : 'plain';
  const extra = className.replace(/gel-pink|gel-blue|gel|smoke/g, '').trim();
  return (
    <Glass tone={tone} index={index} className={extra || undefined}>
      {children}
    </Glass>
  );
}

/* ---------- 1. Study time: four weeks as a dot matrix ---------- */

function StudyCard({ data }: { data: AllData }) {
  const [page, setPage] = useState(0);
  const today = todayKey();
  const mins = minutesByDay(data);
  const start = addDays(weekStartKey(), -21 - page * 28);
  const days = Array.from({ length: 28 }, (_, i) => addDays(start, i));
  const inWindow = days.filter((d) => d <= today);
  const total = inWindow.reduce((a, d) => a + (mins.get(d) ?? 0), 0);
  const sessions = data.sessions.filter((s) => s.date >= days[0] && s.date <= days[27]).length;
  const studied = inWindow.filter((d) => (mins.get(d) ?? 0) > 0).length;
  const h = Math.floor(total / 60);
  const m = Math.round(total % 60);
  return (
    <HomeCard className="gel gel-pink" index={0}>
      <div className="hc-head">
        <span className="hc-title">Study time</span>
        <CornerLink to="/progress" label="Open Progress" />
      </div>
      <div className="hc-figure">
        <span className="thin-num">{sessions}</span>
        <span className="hc-unit">sessions</span>
        <span className="hc-legend">
          <span>
            <i className="lg-dot" /> Studied
          </span>
          <span>
            <i className="lg-ring" /> Rest
          </span>
        </span>
      </div>
      <div className="matrix" key={page} role="img" aria-label={`${studied} of ${inWindow.length} days studied`}>
        {days.map((d, i) => {
          const v = mins.get(d) ?? 0;
          const future = d > today;
          return (
            <span
              key={d}
              className={cx('mx', v > 0 && 'on', v >= 90 && 'hot', d === today && 'now', future && 'future')}
              style={{ ['--d' as string]: i }}
              title={`${fmtDay(d, { weekday: 'short', day: 'numeric', month: 'short' })} · ${v ? fmtHours(v) : 'rest'}`}
            />
          );
        })}
      </div>
      <div className="pager">
        <button type="button" onClick={() => setPage((p) => p + 1)} aria-label="Earlier four weeks">
          <ArrowLeft size={14} strokeWidth={1.8} />
        </button>
        <span className="pager-bar" title={page === 0 ? 'Last four weeks' : `${fmtDay(days[0])} – ${fmtDay(days[27])}`} />
        <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} aria-label="Later four weeks">
          <ArrowRight size={14} strokeWidth={1.8} />
        </button>
      </div>
      <div className="dot-num big">
        {h}
        <small>h</small>
        {String(m).padStart(2, '0')}
        <small>m</small>
      </div>
    </HomeCard>
  );
}

/* ---------- 2. The plan, under reeded glass ---------- */

function Fluted({ src, strips = 20 }: { src: string; strips?: number }) {
  const [ref, w, h] = useSize<HTMLDivElement>();
  const [shift, setShift] = useState(0);
  const sw = w / strips;
  return (
    <div
      ref={ref}
      className="fluted"
      style={vars({ '--sw': `${sw}px` })}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setShift(((e.clientX - r.left) / r.width - 0.5) * sw * 1.6);
      }}
      onPointerLeave={() => setShift(0)}
      aria-hidden="true"
    >
      {w > 0 &&
        Array.from({ length: strips }, (_, i) => (
          <div key={i} className="flute" style={{ left: i * sw, width: Math.ceil(sw) + 1 }}>
            <img
              src={src}
              alt=""
              draggable={false}
              style={{
                width: w,
                height: h,
                left: -i * sw,
                transformOrigin: `${i * sw + sw / 2}px 50%`,
                transform: `translateX(${shift * (0.6 + (i % 3) * 0.2)}px) scaleX(2.1) scaleY(1.04)`,
              }}
            />
          </div>
        ))}
    </div>
  );
}

function PlanCard({ data }: { data: AllData }) {
  const nav = useNavigate();
  const st = settings.use();
  const photo = useHomePhoto();
  const plan = todayPlan(data, st.redoDays, st.lastSubjectId);
  const open = plan.filter((p) => !p.done);
  const next = open[0];
  const rest = plan.filter((p) => p !== next);
  const run = (p: PlanItem) => {
    const a = p.action;
    if (a.kind === 'nav') nav(a.to);
    else if (a.kind === 'flash') openUI({ flashLog: true });
    else if (a.kind === 'study') startStudy(a.subjectId);
    else openUI({ logPaper: { preset: { subjectId: a.subjectId } } });
  };
  const NextIcon = next ? ICONS[next.icon] : Check;
  return (
    <HomeCard className="photo-card" index={1}>
      <div className="pc-photo">
        <Fluted src={photo ?? SUMMIT_ART} />
      </div>
      <div className="pc-next">
        <span className="pc-thumb">
          <NextIcon size={15} strokeWidth={2} />
        </span>
        <span className="pc-next-main">
          <span className="pc-next-title">{next ? next.title : 'All done today'}</span>
          <span className="pc-next-sub">{next ? `Next up · ${next.detail}` : `${plan.length} of ${plan.length} finished`}</span>
        </span>
        {next && (
          <button type="button" className="pc-go" onClick={() => run(next)} aria-label={`Start: ${next.title}`}>
            <Play size={14} strokeWidth={2.2} fill="currentColor" />
          </button>
        )}
      </div>
      <div className="pc-list">
        <div className="pc-list-head">
          <span>Today’s plan</span>
          <span className="pc-left num">{open.length ? `${open.length} left` : 'Done'}</span>
          <button type="button" className="pc-add" onClick={() => openUI({ quickAdd: { preset: { subjectId: st.lastSubjectId } } })} aria-label="New mistake">
            <Plus size={15} strokeWidth={2} />
          </button>
        </div>
        <div className="pc-rows">
          {rest.map((p) => {
            const Icon = ICONS[p.icon];
            return (
              <button key={p.id} type="button" className={cx('pc-row', p.done && 'done', p.urgent && 'urgent')} onClick={() => run(p)}>
                <span className="pc-ico">{p.done ? <Check size={13} strokeWidth={2.4} /> : <Icon size={13} strokeWidth={2} />}</span>
                <span className="pc-row-title">{p.title}</span>
                <span className="pc-row-detail">{p.detail}</span>
                <span className="pc-row-state">{p.done ? 'Done' : <ChevronRight size={14} />}</span>
              </button>
            );
          })}
        </div>
      </div>
    </HomeCard>
  );
}

/* ---------- 3. Mistakes: courses in orbit ---------- */

function MistakesCard({ data }: { data: AllData }) {
  const st = settings.use();
  const [mode, setMode] = useState<'due' | 'open'>('due');
  const [picked, setPicked] = useState<string | null>(null);
  const subjects = activeSubjects(data);
  const due = dueMistakes(data, st.redoDays);
  const openAll = data.mistakes.filter((m) => !m.cleared);
  const list = mode === 'due' ? due : openAll;
  const count = (id: string) => list.filter((m) => m.subjectId === id).length;
  const ranked = [...subjects].sort((a, b) => count(b.id) - count(a.id));
  const focus = subjects.find((s) => s.id === picked) ?? ranked[0];
  const fc = focus ? count(focus.id) : 0;
  const weekStart = weekStartKey();
  const newThisWeek = data.mistakes.filter((m) => m.date >= weekStart && (!focus || m.subjectId === focus.id)).length;
  const R = 37; // orbit radius, % of the box
  return (
    <HomeCard className="smoke" index={2}>
      <div className="hc-head">
        <span className="hc-title">Mistakes</span>
        <button type="button" className="mode-pill" onClick={() => setMode((m) => (m === 'due' ? 'open' : 'due'))} aria-label="Switch between due and open">
          {mode === 'due' ? 'Due now' : 'All open'}
          <i />
        </button>
      </div>
      <div className="hc-figure">
        <span className="thin-num">{list.length}</span>
        <span className="hc-unit">{mode === 'due' ? 'to redo' : 'open'}</span>
      </div>
      <div className="orbit">
        <span className="orbit-ring" />
        <span className="orbit-ring inner" />
        <div className="orbit-spin">
          {subjects.map((s, i) => {
            const a = (-90 + (360 / subjects.length) * i) * (Math.PI / 180);
            return (
              <button
                key={s.id}
                type="button"
                className={cx('orb', focus?.id === s.id && 'on')}
                style={vars({ left: `${50 + R * Math.cos(a)}%`, top: `${50 + R * Math.sin(a)}%`, '--c': s.colour })}
                onClick={() => setPicked(s.id)}
                aria-label={`${courseTitle(s.name)}: ${count(s.id)}`}
              >
                <span className="orb-face">{badge(s)}</span>
                {count(s.id) > 0 && <span className="orb-count num">{count(s.id)}</span>}
              </button>
            );
          })}
          {[30, 140, 215, 300].map((deg) => (
            <i key={deg} className="orbit-dot" style={vars({ left: `${50 + 24 * Math.cos((deg * Math.PI) / 180)}%`, top: `${50 + 24 * Math.sin((deg * Math.PI) / 180)}%` })} />
          ))}
        </div>
        <Link to={focus ? `/redo?subject=${focus.id}` : '/redo'} className="orbit-core" aria-label="Start a redo">
          <RotateCcw size={18} strokeWidth={2} />
        </Link>
        {focus && (
          <div className="orbit-pop">
            <div className="op-top">
              <span className="op-num">{fc}</span>
              <span className="op-delta num">+{newThisWeek} this week</span>
              {picked && (
                <button type="button" onClick={() => setPicked(null)} aria-label="Back to the busiest course">
                  <X size={11} strokeWidth={2.2} />
                </button>
              )}
            </div>
            <span className="op-sub">{courseTitle(focus.name)}</span>
          </div>
        )}
      </div>
      <div className="hc-foot">
        <span className="foot-dots">
          {ranked.map((s) => (
            <i key={s.id} className={focus?.id === s.id ? 'on' : undefined} style={vars({ '--c': s.colour })} />
          ))}
        </span>
        <Link to={focus ? `/redo?subject=${focus.id}` : '/redo'} className="dark-pill">
          Start redo
        </Link>
      </div>
    </HomeCard>
  );
}

/* ---------- 4. Tests: what is coming, in rings ---------- */

function TestsCard({ data }: { data: AllData }) {
  const today = todayKey();
  const upcoming = activeSubjects(data)
    .filter((s) => s.nextTestDate && s.nextTestDate >= today)
    .sort((a, b) => (a.nextTestDate! < b.nextTestDate! ? -1 : 1));
  const [first, second] = upcoming;
  const avg = (s?: Subject) => (s ? subjectAverage(data, s.id) : null);
  const fmtAvg = (v: number | null) => (v == null ? '–' : `${Math.round(v)}%`);
  const month = (s: Subject) => parseDay(s.nextTestDate!).toLocaleDateString(undefined, { month: 'short' });
  const date = (s: Subject) => String(parseDay(s.nextTestDate!).getDate()).padStart(2, '0');
  const d = first ? daysBetween(today, first.nextTestDate!) : 0;
  const others = upcoming.slice(1, 5);
  return (
    <HomeCard className="gel gel-blue" index={3}>
      <div className="hc-head">
        <span className="hc-title">Upcoming tests</span>
        <CornerLink to="/papers" label="Open Tests" />
      </div>
      {first ? (
        <>
          <div className="pair">
            <div>
              <div className="dot-num">{fmtAvg(avg(first))}</div>
              <span className="pair-label">{courseTitle(first.name)} average</span>
            </div>
            <div className="pair-right">
              <div className="dot-num">{date(first)}</div>
              <span className="pair-label">{month(first)}</span>
            </div>
          </div>
          <Link to={`/subjects/${first.id}`} className="rings" aria-label={`${courseTitle(first.name)} test in ${d} days`}>
            <span className="ring-outer" />
            <span className="ring-spin">
              {others.map((s, i) => {
                const a = (-90 + 40 + i * 70) * (Math.PI / 180);
                return (
                  <span key={s.id} className="ring-orb" style={vars({ left: `${50 + 50 * Math.cos(a)}%`, top: `${50 + 50 * Math.sin(a)}%`, '--c': s.colour })} title={`${courseTitle(s.name)} · ${fmtDay(s.nextTestDate!)}`}>
                    {badge(s)}
                  </span>
                );
              })}
              <span className="ring-orb lead" style={vars({ left: '50%', top: '0%', '--c': first.colour })}>
                {badge(first)}
              </span>
            </span>
            <span className="ring-inner">
              <span className="ri-num">{d}</span>
              <span className="ri-label">{d === 0 ? 'today' : d === 1 ? 'day left' : 'days left'}</span>
            </span>
          </Link>
          <div className="pair bottom">
            {second ? (
              <>
                <div>
                  <span className="pair-label">Then {courseTitle(second.name)}</span>
                  <div className="dot-num">{fmtAvg(avg(second))}</div>
                </div>
                <div className="pair-right">
                  <span className="pair-label">{month(second)}</span>
                  <div className="dot-num">{date(second)}</div>
                </div>
              </>
            ) : (
              <div>
                <span className="pair-label">Target</span>
                <div className="dot-num">{first.targetPct}%</div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="tc-empty">
          <span className="dot-num">00</span>
          <span className="pair-label">No test dates yet</span>
          <Link to="/subjects" className="dark-pill">
            Set a test date
          </Link>
        </div>
      )}
    </HomeCard>
  );
}

/* ---------- Strip: courses, quick logs, search ---------- */

function Strip({ data }: { data: AllData }) {
  const st = settings.use();
  const subjects = activeSubjects(data);
  const due = dueMistakes(data, st.redoDays).length;
  const cardsToday = cardsByDay(data).get(todayKey()) ?? 0;
  const lastStudy = subjects.find((s) => s.id === st.lastSubjectId) ?? subjects[0];
  return (
    <div className="h-strip">
      <div className="strip-group">
        <span className="sg-label">Courses</span>
        {subjects.map((s) => (
          <Link key={s.id} to={`/subjects/${s.id}`} className="sg-course" style={vars({ '--c': s.colour })} title={s.name}>
            <i />
          </Link>
        ))}
        <Link to="/subjects" className="sg-more" aria-label="All courses">
          <ChevronRight size={14} />
        </Link>
      </div>
      <div className="strip-group">
        <span className="sg-label">Log</span>
        <button type="button" className="sg-icon" onClick={() => openUI({ flashLog: true })} aria-label="Log flashcards" title="Log flashcards">
          <Layers size={15} strokeWidth={1.8} />
          {cardsToday === 0 && <span className="sg-badge">!</span>}
        </button>
        <button type="button" className="sg-icon" onClick={() => openUI({ bulk: { subjectId: st.lastSubjectId } })} aria-label="Mistakes from a test" title="Mistakes from a test">
          <ListPlus size={15} strokeWidth={1.8} />
          {due > 0 && <span className="sg-badge num">{due}</span>}
        </button>
        <button type="button" className="sg-icon" onClick={() => openUI({ logPaper: { preset: { subjectId: st.lastSubjectId } } })} aria-label="Log a test" title="Log a test">
          <FileText size={15} strokeWidth={1.8} />
        </button>
        <Link to="/timer?sprint=1" className="sg-icon" aria-label="Timed practice" title="Timed practice">
          <Timer size={15} strokeWidth={1.8} />
        </Link>
      </div>
      <Running data={data} fallback={lastStudy} />
      <span className="strip-space" />
      <button type="button" className="strip-search" onClick={() => openUI({ palette: true })}>
        <span>Search mistakes, notes, tests</span>
        <kbd>⌘K</kbd>
        <Search size={15} strokeWidth={1.9} />
      </button>
    </div>
  );
}

function Running({ data, fallback }: { data: AllData; fallback: Subject }) {
  const t = timer.use();
  const now = useNow(t?.kind === 'study');
  if (!t || t.kind !== 'study')
    return (
      <button type="button" className="strip-study" onClick={() => startStudy(fallback.id)}>
        <Play size={12} strokeWidth={2.4} fill="currentColor" /> Study {courseTitle(fallback.name)}
      </button>
    );
  const s = data.subjects.find((x) => x.id === t.subjectId);
  return (
    <div className="strip-running">
      <span className="pulse" />
      <span className="num">{fmtClock(timerSeconds(t, now))}</span>
      <span className="muted small">{s ? courseTitle(s.name) : ''}</span>
      <button type="button" onClick={stopStudy} aria-label="Stop and save">
        <Square size={10} strokeWidth={2.4} fill="currentColor" />
      </button>
    </div>
  );
}

/* ---------- Timeline: the week by course ---------- */

function Timeline({ data, offset, setOffset }: { data: AllData; offset: number; setOffset: (f: (n: number) => number) => void }) {
  const st = settings.use();
  const [menu, setMenu] = useState(false);
  const today = todayKey();
  const ws = addDays(weekStartKey(), offset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const todayIdx = days.indexOf(today);
  const left = todayPlan(data, st.redoDays, st.lastSubjectId).filter((p) => !p.done).length;
  const label = offset === 0 ? 'This week' : offset === -1 ? 'Last week' : offset === 1 ? 'Next week' : `${fmtDay(ws)} – ${fmtDay(addDays(ws, 6))}`;
  const byDay = useMemo(() => minutesByDay(data), [data]);
  const weekMins = days.reduce((a, d) => a + (byDay.get(d) ?? 0), 0);
  return (
    <section className="h-timeline" style={{ ['--i' as string]: 5 }}>
      <div className="tl-top">
        <div className="tl-float">
          <span className="tf-me">P</span>
          <button type="button" className="tf-label" onClick={() => setMenu((m) => !m)} aria-expanded={menu}>
            {label} <ChevronDown size={13} />
          </button>
          <span className="tf-chip num">{fmtHours(weekMins)}</span>
          <span className="tf-chip num">{left} left</span>
          {menu && (
            <div className="tf-menu" onMouseLeave={() => setMenu(false)}>
              <div className="tf-step">
                <button type="button" onClick={() => setOffset((o) => o - 1)} aria-label="Previous week">
                  <ChevronLeft size={14} />
                </button>
                <span>{label}</span>
                <button type="button" onClick={() => setOffset((o) => o + 1)} aria-label="Next week">
                  <ChevronRight size={14} />
                </button>
              </div>
              {[-1, 0, 1].map((o) => (
                <button
                  key={o}
                  type="button"
                  className={o === offset ? 'on' : undefined}
                  onClick={() => {
                    setOffset(() => o);
                    setMenu(false);
                  }}
                >
                  {o === -1 ? 'Last week' : o === 0 ? 'This week' : 'Next week'}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="tl-days">
          {days.map((d) => (
            <span key={d} className={d === today ? 'on' : undefined}>
              {parseDay(d).toLocaleDateString(undefined, { weekday: 'short' })} {parseDay(d).getDate()}
            </span>
          ))}
        </div>
      </div>
      <div className="tl-body">
        {todayIdx >= 0 && <span className="tl-now" style={vars({ '--x': (todayIdx + 0.5) / 7 })} />}
        {activeSubjects(data).map((s) => (
          <Row key={s.id} data={data} subject={s} days={days} />
        ))}
      </div>
    </section>
  );
}

function Row({ data, subject, days }: { data: AllData; subject: Subject; days: string[] }) {
  const open = data.mistakes.filter((m) => m.subjectId === subject.id && !m.cleared).length;
  const avg = subjectAverage(data, subject.id);
  const { code, title } = splitCourse(subject.name);
  return (
    <div className="tl-row">
      <Link to={`/subjects/${subject.id}`} className="tl-course">
        <span className="tl-swatch" style={vars({ '--c': subject.colour })}>
          {badge(subject)}
        </span>
        <span className="tl-name">
          {title}
          {code && <em>{code}</em>}
        </span>
        <span className="tl-open num" title="Open mistakes">
          {open}
        </span>
        <span className="tl-avg num">{avg == null ? '–' : `${Math.round(avg)}%`}</span>
      </Link>
      <div className="tl-cells">
        {days.map((d) => {
          const mins = data.sessions.filter((x) => x.subjectId === subject.id && x.date === d).reduce((a, x) => a + x.minutes, 0);
          const papers = data.papers.filter((p) => p.subjectId === subject.id && p.date === d);
          return (
            <div key={d} className="tl-cell">
              {subject.nextTestDate === d && <span className="tl-chip test">Test</span>}
              {papers.map((p) => (
                <span key={p.id} className="tl-chip paper">
                  {p.kind === 'past_paper' ? 'Practice' : 'Unit test'} {Math.round(pct(p))}%
                </span>
              ))}
              {mins > 0 && (
                <span className="tl-chip study" style={vars({ '--c': subject.colour })}>
                  {fmtHours(mins)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
