import { Link, useNavigate } from 'react-router-dom';
import { CalendarCheck, CalendarClock, Check, ChevronRight, Flame, Layers, Play, RotateCcw, Square, Timer, Zap } from 'lucide-react';
import { useData, type AllData } from '../db/db';
import { daysBetween, fmtClock, fmtDay, fmtHours, greeting, parseDay, todayKey, weekStartKey } from '../lib/dates';
import { activeSubjects, dueMistakes, loopScore, studyStreak, subjectAverage } from '../lib/stats';
import { todayPlan, type PlanItem } from '../lib/plan';
import { courseTitle, splitCourse } from '../lib/course';
import { openUI, settings, timer } from '../lib/state';
import { OWNER } from '../owner';
import { HUES } from '../components/charts/fancy';
import { CountUp, Skeleton, cx } from '../components/ui';
import { SearchTrigger } from '../features/Search';
import { startStudy, stopStudy } from '../features/timerActions';
import { timerSeconds, useNow } from '../features/TimerController';

const ICONS: Record<PlanItem['icon'], typeof Check> = {
  test: CalendarClock,
  cards: Layers,
  redo: RotateCcw,
  study: Play,
  timed: Zap,
  review: CalendarCheck,
};

export default function Today() {
  const data = useData();
  const today = todayKey();
  return (
    <div className="page today-page">
      <header className="topbar">
        <div className="titles">
          <span className="eyebrow">{parseDay(today).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <h1>
            {greeting()}, <span className="serif">{OWNER.name}</span>
          </h1>
        </div>
        <SearchTrigger />
      </header>
      {data ? <TodayBody data={data} /> : <Skeleton height="24rem" />}
    </div>
  );
}

function TodayBody({ data }: { data: AllData }) {
  const nav = useNavigate();
  const st = settings.use();
  const plan = todayPlan(data, st.redoDays, st.lastSubjectId);
  const subjects = activeSubjects(data);
  const done = plan.filter((p) => p.done).length;

  const run = (p: PlanItem) => {
    const a = p.action;
    if (a.kind === 'nav') nav(a.to);
    else if (a.kind === 'flash') openUI({ flashLog: true });
    else if (a.kind === 'study') startStudy(a.subjectId);
    else openUI({ logPaper: { preset: { subjectId: a.subjectId } } });
  };

  if (!subjects.length)
    return (
      <section className="ilist-wrap">
        <div className="ilist">
          <Link to="/subjects" className="irow">
            <span className="irow-icon" style={hueVars('clay')}>
              <Layers size={15} strokeWidth={2} />
            </span>
            <span className="irow-main">
              <strong>Add your courses</strong>
              <span>Start with the ones you are taking this semester.</span>
            </span>
            <ChevronRight size={16} className="chev" />
          </Link>
        </div>
      </section>
    );

  return (
    <div className="today-layout">
      <section className="ilist-wrap">
        <div className="section-head">
          <h2>Plan</h2>
          <span className="count num">
            {done} of {plan.length}
          </span>
        </div>
        <RunningRow data={data} />
        <div className="ilist">
          {plan.map((p, i) => {
            const Icon = ICONS[p.icon];
            return (
              <button key={p.id} type="button" className={cx('irow', 'plan-row', p.done && 'done', p.urgent && 'urgent')} onClick={() => run(p)} style={{ ['--i' as string]: i, ...hueVars(p.hue) }}>
                <span className={cx('check', p.done && 'on')}>{p.done && <Check size={12} strokeWidth={3} />}</span>
                <span className="irow-main">
                  <strong>{p.title}</strong>
                  <span>{p.detail}</span>
                </span>
                <span className="plan-icon">
                  <Icon size={14} strokeWidth={2} />
                </span>
                <ChevronRight size={16} className="chev" />
              </button>
            );
          })}
        </div>

        <div className="section-head log-head">
          <h2>Log</h2>
        </div>
        <div className="log-grid">
          <button type="button" className="log-btn" style={hueVars('lavender')} onClick={() => openUI({ flashLog: true })}>
            <Layers size={17} strokeWidth={2} />
            Flashcards
          </button>
          <button type="button" className="log-btn" style={hueVars('rose')} onClick={() => openUI({ bulk: { subjectId: st.lastSubjectId } })}>
            <RotateCcw size={17} strokeWidth={2} />
            Mistakes from a test
          </button>
          <button type="button" className="log-btn" style={hueVars('sage')} onClick={() => openUI({ logPaper: { preset: { subjectId: st.lastSubjectId } } })}>
            <CalendarCheck size={17} strokeWidth={2} />
            Test result
          </button>
          <button type="button" className="log-btn" style={hueVars('sand')} onClick={() => nav('/timer')}>
            <Timer size={17} strokeWidth={2} />
            Study time
          </button>
        </div>
      </section>

      <aside className="today-side">
        <Glance data={data} />
        <ComingUp data={data} />
      </aside>
    </div>
  );
}

const hueVars = (h: keyof typeof HUES) => ({ ['--ha' as string]: HUES[h][0], ['--hb' as string]: HUES[h][1] });

/** The running study timer, pinned above the plan. */
function RunningRow({ data }: { data: AllData }) {
  const t = timer.use();
  const now = useNow(t?.kind === 'study');
  if (!t || t.kind !== 'study') return null;
  const s = data.subjects.find((x) => x.id === t.subjectId);
  return (
    <div className="running-row" style={hueVars('sand')}>
      <span className="pulse" />
      <span className="irow-main">
        <strong className="num">{fmtClock(timerSeconds(t, now))}</strong>
        <span>{s ? courseTitle(s.name) : 'Studying'}</span>
      </span>
      <button type="button" className="btn sm" onClick={stopStudy}>
        <Square size={11} strokeWidth={2.4} fill="currentColor" /> Stop and save
      </button>
    </div>
  );
}

function Glance({ data }: { data: AllData }) {
  const st = settings.use();
  const weekStart = weekStartKey();
  const loop = loopScore(data, weekStart, st.redoDays).score;
  const week = data.sessions.filter((s) => s.date >= weekStart).reduce((a, s) => a + s.minutes, 0);
  const due = dueMistakes(data, st.redoDays).length;
  const streak = studyStreak(data);
  const r = 15;
  const circ = 2 * Math.PI * r;
  return (
    <section>
      <div className="section-head">
        <h2>This week</h2>
        <Link to="/progress" className="see-all">
          Progress <ChevronRight size={14} />
        </Link>
      </div>
      <div className="widgets">
        <Link to="/progress" className="widget" style={hueVars('lavender')}>
          <span className="w-label">Loop</span>
          <span className="w-ring">
            <svg viewBox="0 0 40 40" aria-hidden="true">
              <circle cx="20" cy="20" r={r} fill="none" stroke="var(--hb)" strokeOpacity="0.18" strokeWidth="5" />
              <circle cx="20" cy="20" r={r} fill="none" stroke="var(--ha)" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(loop / 100) * circ} ${circ}`} transform="rotate(-90 20 20)" className="w-ring-fill" />
            </svg>
          </span>
          <span className="w-value num">
            <CountUp value={loop} />
            <small>%</small>
          </span>
        </Link>
        <Link to="/timer" className="widget" style={hueVars('sand')}>
          <span className="w-label">Studied</span>
          <Timer size={16} strokeWidth={2} className="w-icon" />
          <span className="w-value num">{fmtHours(week)}</span>
        </Link>
        <Link to="/progress" className="widget" style={hueVars('clay')}>
          <span className="w-label">Streak</span>
          <Flame size={16} strokeWidth={2} className="w-icon" />
          <span className="w-value num">
            <CountUp value={streak} />
            <small>{streak === 1 ? 'day' : 'days'}</small>
          </span>
        </Link>
        <Link to="/mistakes?status=due" className="widget" style={hueVars('rose')}>
          <span className="w-label">To redo</span>
          <RotateCcw size={16} strokeWidth={2} className="w-icon" />
          <span className="w-value num">
            <CountUp value={due} />
          </span>
        </Link>
      </div>
    </section>
  );
}

function ComingUp({ data }: { data: AllData }) {
  const today = todayKey();
  const tests = activeSubjects(data)
    .filter((s) => s.nextTestDate && s.nextTestDate >= today)
    .sort((a, b) => (a.nextTestDate! < b.nextTestDate! ? -1 : 1));
  return (
    <section>
      <div className="section-head">
        <h2>Coming up</h2>
      </div>
      <div className="ilist">
        {tests.length === 0 && (
          <Link to="/subjects" className="irow">
            <span className="irow-main">
              <span>No test dates yet. Add one on a course.</span>
            </span>
            <ChevronRight size={16} className="chev" />
          </Link>
        )}
        {tests.map((s) => {
          const d = daysBetween(today, s.nextTestDate!);
          const { code, title } = splitCourse(s.name);
          const avg = subjectAverage(data, s.id);
          return (
            <Link key={s.id} to={`/subjects/${s.id}`} className="irow">
              <span className="dot" style={{ background: s.colour }} />
              <span className="irow-main">
                <strong>
                  {title} {code && <em className="code">{code}</em>}
                </strong>
                <span>
                  {fmtDay(s.nextTestDate!, { weekday: 'short', day: 'numeric', month: 'short' })} · average {avg == null ? '–' : `${Math.round(avg)}%`} of {s.targetPct}%
                </span>
              </span>
              <span className={cx('days', d <= 3 && 'soon')}>{d === 0 ? 'Today' : `${d}d`}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
