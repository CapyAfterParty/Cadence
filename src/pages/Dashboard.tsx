import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, CalendarCheck, CircleAlert, Flame, Layers, Play, Plus, Target, Timer, TrendingUp, Zap } from 'lucide-react';
import { useData, type AllData } from '../db/db';
import { addDays, daysBetween, fmtDay, fmtHours, fmtLongDate, greeting, isSunday, lastNDays, todayKey, weekStartKey, weekdayLetter } from '../lib/dates';
import {
  activeSubjects,
  cardsByDay,
  dueMistakes,
  flashStreak,
  isCheckinDone,
  loopScore,
  minutesByDay,
  monthMinutes,
  nextTest,
  pct,
  recentWeeks,
  studyStreak,
  subjectAverage,
  subjectPapers,
} from '../lib/stats';
import { openUI, settings } from '../lib/state';
import { Bars, Gauge, Heatmap, Line } from '../components/charts/charts';
import { Button, Card, CardHead, Chip, CountUp, Empty, Skeleton, Stat } from '../components/ui';
import { SearchBox } from '../features/Search';
import { RunningPill } from '../features/TimerController';
import { startStudy } from '../features/timerActions';
import { useScans } from '../components/Scans';

const SW = 1.5;

export default function Dashboard() {
  const data = useData();
  const s = settings.use();
  return (
    <div className="page">
      <Hero data={data} name={s.name} />
      {data ? <HomeGrid data={data} /> : <GridSkeleton />}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="home-grid">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} height={220} style={{ gridColumn: 'span 2' }} />
      ))}
      <Skeleton height={456} style={{ gridRow: 'span 2' }} />
      <Skeleton height={220} style={{ gridColumn: 'span 3' }} />
      <Skeleton height={220} style={{ gridColumn: 'span 3' }} />
    </div>
  );
}

function HeroBackground() {
  const photos = useScans('hero', 'hero');
  const photo = photos?.[0];
  const url = useMemo(() => (photo ? URL.createObjectURL(photo.blob) : null), [photo]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  return (
    <div className="hero-bg" aria-hidden="true">
      {url ? (
        <img src={url} alt="" />
      ) : (
        <>
          <span className="blob b1" />
          <span className="blob b2" />
          <span className="blob b3" />
        </>
      )}
    </div>
  );
}

function Hero({ data, name }: { data?: AllData; name: string }) {
  const initials = name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <section className="hero">
      <HeroBackground />
      <div className="hero-top">
        <RunningPill />
        <Button
          icon
          aria-label="Add mistake"
          onClick={() => openUI({ quickAdd: { preset: { subjectId: settings.get().lastSubjectId } } })}
        >
          <Plus size={18} strokeWidth={SW} />
        </Button>
        <Link to="/settings" className="btn icon white" aria-label="Settings" style={{ fontWeight: 600 }}>
          {initials || 'Me'}
        </Link>
      </div>
      <div className="hero-center">
        <h1>
          {greeting()}
          {name ? `, ${name.split(' ')[0]}` : ''}
        </h1>
        <p className="hero-date">{fmtLongDate()}</p>
        <SearchBox variant="hero" />
        {data && <TodayChips data={data} />}
      </div>
    </section>
  );
}

