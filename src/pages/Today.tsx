import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarCheck, CalendarClock, Check, ChevronLeft, ChevronRight, FileText, Layers, ListPlus, Play, RotateCcw, Square, Timer, Zap } from 'lucide-react';
import { useData, type AllData } from '../db/db';
import type { Subject } from '../db/types';
import { addDays, daysBetween, fmtClock, fmtDay, fmtHours, greeting, parseDay, todayKey, weekStartKey } from '../lib/dates';
import { activeSubjects, cardsByDay, dueMistakes, flashStreak, loopScore, minutesByDay, pct, subjectAverage } from '../lib/stats';
import { todayPlan, type PlanItem } from '../lib/plan';
import { courseTitle, splitCourse } from '../lib/course';
import { openUI, settings, timer } from '../lib/state';
import { OWNER } from '../owner';
import { Card, Skeleton, cx } from '../components/ui';
import { Bars, DotRow, RangeLine, Ring, Spark, TickRuler } from '../components/charts/fancy';
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

/** Each tile's aura: two colours that glow from inside it. */
const aura = (a: string, b: string, pos?: { ax?: string; ay?: string; bx?: string; by?: string }) =>
  ({ ['--tint' as string]: a, ['--tint-2' as string]: b, ...(pos?.ax ? { ['--ax' as string]: pos.ax } : {}), ...(pos?.ay ? { ['--ay' as string]: pos.ay } : {}), ...(pos?.bx ? { ['--bx' as string]: pos.bx } : {}), ...(pos?.by ? { ['--by' as string]: pos.by } : {}) }) as React.CSSProperties;

