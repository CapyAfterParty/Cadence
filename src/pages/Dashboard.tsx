import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  BookOpen,
  CalendarCheck,
  CalendarClock,
  Check,
  CircleAlert,
  Flame,
  Layers,
  Play,
  Plus,
  RotateCcw,
  Target,
  Timer,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useData, type AllData } from '../db/db';
import type { Subject } from '../db/types';
import { addDays, daysBetween, fmtDay, fmtHours, greeting, inWeek, isSunday, lastNDays, parseDay, todayKey, weekStartKey, weekdayLetter } from '../lib/dates';
import {
  activeSubjects,
  cardsByDay,
  dueMistakes,
  flashStreak,
  isCheckinDone,
  lastAttemptMap,
  loopScore,
  minutesByDay,
  monthMinutes,
  pct,
  recentWeeks,
  studyStreak,
  subjectAverage,
  subjectPapers,
} from '../lib/stats';
import { openUI, settings } from '../lib/state';
import { Heatmap } from '../components/charts/charts';
import { ArcGauge, LoopRing, MultiLine, Rings, Scene, SmoothArea, StackBars } from '../components/charts/fancy';
import { Card, CardHead, Chip, CountUp, Empty, IconTile, Skeleton, cx, type Tone } from '../components/ui';
import { SearchBox } from '../features/Search';
import { RunningPill } from '../features/TimerController';
import { startStudy } from '../features/timerActions';

const SW = 1.8;

function isoWeek(key: string) {
  const d = parseDay(key);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7);
}

export default function Dashboard() {
  const data = useData();
  const s = settings.use();
  return (
    <div className="page home">
      <Header data={data} name={s.name} />
      {data ? <Body data={data} /> : <GridSkeleton />}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="bento">
      <Skeleton height="31rem" style={{ gridColumn: 'span 5', gridRow: 'span 2' }} />
      <Skeleton height="15rem" style={{ gridColumn: 'span 4' }} />
      <Skeleton height="31rem" style={{ gridColumn: 'span 3', gridRow: 'span 2' }} />
      <Skeleton height="15rem" style={{ gridColumn: 'span 4' }} />
    </div>
  );
}

/* ---------- Header: date, greeting, a one-line brief, the command bar ---------- */