/** What to do now. Each chip opens its screen. */
function TodayChips({ data }: { data: AllData }) {
  const nav = useNavigate();
  const st = settings.use();
  const today = todayKey();
  const subjects = activeSubjects(data);
  if (!subjects.length)
    return (
      <div className="today-chips">
        <Chip onClick={() => nav('/subjects')}>
          <BookOpen size={14} strokeWidth={SW} /> Add your first subject
        </Chip>
      </div>
    );
  const cardsToday = cardsByDay(data).get(today) ?? 0;
  const due = dueMistakes(data, st.redoDays, today).length;
  const soon = subjects
    .filter((s) => s.nextTestDate && daysBetween(today, s.nextTestDate) >= 0 && daysBetween(today, s.nextTestDate) <= 7)
    .sort((a, b) => (a.nextTestDate! < b.nextTestDate! ? -1 : 1));
  const weekStart = weekStartKey(today);
  const timedDone = data.papers.some((p) => p.timed && p.date >= weekStart && p.date <= addDays(weekStart, 6));
  const last = subjects.find((s) => s.id === st.lastSubjectId) ?? subjects[0];

  return (
    <div className="today-chips">
      {cardsToday > 0 ? (
        <Chip className="done" onClick={() => openUI({ flashLog: true })}>
          <Layers size={14} strokeWidth={SW} /> {cardsToday} cards today
        </Chip>
      ) : (
        <Chip onClick={() => openUI({ flashLog: true })}>
          <span className="dot" style={{ background: 'var(--accent)' }} /> Flashcards not done
        </Chip>
      )}
      {due > 0 && (
        <Chip onClick={() => nav(`/redo?subject=${last.id}`)}>
          <CircleAlert size={14} strokeWidth={SW} /> {due} {due === 1 ? 'mistake' : 'mistakes'} due
        </Chip>
      )}
      {soon.map((s) => {
        const d = daysBetween(today, s.nextTestDate!);
        return (
          <Chip key={s.id} dot={s.colour} onClick={() => nav(`/subjects/${s.id}`)}>
            {s.name} test {d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`}
          </Chip>
        );
      })}
      {!timedDone && (
        <Chip onClick={() => nav('/timer?sprint=1')}>
          <Zap size={14} strokeWidth={SW} /> Timed paper this weekend
        </Chip>
      )}
      <Chip onClick={() => startStudy(last.id)}>
        <Play size={14} strokeWidth={SW} /> Start {last.name}
      </Chip>
    </div>
  );
}

function HomeGrid({ data }: { data: AllData }) {
  const st = settings.use();
  const today = todayKey();
  const weekStart = weekStartKey(today);
  const isSun = isSunday(today);
  const checkinDone = isCheckinDone(data.checkins.find((c) => c.weekStart === weekStart));

  return (
    <>
      {isSun && !checkinDone && (
        <div className="banner">
          <CalendarCheck size={20} strokeWidth={SW} color="var(--accent)" />
          <span>It is Sunday. Your weekly check-in is ready with this week’s stats.</span>
          <Link to="/checkin" className="btn primary sm">
            Open check-in
          </Link>
        </div>
      )}
      <div className="home-grid">
        <StudyCard data={data} index={0} />
        <FlashCard data={data} index={1} />
        <MistakesCard data={data} index={2} redoDays={st.redoDays} />
        <TargetCard data={data} index={3} />
        <LoopCard data={data} index={4} redoDays={st.redoDays} />
        <PaperCard data={data} index={5} />
      </div>
      <div className="grid-2" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)' }}>
        <HeatmapCard data={data} index={6} />
        <GoalsCard data={data} index={7} />
      </div>
    </>
  );
}

const week = () => lastNDays(7);

function StudyCard({ data, index }: { data: AllData; index: number }) {
  const mins = minutesByDay(data);
  const days = week();
  const weekStart = weekStartKey();
  const weekMinutes = data.sessions.filter((s) => s.date >= weekStart).reduce((a, s) => a + s.minutes, 0);
  return (
    <Card className="small home-card" index={index}>
      <CardHead icon={<Timer size={18} strokeWidth={SW} />} title={<Link to="/timer" style={{ textDecoration: 'none' }}>Study time</Link>} aside="Last 7 days" />
      <Bars values={days.map((d) => mins.get(d) ?? 0)} labels={days.map(weekdayLetter)} format={fmtHours} height={64} />
      <div className="push row-between">
        <Stat value={Math.round((weekMinutes / 60) * 10) / 10} decimals={1} unit="h" label="This week" />
      </div>
    </Card>
  );
}

function FlashCard({ data, index }: { data: AllData; index: number }) {
  const cards = cardsByDay(data);
  const days = week();
  const today = cards.get(todayKey()) ?? 0;
  const streakDays = flashStreak(data);
  return (
    <Card className="small home-card" index={index}>
      <CardHead
        icon={<Layers size={18} strokeWidth={SW} />}
        title="Flashcards"
        aside={
          <span className="row" style={{ gap: 4 }}>
            <Flame size={12} strokeWidth={SW} /> {streakDays}-day streak
          </span>
        }
      />
      <Line values={days.map((d) => cards.get(d) ?? 0)} labels={days.map(weekdayLetter)} min={0} height={64} />
      <div className="push row-between">
        <Stat value={today} unit="cards" label={today > 0 ? 'Done today' : 'Not done yet today'} />
        <Button size="sm" variant={today > 0 ? undefined : 'primary'} onClick={() => openUI({ flashLog: true })}>
          Log
        </Button>
      </div>
    </Card>
  );
}

function MistakesCard({ data, index, redoDays }: { data: AllData; index: number; redoDays: number }) {
  const nav = useNavigate();
  const days = week();
  const cleared = new Map<string, number>();
  for (const a of data.attempts) if (a.correct) cleared.set(a.date, (cleared.get(a.date) ?? 0) + 1);
  const due = dueMistakes(data, redoDays).length;
  return (
    <Card className="small home-card" index={index}>
      <CardHead icon={<CircleAlert size={18} strokeWidth={SW} />} title={<Link to="/mistakes" style={{ textDecoration: 'none' }}>Mistakes</Link>} aside="Cleared, 7 days" />
      <Bars values={days.map((d) => cleared.get(d) ?? 0)} labels={days.map(weekdayLetter)} height={64} />
      <div className="push row-between">
        <Stat value={due} unit="due" label="For redo" />
        <Button size="sm" disabled={!due} onClick={() => nav(`/redo?subject=${settings.get().lastSubjectId ?? ''}`)}>
          Redo
        </Button>
      </div>
    </Card>
  );
}

function LoopCard({ data, index, redoDays }: { data: AllData; index: number; redoDays: number }) {
  const weeks = recentWeeks(8);
  const scores = weeks.map((w) => loopScore(data, w, redoDays).score);
  const current = loopScore(data, weeks[weeks.length - 1], redoDays);
  const missing = current.parts.filter((p) => p.missing);
  return (
    <Card className="wide home-card loop-card" index={index} tabIndex={0} aria-label={`Loop score ${current.score} out of 100`}>
      <CardHead icon={<TrendingUp size={18} strokeWidth={SW} />} title="Loop score" aside="This week" />
      <div className="row" style={{ alignItems: 'flex-end', gap: 24, flexWrap: 'nowrap' }}>
        <div className="stat" style={{ flex: 'none' }}>
          <div className="stat-value accent">
            <CountUp value={current.score} />
            <span className="stat-unit">/100</span>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Line values={scores} min={0} max={100} height={72} />
        </div>
      </div>
      <div className="loop-parts push">
        {current.parts.map((p) => (
          <span key={p.label} className={p.value >= 1 ? 'part done' : 'part'}>
            <span className="tick" /> {p.label}
            {p.value > 0 && p.value < 1 && <span className="num"> · {Math.round(p.value * 100)}%</span>}
          </span>
        ))}
      </div>
      {missing.length > 0 && (
        <div className="loop-missing" role="tooltip">
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Still missing</div>
          {missing.map((p) => (
            <div key={p.label} className="muted">
              {p.missing}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function SubjectChips({ data, value, onChange }: { data: AllData; value: string; onChange: (id: string) => void }) {
  return (
    <div className="chip-row">
      {activeSubjects(data).map((s) => (
        <Chip key={s.id} dot={s.colour} active={s.id === value} onClick={() => onChange(s.id)} style={{ height: 28, fontSize: 12, padding: '0 10px' }}>
          {s.name}
        </Chip>
      ))}
    </div>
  );
}

function useSubjectChoice(data: AllData) {
  const subjects = activeSubjects(data);
  const [id, setId] = useState(settings.get().lastSubjectId ?? '');
  const chosen = subjects.find((s) => s.id === id) ?? subjects[0];
  return [chosen, setId] as const;
}

function PaperCard({ data, index }: { data: AllData; index: number }) {
  const [subject, setId] = useSubjectChoice(data);
  const weeks = recentWeeks(8);
  const papers = subject ? subjectPapers(data, subject.id) : [];
  const weekly = weeks.map((w) => {
    const ps = papers.filter((p) => p.date >= w && p.date <= addDays(w, 6));
    return ps.length ? ps.reduce((a, p) => a + pct(p), 0) / ps.length : null;
  });
  const avg = subject ? subjectAverage(data, subject.id) : null;
  return (
    <Card className="wide home-card" index={index}>
      <CardHead icon={<BookOpen size={18} strokeWidth={SW} />} title={<Link to={subject ? `/papers?subject=${subject.id}` : '/papers'} style={{ textDecoration: 'none' }}>Paper scores</Link>} aside="Last 8 weeks" />
      {papers.length === 0 ? (
        <Empty text="No papers logged yet." action={<Button size="sm" onClick={() => openUI({ logPaper: { preset: { subjectId: subject?.id } } })}>Log a paper</Button>} />
      ) : (
        <div className="row" style={{ alignItems: 'flex-end', gap: 24, flexWrap: 'nowrap' }}>
          <Stat value={avg == null ? null : Math.round(avg)} unit="%" label="Latest average" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Line values={weekly} min={0} max={100} target={subject?.targetPct} height={72} />
          </div>
        </div>
      )}
      <div className="push">
        <SubjectChips data={data} value={subject?.id ?? ''} onChange={setId} />
      </div>
    </Card>
  );
}

function TargetCard({ data, index }: { data: AllData; index: number }) {
  const [subject, setId] = useSubjectChoice(data);
  const today = todayKey();
  const avg = subject ? subjectAverage(data, subject.id) : null;
  const days = subject?.nextTestDate ? daysBetween(today, subject.nextTestDate) : null;
  const next = nextTest(data, today);
  return (
    <Card className="tall target-card" index={index}>
      <CardHead icon={<Target size={18} strokeWidth={SW} />} title="Target progress" />
      <SubjectChips data={data} value={subject?.id ?? ''} onChange={setId} />
      {subject ? (
        <>
          <div className="gauge-wrap">
            <Gauge value={avg} target={subject.targetPct} />
            <div className="gauge-center">
              <div className="stat-label">Average</div>
              <div className="stat-value">{avg == null ? '–' : <><CountUp value={Math.round(avg)} />%</>}</div>
              <div className="stat-label num">Target {subject.targetPct}%</div>
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: 'auto', position: 'relative' }}>
            <div style={{ fontSize: 'var(--fs-17)', fontWeight: 600 }}>
              {avg == null ? 'No scores yet' : avg >= subject.targetPct ? 'On track' : `${Math.round(subject.targetPct - avg)} points to go`}
            </div>
            <div className="muted small" style={{ marginTop: 4 }}>
              {days == null
                ? 'No test date set'
                : days < 0
                  ? 'Test date has passed'
                  : days === 0
                    ? `${subject.name} test is today`
                    : `${days} ${days === 1 ? 'day' : 'days'} until the ${subject.name} test`}
            </div>
            {next && next.id !== subject.id && (
              <div className="tiny muted" style={{ marginTop: 4 }}>
                Next test overall: {next.name}, {fmtDay(next.nextTestDate!)}
              </div>
            )}
          </div>
        </>
      ) : (
        <Empty text="Add a subject to set a target." action={<Link className="btn sm" to="/subjects">Add subject</Link>} />
      )}
    </Card>
  );
}

function HeatmapCard({ data, index }: { data: AllData; index: number }) {
  const mins = minutesByDay(data);
  const end = addDays(weekStartKey(), 6);
  const start = addDays(weekStartKey(), -7 * 38);
  const days = Array.from({ length: 39 * 7 }, (_, i) => addDays(start, i));
  const total = monthMinutes(data);
  return (
    <Card index={index}>
      <CardHead icon={<CalendarCheck size={18} strokeWidth={SW} />} title="Study calendar" aside={`${fmtDay(start)} – ${fmtDay(end)}`} />
      <div className="row" style={{ gap: 32, alignItems: 'flex-end', marginBottom: 16 }}>
        <Stat size="md" value={studyStreak(data)} unit="days" label="Study streak" />
        <Stat size="md" value={Math.round((total / 60) * 10) / 10} decimals={1} unit="h" label="This month" />
      </div>
      <Heatmap days={days} value={(d) => mins.get(d) ?? 0} title={(d) => `${fmtDay(d, { weekday: 'short', day: 'numeric', month: 'short' })}: ${fmtHours(mins.get(d) ?? 0)}`} />
    </Card>
  );
}

function GoalsCard({ data, index }: { data: AllData; index: number }) {
  const weekStart = weekStartKey();
  const prev = data.checkins.filter((c) => c.weekStart < weekStart).sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1))[0];
  const goals = prev?.goals.filter((g) => g.trim()) ?? [];
  return (
    <Card index={index} className="home-card">
      <CardHead icon={<Target size={18} strokeWidth={SW} />} title="This week’s goals" />
      {goals.length ? (
        <ol className="stack" style={{ margin: 0, paddingLeft: 20, gap: 10 }}>
          {goals.map((g, i) => (
            <li key={i}>{g}</li>
          ))}
        </ol>
      ) : (
        <Empty text="Set three goals in your Sunday check-in." action={<Link className="btn sm" to="/checkin">Open check-in</Link>} />
      )}
    </Card>
  );
}