export default function Today() {
  const data = useData();
  const today = todayKey();
  return (
    <div className="page today3">
      <header className="t-head">
        <div>
          <span className="t-date">{parseDay(today).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <h1>
            {greeting()}, {OWNER.name}
          </h1>
        </div>
        <Running data={data} />
      </header>
      {data ? <Body data={data} /> : <Skeleton height="30rem" />}
    </div>
  );
}

function Running({ data }: { data?: AllData }) {
  const t = timer.use();
  const now = useNow(t?.kind === 'study');
  if (!t || t.kind !== 'study') return null;
  const s = data?.subjects.find((x) => x.id === t.subjectId);
  return (
    <div className="t-running">
      <span className="pulse" />
      <span className="num">{fmtClock(timerSeconds(t, now))}</span>
      <span className="muted small">{s ? courseTitle(s.name) : ''}</span>
      <button type="button" className="bubble white" onClick={stopStudy} aria-label="Stop and save">
        <Square size={11} strokeWidth={2.4} fill="currentColor" />
      </button>
    </div>
  );
}

function Body({ data }: { data: AllData }) {
  if (!activeSubjects(data).length)
    return (
      <Link to="/subjects" className="t-empty">
        Add your courses to begin <ChevronRight size={16} />
      </Link>
    );
  return (
    <>
      <div className="today-grid">
        <PlanGel data={data} />
        <div className="tiles">
          <NextTestTile data={data} />
          <TargetTile data={data} />
          <WeekTile data={data} />
          <StudiedTile data={data} />
          <RedoTile data={data} />
          <FlashTile data={data} />
        </div>
      </div>
      <Timeline data={data} />
    </>
  );
}

/* ---------- The plan, on gel ---------- */

function PlanGel({ data }: { data: AllData }) {
  const nav = useNavigate();
  const st = settings.use();
  const plan = todayPlan(data, st.redoDays, st.lastSubjectId);
  const left = plan.filter((p) => !p.done).length;
  const subjects = activeSubjects(data);
  const study = subjects.find((s) => s.id === st.lastSubjectId) ?? subjects[0];
  const run = (p: PlanItem) => {
    const a = p.action;
    if (a.kind === 'nav') nav(a.to);
    else if (a.kind === 'flash') openUI({ flashLog: true });
    else if (a.kind === 'study') startStudy(a.subjectId);
    else openUI({ logPaper: { preset: { subjectId: a.subjectId } } });
  };
  return (
    <Card className="juice plan-gel" index={0} style={aura('#ff3d9a', '#7a4dff', { ax: '20%', ay: '0%', bx: '90%', by: '100%' })}>
      <div className="g-head">
        <span className="g-title">Today’s plan</span>
        <span className="glass-chip num">{left ? `${left} left` : 'All done'}</span>
      </div>
      <div className="g-pills">
        {plan.map((p) => {
          const Icon = ICONS[p.icon];
          return (
            <button key={p.id} type="button" className={cx('g-pill', p.done && 'done', p.urgent && 'urgent')} onClick={() => run(p)}>
              <span className="bubble">{p.done ? <Check size={14} strokeWidth={2.4} /> : <Icon size={14} strokeWidth={2} />}</span>
              <span className="gp-main">
                <span className="gp-title">{p.title}</span>
                <span className="gp-detail">{p.detail}</span>
              </span>
              <ChevronRight size={16} className="gp-chev" />
            </button>
          );
        })}
      </div>
      <div className="g-dock">
        <button type="button" className="dock-pill" onClick={() => openUI({ flashLog: true })} aria-label="Log flashcards" title="Flashcards">
          <Layers size={17} strokeWidth={1.8} />
        </button>
        <button type="button" className="dock-pill" onClick={() => openUI({ bulk: { subjectId: st.lastSubjectId } })} aria-label="Mistakes from a test" title="Mistakes from a test">
          <ListPlus size={17} strokeWidth={1.8} />
        </button>
        <button type="button" className="dock-pill white" onClick={() => startStudy(study.id)}>
          <Play size={15} strokeWidth={2} fill="currentColor" /> Study {courseTitle(study.name)}
        </button>
        <button type="button" className="dock-pill" onClick={() => openUI({ logPaper: { preset: { subjectId: st.lastSubjectId } } })} aria-label="Log a test" title="Log a test">
          <FileText size={17} strokeWidth={1.8} />
        </button>
        <button type="button" className="dock-pill" onClick={() => nav('/timer?sprint=1')} aria-label="Timed practice" title="Timed practice">
          <Timer size={17} strokeWidth={1.8} />
        </button>
      </div>
    </Card>
  );
}

/* ---------- Instrument tiles ---------- */

function Tile({ label, children, style, className, to, index }: { label: string; children: React.ReactNode; style: React.CSSProperties; className?: string; to?: string; index: number }) {
  const body = (
    <>
      <span className="tile-label">{label}</span>
      {children}
    </>
  );
  return (
    <Card className={cx('tile', className, to && 'hoverable')} index={index} style={style}>
      {to ? (
        <Link to={to} className="tile-link">
          {body}
        </Link>
      ) : (
        body
      )}
    </Card>
  );
}

function NextTestTile({ data }: { data: AllData }) {
  const today = todayKey();
  const next = activeSubjects(data)
    .filter((s) => s.nextTestDate && s.nextTestDate >= today)
    .sort((a, b) => (a.nextTestDate! < b.nextTestDate! ? -1 : 1))[0];
  const avg = next ? subjectAverage(data, next.id) : null;
  const d = next ? daysBetween(today, next.nextTestDate!) : 0;
  return (
    <Tile label="Next test" className="wide" index={1} to={next ? `/subjects/${next.id}` : '/subjects'} style={aura('#3f6dff', '#a35cff', { ax: '75%', ay: '30%', bx: '20%', by: '110%' })}>
      {next ? (
        <div className="nt-row">
          <div>
            <div className="num-xl">
              {d}
              <small>{d === 1 ? 'day' : 'days'}</small>
            </div>
            <span className="tile-sub">
              {courseTitle(next.name)} · {fmtDay(next.nextTestDate!, { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>
          </div>
          <Ring value={avg ?? 0} label={avg == null ? '–' : String(Math.round(avg))} />
        </div>
      ) : (
        <span className="tile-sub">No test dates yet</span>
      )}
    </Tile>
  );
}

function TargetTile({ data }: { data: AllData }) {
  const st = settings.use();
  const subjects = activeSubjects(data);
  const s = subjects.find((x) => x.id === st.lastSubjectId) ?? subjects[0];
  const avg = subjectAverage(data, s.id);
  return (
    <Tile label={`${courseTitle(s.name)} average`} index={2} to={`/subjects/${s.id}`} style={aura('#3ecf7a', '#c8ff6b', { ax: '50%', ay: '60%', bx: '0%', by: '0%' })}>
      <div className="num-xl">
        {avg == null ? '–' : Math.round(avg)}
        <small>%</small>
      </div>
      <div className="tile-foot">
        <RangeLine value={avg} target={s.targetPct} />
        <span className="tile-sub">target {s.targetPct}%</span>
      </div>
    </Tile>
  );
}

function WeekTile({ data }: { data: AllData }) {
  const st = settings.use();
  const ws = weekStartKey();
  const today = todayKey();
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const cards = cardsByDay(data);
  const mins = minutesByDay(data);
  const loop = loopScore(data, ws, st.redoDays).score;
  return (
    <Tile label="This week" index={3} to="/progress" style={aura('#ff4fa0', '#ff9ad1', { ax: '50%', ay: '55%', bx: '100%', by: '0%' })}>
      <div className="num-xl">
        {loop}
        <small>%</small>
      </div>
      <div className="tile-foot">
        <DotRow values={days.map((d) => (cards.get(d) ?? 0) > 0 || (mins.get(d) ?? 0) > 0)} current={days.indexOf(today)} labels={days.map((d) => parseDay(d).toLocaleDateString(undefined, { weekday: 'narrow' }))} />
      </div>
    </Tile>
  );
}

function StudiedTile({ data }: { data: AllData }) {
  const ws = weekStartKey();
  const today = todayKey();
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const mins = minutesByDay(data);
  const week = days.reduce((a, d) => a + (mins.get(d) ?? 0), 0);
  return (
    <Tile label="Studied" index={4} to="/timer" style={aura('#ff7a2f', '#ff3d6b', { ax: '85%', ay: '90%', bx: '10%', by: '0%' })}>
      <div className="num-xl">
        {Math.floor(week / 60)}
        <small>h</small> {Math.round(week % 60)}
        <small>m</small>
      </div>
      <div className="tile-foot wave-foot">
        <Bars values={days.map((d) => mins.get(d) ?? 0)} labels={days.map((d) => parseDay(d).toLocaleDateString(undefined, { weekday: 'narrow' }))} highlight={days.indexOf(today)} hue="sand" format={fmtHours} />
      </div>
    </Tile>
  );
}

function RedoTile({ data }: { data: AllData }) {
  const st = settings.use();
  const due = dueMistakes(data, st.redoDays).length;
  const open = data.mistakes.filter((m) => !m.cleared).length;
  return (
    <Tile label="To redo" index={5} to="/mistakes?status=due" style={aura('#ff3d6b', '#8a6cff', { ax: '15%', ay: '20%', bx: '95%', by: '100%' })}>
      <div className="num-xl">
        {due}
        <small>of {open}</small>
      </div>
      <div className="tile-foot">
        <TickRuler value={due} min={0} max={Math.max(open, 1)} labels={['0', String(due), String(open)]} />
      </div>
    </Tile>
  );
}

function FlashTile({ data }: { data: AllData }) {
  const cards = cardsByDay(data);
  const today = todayKey();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const n = cards.get(today) ?? 0;
  return (
    <Tile label="Flashcards" className="wide" index={6} style={aura('#8a6cff', '#3f6dff', { ax: '90%', ay: '10%', bx: '30%', by: '110%' })}>
      <div className="fl-row">
        <div>
          <div className="num-xl">
            {n}
            <small>today</small>
          </div>
          <span className="tile-sub">Streak {flashStreak(data)} days</span>
          <button type="button" className="glass-chip action" onClick={() => openUI({ flashLog: true })}>
            Log cards
          </button>
        </div>
        <div className="fl-chart">
          <Spark values={days.map((d) => cards.get(d) ?? 0)} labels={days.map((d) => parseDay(d).toLocaleDateString(undefined, { weekday: 'narrow' }))} hue="lavender" />
        </div>
      </div>
    </Tile>
  );
}

/* ---------- Timeline: this week by course ---------- */

function Timeline({ data }: { data: AllData }) {
  const [offset, setOffset] = useState(0);
  const today = todayKey();
  const ws = addDays(weekStartKey(), offset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const todayIdx = days.indexOf(today);
  return (
    <Card className="timeline-card" index={7} style={aura('#6d5cff', '#3f6dff', { ax: '80%', ay: '0%', bx: '0%', by: '100%' })}>
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
        <div className="tl-days">
          {days.map((d) => (
            <span key={d} className={d === today ? 'on' : undefined}>
              {parseDay(d).toLocaleDateString(undefined, { weekday: 'short' })} {parseDay(d).getDate()}
            </span>
          ))}
        </div>
      </div>
      <div className="tl-body">
        {todayIdx >= 0 && <span className="tl-now" style={{ ['--x' as string]: (todayIdx + 0.5) / 7 }} />}
        {activeSubjects(data).map((s) => (
          <Row key={s.id} data={data} subject={s} days={days} />
        ))}
      </div>
    </Card>
  );
}

function Row({ data, subject, days }: { data: AllData; subject: Subject; days: string[] }) {
  const open = data.mistakes.filter((m) => m.subjectId === subject.id && !m.cleared).length;
  const avg = subjectAverage(data, subject.id);
  const { code, title } = splitCourse(subject.name);
  return (
    <div className="tl-row">
      <Link to={`/subjects/${subject.id}`} className="tl-course">
        <span className="tl-swatch" style={{ ['--c' as string]: subject.colour }} />
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
                <span className="tl-chip study" style={{ ['--c' as string]: subject.colour }}>
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