function brief(data: AllData, redoDays: number) {
  const today = todayKey();
  const due = dueMistakes(data, redoDays, today).length;
  const cards = cardsByDay(data).get(today) ?? 0;
  const soon = activeSubjects(data)
    .filter((s) => s.nextTestDate && daysBetween(today, s.nextTestDate) >= 0)
    .sort((a, b) => (a.nextTestDate! < b.nextTestDate! ? -1 : 1))[0];
  const bits: string[] = [];
  if (!cards) bits.push('flashcards are still to do');
  if (due) bits.push(`${due} ${due === 1 ? 'mistake is' : 'mistakes are'} waiting for a redo`);
  if (soon) {
    const d = daysBetween(today, soon.nextTestDate!);
    bits.push(`${soon.name} is ${d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`}`);
  }
  if (!bits.length) return 'Everything is on rhythm today. Nice.';
  const s = bits.length === 1 ? bits[0] : `${bits.slice(0, -1).join(', ')} and ${bits[bits.length - 1]}`;
  return s[0].toUpperCase() + s.slice(1) + '.';
}

function Header({ data, name }: { data?: AllData; name: string }) {
  const st = settings.use();
  const today = todayKey();
  const first = name.split(' ')[0];
  return (
    <header className="home-head">
      <div className="hh-left">
        <span className="eyebrow">
          {parseDay(today).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })} · Week {isoWeek(today)}
        </span>
        <h1 className="hh-title">
          {greeting()}
          {first ? ', ' : '.'}
          {first && <span className="serif grad-name">{first}.</span>}
        </h1>
        <p className="hh-brief">{data ? brief(data, st.redoDays) : ' '}</p>
      </div>
      <div className="hh-right">
        <RunningPill />
        <SearchBox variant="hero" />
      </div>
      {data && <TodayChips data={data} />}
    </header>
  );
}

function TodayChips({ data }: { data: AllData }) {
  const nav = useNavigate();
  const st = settings.use();
  const today = todayKey();
  const subjects = activeSubjects(data);
  if (!subjects.length)
    return (
      <div className="today-row">
        <SmartChip tone="ember" icon={<BookOpen size={14} strokeWidth={SW} />} onClick={() => nav('/subjects')} i={0}>
          Add your first subject
        </SmartChip>
      </div>
    );
  const cardsToday = cardsByDay(data).get(today) ?? 0;
  const due = dueMistakes(data, st.redoDays, today).length;
  const weekStart = weekStartKey(today);
  const timedDone = data.papers.some((p) => p.timed && inWeek(p.date, weekStart));
  const last = subjects.find((s) => s.id === st.lastSubjectId) ?? subjects[0];
  let i = 0;
  return (
    <div className="today-row">
      <SmartChip tone="orchid" icon={cardsToday ? <Check size={14} strokeWidth={2.4} /> : <Layers size={14} strokeWidth={SW} />} done={cardsToday > 0} onClick={() => openUI({ flashLog: true })} i={i++}>
        {cardsToday > 0 ? `${cardsToday} cards today` : 'Log flashcards'}
      </SmartChip>
      {due > 0 && (
        <SmartChip tone="coral" icon={<RotateCcw size={14} strokeWidth={SW} />} onClick={() => nav(`/redo?subject=${last.id}`)} i={i++}>
          Redo {due} {due === 1 ? 'mistake' : 'mistakes'}
        </SmartChip>
      )}
      <SmartChip tone="lagoon" icon={timedDone ? <Check size={14} strokeWidth={2.4} /> : <Zap size={14} strokeWidth={SW} />} done={timedDone} onClick={() => nav(timedDone ? '/papers' : '/timer?sprint=1')} i={i++}>
        {timedDone ? 'Timed paper done' : 'Timed paper this weekend'}
      </SmartChip>
      <SmartChip tone="ember" icon={<Play size={13} strokeWidth={2.2} fill="currentColor" />} onClick={() => startStudy(last.id)} i={i++}>
        Study {last.name}
      </SmartChip>
      <SmartChip tone="gold" icon={<Plus size={14} strokeWidth={2.2} />} onClick={() => openUI({ logPaper: { preset: { subjectId: last.id } } })} i={i++}>
        Log a paper
      </SmartChip>
    </div>
  );
}

function SmartChip({ tone, icon, children, onClick, done, i }: { tone: Tone; icon: React.ReactNode; children: React.ReactNode; onClick: () => void; done?: boolean; i: number }) {
  return (
    <button type="button" className={cx('smart-chip', done && 'done')} onClick={onClick} style={{ ['--i' as string]: i }}>
      <span className={`sc-icon tone-${tone}`}>{icon}</span>
      {children}
    </button>
  );
}

/* ---------- Bento ---------- */

function Body({ data }: { data: AllData }) {
  const st = settings.use();
  const subjects = activeSubjects(data);
  const [chosenId, setChosenId] = useState(st.lastSubjectId ?? '');
  const subject = subjects.find((s) => s.id === chosenId) ?? subjects[0];
  const today = todayKey();
  const weekStart = weekStartKey(today);
  const checkinDone = isCheckinDone(data.checkins.find((c) => c.weekStart === weekStart));

  return (
    <>
      {isSunday(today) && !checkinDone && (
        <div className="banner">
          <IconTile tone="gold">
            <CalendarCheck size={18} strokeWidth={SW} />
          </IconTile>
          <span>
            <strong>It’s Sunday.</strong> <span className="muted">Your weekly check-in is ready, with this week’s stats already filled in.</span>
          </span>
          <Link to="/checkin" className="btn primary sm">
            Open check-in <ArrowUpRight size={14} strokeWidth={2} />
          </Link>
        </div>
      )}
      <div className="bento">
        <LoopCard data={data} redoDays={st.redoDays} />
        <StudyCard data={data} />
        <TargetCard data={data} subject={subject} onPick={setChosenId} />
        <FlashCard data={data} />
        <MistakesCard data={data} redoDays={st.redoDays} />
        <PapersCard data={data} subject={subject} onPick={setChosenId} />
        <GoalsCard data={data} />
        <HeatmapCard data={data} />
        <UpNextCard data={data} />
      </div>
    </>
  );
}

const loopWord = (s: number) => (s >= 100 ? 'complete' : s >= 75 ? 'nearly there' : s >= 50 ? 'halfway there' : s >= 25 ? 'building' : 'just starting');

function LoopCard({ data, redoDays }: { data: AllData; redoDays: number }) {
  const weekStart = weekStartKey();
  const today = todayKey();
  const current = loopScore(data, weekStart, redoDays);
  const weeks = recentWeeks(8);
  const history = weeks.map((w) => loopScore(data, w, redoDays).score);
  const prev = history[history.length - 2] ?? 0;
  const delta = current.score - prev;
  const [flash, paper, redo, check] = current.parts;
  const daysIn = Math.min(7, daysBetween(weekStart, today) + 1);
  const legend: { tone: Tone; icon: React.ReactNode; label: string; status: string; v: number }[] = [
    { tone: 'orchid', icon: <Layers size={15} strokeWidth={SW} />, label: 'Flashcards', status: `${Math.round(flash.value * 7)} of 7 days`, v: flash.value },
    { tone: 'lagoon', icon: <Zap size={15} strokeWidth={SW} />, label: 'Timed paper', status: paper.value >= 1 ? 'Done' : 'Not yet', v: paper.value },
    { tone: 'coral', icon: <RotateCcw size={15} strokeWidth={SW} />, label: 'Mistakes redone', status: `${Math.round(redo.value * 100)}%`, v: redo.value },
    { tone: 'gold', icon: <CalendarCheck size={15} strokeWidth={SW} />, label: 'Check-in', status: check.value >= 1 ? 'Done' : isSunday(today) ? 'Today' : 'Sunday', v: check.value },
  ];
  return (
    <Card className="b-loop" index={0} tint="orchid" tilt>
      <CardHead icon={<Target size={18} strokeWidth={SW} />} tone="ember" title="Weekly loop" aside={`Day ${daysIn} of 7`} />
      <div className="loop-body">
        <div className="loop-ring-wrap">
          <LoopRing
            parts={[
              { value: flash.value, from: '#e0b0ff', to: '#b06bff', label: 'Flashcards' },
              { value: paper.value, from: '#7cecff', to: '#4d7cff', label: 'Timed paper' },
              { value: redo.value, from: '#ffc58a', to: '#ff4f6d', label: 'Mistakes' },
              { value: check.value, from: '#fff0b3', to: '#ff9f2e', label: 'Check-in' },
            ]}
          >
            <span className="loop-score num">
              <CountUp value={current.score} />
            </span>
            <span className="loop-word serif">{loopWord(current.score)}</span>
            <span className={cx('delta', delta >= 0 ? 'up' : 'down')}>
              {delta >= 0 ? <TrendingUp size={12} strokeWidth={2.2} /> : <TrendingDown size={12} strokeWidth={2.2} />}
              {delta >= 0 ? '+' : ''}
              {delta} vs last week
            </span>
          </LoopRing>
        </div>
        <ul className="loop-legend">
          {legend.map((l, i) => (
            <li key={l.label} style={{ ['--i' as string]: i }}>
              <span className={`lg-icon tone-${l.tone}`}>{l.icon}</span>
              <span className="lg-text">
                <strong>{l.label}</strong>
                <span>{l.status}</span>
              </span>
              <span className={cx('lg-check', l.v >= 1 && 'on')}>{l.v >= 1 ? <Check size={12} strokeWidth={3} /> : <span className="num">{Math.round(l.v * 100)}</span>}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="loop-weeks">
        <span className="eyebrow">Last 8 weeks</span>
        <div className="lw-bars">
          {history.map((v, i) => (
            <span key={i} className={i === history.length - 1 ? 'lw on' : 'lw'} style={{ height: `${Math.max(6, v)}%`, animationDelay: `${400 + i * 50}ms` }} title={`Week of ${fmtDay(weeks[i])}: ${v}`} />
          ))}
        </div>
      </div>
    </Card>
  );
}

function Duration({ minutes }: { minutes: number }) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return (
    <span className="big-num">
      <CountUp value={h} />
      <span className="u">h</span> <CountUp value={m} />
      <span className="u">m</span>
    </span>
  );
}

function StudyCard({ data }: { data: AllData }) {
  const days = lastNDays(7);
  const weekStart = weekStartKey();
  const subjects = activeSubjects(data);
  const series = subjects.map((s) => ({
    name: s.name,
    colour: s.colour,
    values: days.map((d) => data.sessions.filter((x) => x.subjectId === s.id && x.date === d).reduce((a, x) => a + x.minutes, 0)),
  }));
  const week = data.sessions.filter((s) => s.date >= weekStart).reduce((a, s) => a + s.minutes, 0);
  const lastWeek = data.sessions.filter((s) => inWeek(s.date, addDays(weekStart, -7)) && s.date <= addDays(todayKey(), -7)).reduce((a, s) => a + s.minutes, 0);
  const delta = week - lastWeek;
  return (
    <Card className="b-study" index={1} tint="ember" tilt>
      <CardHead icon={<Timer size={18} strokeWidth={SW} />} tone="ember" title={<Link to="/timer">Study time</Link>} aside="Last 7 days" />
      <div className="kpi-row">
        <Duration minutes={week} />
        <span className={cx('delta', delta >= 0 ? 'up' : 'down')}>
          {delta >= 0 ? <TrendingUp size={12} strokeWidth={2.2} /> : <TrendingDown size={12} strokeWidth={2.2} />}
          {fmtHours(Math.abs(delta))} vs last week
        </span>
      </div>
      <div className="chart-fill">
        <StackBars labels={days.map(weekdayLetter)} series={series} format={fmtHours} />
      </div>
    </Card>
  );
}

function FlashCard({ data }: { data: AllData }) {
  const cards = cardsByDay(data);
  const days = lastNDays(7);
  const today = cards.get(todayKey()) ?? 0;
  const streak = flashStreak(data);
  return (
    <Card className="b-flash" index={3} tint="orchid" tilt>
      <CardHead
        icon={<Layers size={18} strokeWidth={SW} />}
        tone="orchid"
        title="Flashcards"
        aside={
          <span className="streak">
            <Flame size={12} strokeWidth={2.2} /> {streak} days
          </span>
        }
      />
      <div className="kpi-row">
        <span className="big-num">
          <CountUp value={today} />
          <span className="u">today</span>
        </span>
        <button type="button" className={cx('orb-btn', !today && 'hot')} onClick={() => openUI({ flashLog: true })} aria-label="Log flashcards">
          <Plus size={18} strokeWidth={2.2} />
        </button>
      </div>
      <div className="chart-fill">
        <SmoothArea values={days.map((d) => cards.get(d) ?? 0)} compare={days.map((d) => cards.get(addDays(d, -7)) ?? 0)} labels={days.map(weekdayLetter)} />
      </div>
    </Card>
  );
}

function MistakesCard({ data, redoDays }: { data: AllData; redoDays: number }) {
  const nav = useNavigate();
  const days = lastNDays(7);
  const due = dueMistakes(data, redoDays).length;
  const redone = new Set(data.attempts.filter((a) => days.includes(a.date)).map((a) => a.mistakeId)).size;
  const cleared = new Set(data.attempts.filter((a) => a.correct && days.includes(a.date)).map((a) => a.mistakeId)).size;
  const logged = data.mistakes.filter((m) => days.includes(m.date)).length;
  const open = data.mistakes.filter((m) => !m.cleared);
  const carded = data.mistakes.length ? data.mistakes.filter((m) => m.cardMade).length / data.mistakes.length : 0;
  const rings = [
    { value: redone / Math.max(1, redone + due), from: '#ffc58a', to: '#ff4f6d', label: 'Redone', text: `${redone} of ${redone + due}` },
    { value: logged ? cleared / logged : cleared ? 1 : 0, from: '#fff0b3', to: '#ff9f2e', label: 'Cleared', text: `${cleared} vs ${logged} logged` },
    { value: carded, from: '#e0b0ff', to: '#b06bff', label: 'Cards made', text: `${Math.round(carded * 100)}%` },
  ];
  const last = lastAttemptMap(data.attempts);
  void last;
  return (
    <Card className="b-mistakes" index={4} tint="coral" tilt>
      <CardHead icon={<CircleAlert size={18} strokeWidth={SW} />} tone="coral" title={<Link to="/mistakes">Mistakes</Link>} aside={`${open.length} open`} />
      <div className="mk-body">
        <div className="mk-rings">
          <Rings rings={rings} />
        </div>
        <div className="mk-side">
          <span className="big-num">
            <CountUp value={due} />
            <span className="u">due</span>
          </span>
          <ul className="mk-legend">
            {rings.map((r) => (
              <li key={r.label}>
                <i style={{ background: `linear-gradient(135deg, ${r.from}, ${r.to})` }} />
                <span>{r.label}</span>
                <b className="num">{r.text}</b>
              </li>
            ))}
          </ul>
          <button type="button" className="btn sm" disabled={!due} onClick={() => nav(`/redo?subject=${settings.get().lastSubjectId ?? ''}`)}>
            <RotateCcw size={13} strokeWidth={2} /> Start redo
          </button>
        </div>
      </div>
    </Card>
  );
}

function PapersCard({ data, subject, onPick }: { data: AllData; subject?: Subject; onPick: (id: string) => void }) {
  const subjects = activeSubjects(data);
  const weeks = recentWeeks(10);
  const series = subjects.map((s) => ({
    id: s.id,
    colour: s.colour,
    values: weeks.map((w) => {
      const ps = data.papers.filter((p) => p.subjectId === s.id && inWeek(p.date, w));
      return ps.length ? ps.reduce((a, p) => a + pct(p), 0) / ps.length : null;
    }),
  }));
  const avg = subject ? subjectAverage(data, subject.id) : null;
  const papers = subject ? subjectPapers(data, subject.id) : [];
  const best = papers.length ? Math.max(...papers.map(pct)) : null;
  const any = data.papers.length > 0;
  return (
    <Card className="b-papers" index={5} tint="lagoon" tilt>
      <CardHead icon={<BookOpen size={18} strokeWidth={SW} />} tone="lagoon" title={<Link to={subject ? `/papers?subject=${subject.id}` : '/papers'}>Paper scores</Link>} aside="Weekly average · 10 weeks" />
      {!any ? (
        <Empty text="Log a paper to see your trend." action={<button type="button" className="btn sm" onClick={() => openUI({ logPaper: { preset: { subjectId: subject?.id } } })}>Log a paper</button>} />
      ) : (
        <>
          <div className="kpi-row">
            <span className="big-num">
              {avg == null ? '–' : <CountUp value={Math.round(avg)} />}
              <span className="u">%</span>
            </span>
            <span className="kpi-meta">
              <span>{subject?.name} · last 3 papers</span>
              <span className="muted">Best {best == null ? '–' : `${Math.round(best)}%`} · target {subject?.targetPct}%</span>
            </span>
          </div>
          <div className="chart-fill">
            <MultiLine series={series} labels={weeks.map((w) => fmtDay(w, { day: 'numeric', month: 'short' }))} target={subject?.targetPct} focus={subject?.id} />
          </div>
          <div className="chip-row tight">
            {subjects.map((s) => (
              <Chip key={s.id} dot={s.colour} active={s.id === subject?.id} onClick={() => onPick(s.id)}>
                {s.name}
              </Chip>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

function TargetCard({ data, subject, onPick }: { data: AllData; subject?: Subject; onPick: (id: string) => void }) {
  const today = todayKey();
  const avg = subject ? subjectAverage(data, subject.id) : null;
  const days = subject?.nextTestDate ? daysBetween(today, subject.nextTestDate) : null;
  return (
    <Card className="b-target target-card" index={2}>
      <Scene />
      <div className="tc-content">
        <div className="tc-orbs">
          {activeSubjects(data).map((s) => (
            <button
              key={s.id}
              type="button"
              className={s.id === subject?.id ? 'orb active' : 'orb'}
              style={{ ['--c' as string]: s.colour }}
              title={s.name}
              aria-label={s.name}
              aria-pressed={s.id === subject?.id}
              onClick={() => onPick(s.id)}
            >
              {s.name.slice(0, 2)}
            </button>
          ))}
        </div>
        {subject ? (
          <>
            <span className="eyebrow tc-label">{subject.name} · average vs target</span>
            <div className="tc-gauge">
              <ArcGauge value={avg} target={subject.targetPct} label={`${subject.targetPct}%`} />
              <div className="tc-num num">{avg == null ? '–' : <><CountUp value={Math.round(avg)} />%</>}</div>
            </div>
            <div className="tc-verdict">
              {avg == null ? 'No scores yet' : avg >= subject.targetPct ? <>On track <span className="serif">for the target</span></> : <>{Math.round(subject.targetPct - avg)} points <span className="serif">to go</span></>}
            </div>
            <div className="tc-pill">
              <CalendarClock size={14} strokeWidth={SW} />
              {days == null ? 'No test date set' : days < 0 ? 'Test date has passed' : days === 0 ? 'Test is today' : `${days} ${days === 1 ? 'day' : 'days'} until the test`}
            </div>
          </>
        ) : (
          <Empty text="Add a subject to set a target." action={<Link className="btn sm" to="/subjects">Add subject</Link>} />
        )}
      </div>
    </Card>
  );
}

function GoalsCard({ data }: { data: AllData }) {
  const weekStart = weekStartKey();
  const prev = data.checkins.filter((c) => c.weekStart < weekStart).sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1))[0];
  const goals = prev?.goals.filter((g) => g.trim()) ?? [];
  return (
    <Card className="b-goals" index={6} tint="gold" tilt>
      <CardHead icon={<Target size={18} strokeWidth={SW} />} tone="gold" title="This week’s goals" />
      {goals.length ? (
        <ol className="goals">
          {goals.map((g, i) => (
            <li key={i} style={{ ['--i' as string]: i }}>
              <span className="g-num serif">{i + 1}</span>
              <span>{g}</span>
            </li>
          ))}
        </ol>
      ) : (
        <Empty text="Set three goals in your Sunday check-in." action={<Link className="btn sm" to="/checkin">Open check-in</Link>} />
      )}
    </Card>
  );
}

function HeatmapCard({ data }: { data: AllData }) {
  const mins = minutesByDay(data);
  const start = addDays(weekStartKey(), -7 * 38);
  const days = Array.from({ length: 39 * 7 }, (_, i) => addDays(start, i));
  const month = monthMinutes(data);
  const bestDay = Math.max(0, ...days.map((d) => mins.get(d) ?? 0));
  const months: { label: string; col: number }[] = [];
  days.forEach((d, i) => {
    if (i % 7 === 0) {
      const m = parseDay(d).toLocaleDateString(undefined, { month: 'short' });
      if (!months.length || months[months.length - 1].label !== m) months.push({ label: m, col: i / 7 });
    }
  });
  return (
    <Card className="b-heat" index={7} tint="meadow">
      <CardHead icon={<CalendarCheck size={18} strokeWidth={SW} />} tone="meadow" title="Study calendar" aside="Nine months" />
      <div className="heat-stats">
        <div>
          <span className="big-num sm">
            <CountUp value={studyStreak(data)} />
            <span className="u">days</span>
          </span>
          <span className="eyebrow">Streak</span>
        </div>
        <div>
          <span className="big-num sm">
            <CountUp value={Math.round((month / 60) * 10) / 10} decimals={1} />
            <span className="u">h</span>
          </span>
          <span className="eyebrow">This month</span>
        </div>
        <div>
          <span className="big-num sm">{fmtHours(bestDay)}</span>
          <span className="eyebrow">Best day</span>
        </div>
        <div className="heat-legend">
          <span className="eyebrow">Less</span>
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className={`heat l${l}`} />
          ))}
          <span className="eyebrow">More</span>
        </div>
      </div>
      <div className="heat-months" style={{ gridTemplateColumns: `repeat(39, minmax(0, 1fr))` }}>
        {months.map((m) => (
          <span key={m.label + m.col} style={{ gridColumn: `${m.col + 1} / span 3` }}>
            {m.label}
          </span>
        ))}
      </div>
      <Heatmap days={days} value={(d) => mins.get(d) ?? 0} title={(d) => `${fmtDay(d, { weekday: 'short', day: 'numeric', month: 'short' })}: ${fmtHours(mins.get(d) ?? 0)}`} />
    </Card>
  );
}

function UpNextCard({ data }: { data: AllData }) {
  const today = todayKey();
  const tests = activeSubjects(data)
    .filter((s) => s.nextTestDate && s.nextTestDate >= today)
    .sort((a, b) => (a.nextTestDate! < b.nextTestDate! ? -1 : 1));
  return (
    <Card className="b-next" index={8} tint="lagoon">
      <CardHead icon={<CalendarClock size={18} strokeWidth={SW} />} tone="lagoon" title="Coming up" />
      {tests.length === 0 ? (
        <Empty text="No test dates yet. Add them on each subject." action={<Link className="btn sm" to="/subjects">Subjects</Link>} />
      ) : (
        <ol className="timeline">
          {tests.map((s, i) => {
            const d = daysBetween(today, s.nextTestDate!);
            const avg = subjectAverage(data, s.id);
            return (
              <li key={s.id} style={{ ['--c' as string]: s.colour, ['--i' as string]: i }}>
                <Link to={`/subjects/${s.id}`}>
                  <span className="tl-dot" />
                  <span className="tl-main">
                    <strong>{s.name}</strong>
                    <span className="muted small">
                      {fmtDay(s.nextTestDate!, { weekday: 'short', day: 'numeric', month: 'short' })} · avg {avg == null ? '–' : `${Math.round(avg)}%`}
                    </span>
                  </span>
                  <span className={cx('tl-count', d <= 3 ? 'hot' : d <= 7 ? 'warm' : '')}>{d === 0 ? 'Today' : `${d}d`}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
