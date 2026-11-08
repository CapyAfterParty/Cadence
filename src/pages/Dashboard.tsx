import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  CircleAlert,
  FileText,
  Flame,
  Layers,
  Play,
  Plus,
  Search,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useData, type AllData } from '../db/db';
import type { Subject } from '../db/types';
import { addDays, daysBetween, fmtDay, fmtHours, greeting, inWeek, isSunday, lastNDays, todayKey, weekStartKey, weekdayLetter } from '../lib/dates';
import {
  activeSubjects,
  cardsByDay,
  dueMistakes,
  flashStreak,
  isCheckinDone,
  loopScore,
  minutesByDay,
  monthMinutes,
  pct,
  studyStreak,
  subjectAverage,
  subjectPapers,
} from '../lib/stats';
import { openUI, settings } from '../lib/state';
import { Heatmap } from '../components/charts/charts';
import { ArcGauge, Barcode, Capsules, DualLine, PillMatrix, Scene, Waves } from '../components/charts/fancy';
import { Card, CardHead, Chip, CountUp, Empty, Skeleton } from '../components/ui';
import { SearchBox } from '../features/Search';
import { RunningPill } from '../features/TimerController';
import { startStudy } from '../features/timerActions';

const SW = 1.6;

export default function Dashboard() {
  const data = useData();
  const s = settings.use();
  return (
    <div className="page">
      <HomeTop name={s.name} />
      <Hero data={data} name={s.name} />
      {data ? <HomeBody data={data} /> : <GridSkeleton />}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="home-grid">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} height={250} style={{ gridColumn: 'span 2' }} />
      ))}
      <Skeleton height={516} style={{ gridRow: 'span 2' }} />
      <Skeleton height={250} style={{ gridColumn: 'span 3' }} />
      <Skeleton height={250} style={{ gridColumn: 'span 3' }} />
    </div>
  );
}

/* ---------- Top: brand, quick add, profile ---------- */

function HomeTop({ name }: { name: string }) {
  const initials = name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <header className="home-top">
      <div className="brand">
        <strong>Cadence</strong>
        <span>Study system</span>
      </div>
      <RunningPill />
      <button type="button" className="orb" aria-label="Add mistake (N)" onClick={() => openUI({ quickAdd: { preset: { subjectId: settings.get().lastSubjectId } } })}>
        <Plus size={18} strokeWidth={SW} />
      </button>
      <Link to="/settings" className="profile" aria-label="Settings">
        <span className="avatar">{initials || 'Me'}</span>
        <span className="who">
          <strong>{name || 'Set your name'}</strong>
          <span>Student</span>
        </span>
      </Link>
    </header>
  );
}

/* ---------- Hero: greeting, the big search, today chips ---------- */

function Hero({ data, name }: { data?: AllData; name: string }) {
  return (
    <section className="hero">
      <div className="hero-hello">
        {greeting()}
        {name ? `, ${name.split(' ')[0]}` : ''}
        <span className="hello-badge">
          <Sparkles size={16} strokeWidth={1.8} color="#fff" />
        </span>
      </div>
      <SearchBox variant="hero" />
      {data && <TodayChips data={data} />}
    </section>
  );
}

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
  const timedDone = data.papers.some((p) => p.timed && inWeek(p.date, weekStart));
  const last = subjects.find((s) => s.id === st.lastSubjectId) ?? subjects[0];
  let i = 0;
  const idx = () => ({ ['--i' as string]: i++ });

  return (
    <div className="today-chips">
      {cardsToday > 0 ? (
        <Chip className="done" style={idx()} onClick={() => openUI({ flashLog: true })}>
          <Layers size={14} strokeWidth={SW} /> {cardsToday} cards today
        </Chip>
      ) : (
        <Chip style={idx()} onClick={() => openUI({ flashLog: true })}>
          <span className="dot" style={{ background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' }} /> Flashcards not done
        </Chip>
      )}
      {due > 0 && (
        <Chip style={idx()} onClick={() => nav(`/redo?subject=${last.id}`)}>
          <CircleAlert size={14} strokeWidth={SW} /> {due} {due === 1 ? 'mistake' : 'mistakes'} due
        </Chip>
      )}
      {soon.map((s) => {
        const d = daysBetween(today, s.nextTestDate!);
        return (
          <Chip key={s.id} style={idx()} dot={s.colour} onClick={() => nav(`/subjects/${s.id}`)}>
            {s.name} test {d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`}
          </Chip>
        );
      })}
      {!timedDone && (
        <Chip style={idx()} onClick={() => nav('/timer?sprint=1')}>
          <Zap size={14} strokeWidth={SW} /> Timed paper this weekend
        </Chip>
      )}
    </div>
  );
}

/* ---------- Body ---------- */

function HomeBody({ data }: { data: AllData }) {
  const st = settings.use();
  const nav = useNavigate();
  const subjects = activeSubjects(data);
  const [chosenId, setChosenId] = useState(st.lastSubjectId ?? '');
  const subject = subjects.find((s) => s.id === chosenId) ?? subjects[0];
  const today = todayKey();
  const weekStart = weekStartKey(today);
  const checkinDone = isCheckinDone(data.checkins.find((c) => c.weekStart === weekStart));
  const last = subjects.find((s) => s.id === st.lastSubjectId) ?? subjects[0];

  return (
    <>
      {isSunday(today) && !checkinDone && (
        <div className="banner">
          <CalendarCheck size={20} strokeWidth={SW} color="var(--accent)" />
          <span>It is Sunday. Your weekly check-in is ready with this week’s stats.</span>
          <Link to="/checkin" className="btn primary sm">
            Open check-in
          </Link>
        </div>
      )}
      <div className="toolbar">
        <button type="button" className="orb" aria-label="Search (Ctrl K)" onClick={() => openUI({ palette: true })}>
          <Search size={17} strokeWidth={SW} />
        </button>
        <button type="button" className="orb" aria-label="Log flashcards" onClick={() => openUI({ flashLog: true })}>
          <Layers size={17} strokeWidth={SW} />
        </button>
        <Link to="/checkin" className="glass-pill">
          <CalendarDays size={15} strokeWidth={SW} /> {fmtDay(weekStart)} – {fmtDay(addDays(weekStart, 6), { day: 'numeric', month: 'short', year: 'numeric' })}
        </Link>
        <button type="button" className="glass-pill" onClick={() => openUI({ logPaper: { preset: { subjectId: subject?.id } } })}>
          <FileText size={15} strokeWidth={SW} /> Log paper
        </button>
        {last && (
          <button type="button" className="glass-pill" onClick={() => startStudy(last.id)}>
            <Play size={15} strokeWidth={SW} /> Start {last.name}
          </button>
        )}
        <button type="button" className="glass-pill" onClick={() => nav('/checkin')}>
          Weekly check-in
        </button>
      </div>
      <div className="home-grid">
        <StudyCard data={data} index={0} />
        <FlashCard data={data} index={1} />
        <MistakesCard data={data} index={2} redoDays={st.redoDays} />
        <TargetCard data={data} index={3} subject={subject} onPick={setChosenId} />
        <LoopCard data={data} index={4} redoDays={st.redoDays} />
        <PaperCard data={data} index={5} subject={subject} />
      </div>
      <div className="grid-2" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)' }}>
        <HeatmapCard data={data} index={6} />
        <GoalsCard data={data} index={7} />
      </div>
    </>
  );
}

const week = () => lastNDays(7);

function Duration({ minutes }: { minutes: number }) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return (
    <div className="big">
      <CountUp value={h} />
      <span className="u">h</span>
      <CountUp value={m} />
      <span className="u">m</span>
    </div>
  );
}

function StudyCard({ data, index }: { data: AllData; index: number }) {
  const days = week();
  const totals = new Map<string, number>();
  for (const s of data.sessions) if (days.includes(s.date)) totals.set(s.subjectId, (totals.get(s.subjectId) ?? 0) + s.minutes);
  const top = activeSubjects(data)
    .sort((a, b) => (totals.get(b.id) ?? 0) - (totals.get(a.id) ?? 0))
    .slice(0, 3);
  const rows = top.map((s) => ({
    label: s.name,
    values: days.map((d) => data.sessions.filter((x) => x.subjectId === s.id && x.date === d).reduce((a, x) => a + x.minutes, 0)),
  }));
  const weekStart = weekStartKey();
  const weekMinutes = data.sessions.filter((s) => s.date >= weekStart).reduce((a, s) => a + s.minutes, 0);
  return (
    <Card className="small home-card" index={index}>
      <CardHead icon={<Timer size={18} strokeWidth={1.8} />} title={<Link to="/timer" style={{ textDecoration: 'none' }}>Study</Link>} aside="Last 7 days" />
      {rows.length ? <PillMatrix rows={rows} columns={days.map(weekdayLetter)} /> : <Empty text="Add a subject to start." />}
      <div className="push">
        <Duration minutes={weekMinutes} />
        <div className="foot-note">
          <Flame size={13} strokeWidth={2} /> {studyStreak(data)}-day streak · this week
        </div>
      </div>
    </Card>
  );
}

function FlashCard({ data, index }: { data: AllData; index: number }) {
  const cards = cardsByDay(data);
  const days = week();
  const today = cards.get(todayKey()) ?? 0;
  return (
    <Card className="small home-card" index={index}>
      <CardHead
        icon={<Layers size={18} strokeWidth={1.8} />}
        title="Flashcards"
        aside={
          <span className="legend">
            <span>
              <i style={{ background: '#ffd66b' }} />
              This week
            </span>
            <span>
              <i style={{ background: 'rgba(255,255,255,0.6)' }} />
              Last
            </span>
          </span>
        }
      />
      <DualLine
        labels={days.map(weekdayLetter)}
        series={[
          { values: days.map((d) => cards.get(d) ?? 0), colour: '#ffd66b' },
          { values: days.map((d) => cards.get(addDays(d, -7)) ?? 0), colour: 'rgba(255,255,255,0.75)', faint: true },
        ]}
      />
      <div className="push" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div className="big">
            <CountUp value={today} />
            <span className="u">cards</span>
          </div>
          <div className="foot-note">
            <Flame size={13} strokeWidth={2} /> {flashStreak(data)}-day streak
          </div>
        </div>
        <button type="button" className={today ? 'orb' : 'orb accent'} aria-label="Log flashcards" onClick={() => openUI({ flashLog: true })}>
          <Plus size={18} strokeWidth={2} />
        </button>
      </div>
    </Card>
  );
}

function MistakesCard({ data, index, redoDays }: { data: AllData; index: number; redoDays: number }) {
  const nav = useNavigate();
  const days = week();
  const cleared = new Map<string, number>();
  for (const a of data.attempts) if (a.correct) cleared.set(a.date, (cleared.get(a.date) ?? 0) + 1);
  const logged = new Map<string, number>();
  for (const m of data.mistakes) logged.set(m.date, (logged.get(m.date) ?? 0) + 1);
  const due = dueMistakes(data, redoDays).length;
  const clearedWeek = days.reduce((a, d) => a + (cleared.get(d) ?? 0), 0);
  return (
    <Card className="small home-card" index={index}>
      <CardHead
        icon={<CircleAlert size={18} strokeWidth={1.8} />}
        title={<Link to="/mistakes" style={{ textDecoration: 'none' }}>Mistakes</Link>}
        aside={
          <span className="legend">
            <span>
              <i style={{ background: '#f5b02e' }} />
              Cleared
            </span>
            <span>
              <i style={{ background: '#ff6a2b' }} />
              Logged
            </span>
          </span>
        }
      />
      <Capsules items={days.map((d) => ({ a: cleared.get(d) ?? 0, b: logged.get(d) ?? 0 }))} labels={days.map(weekdayLetter)} />
      <div className="push" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div className="big">
            <CountUp value={due} />
            <span className="u">due</span>
          </div>
          <div className="foot-note">
            <TrendingUp size={13} strokeWidth={2} /> {clearedWeek} cleared in 7 days
          </div>
        </div>
        <button type="button" className="orb" aria-label="Start redo" disabled={!due} onClick={() => nav(`/redo?subject=${settings.get().lastSubjectId ?? ''}`)}>
          <ArrowUpRight size={18} strokeWidth={1.8} />
        </button>
      </div>
    </Card>
  );
}

const loopWords = (s: number) =>
  s >= 100 ? 'Loop complete' : s >= 75 ? 'Nearly there' : s >= 50 ? 'Halfway there' : s >= 25 ? 'Building momentum' : 'Just getting started';

function LoopCard({ data, index, redoDays }: { data: AllData; index: number; redoDays: number }) {
  const weekStart = weekStartKey();
  const current = loopScore(data, weekStart, redoDays);
  const prev = loopScore(data, addDays(weekStart, -7), redoDays).score;
  const missing = current.parts.filter((p) => p.missing);
  const k = 0.35 + current.score / 160;
  const delta = current.score - prev;
  const [flash, , redo] = current.parts;
  return (
    <Card className="wide home-card score-card" index={index}>
      <CardHead icon={<TrendingUp size={18} strokeWidth={1.8} />} tone="dark" title="Loop score" />
      <div className="center">
        <div className="score-num">
          <CountUp value={current.score} />
        </div>
        <div className="score-title">{loopWords(current.score)}</div>
        <div className="score-sub">
          {delta === 0 ? 'Same as last week' : `${delta > 0 ? '+' : ''}${delta} vs last week`}
        </div>
      </div>
      <Waves
        height={64}
        lines={[
          { amp: 20 * k, cycles: 2, colour: '#ff6a2b', speed: 14, width: 2 },
          { amp: 16 * k, cycles: 1, colour: '#ff8fa3', speed: 19, phase: 1.4, width: 1.6, opacity: 0.85 },
          { amp: 22 * k, cycles: 2, colour: '#ffffff', speed: 24, phase: 2.6, width: 1.2, opacity: 0.6 },
          { amp: 12 * k, cycles: 3, colour: '#ffd66b', speed: 17, phase: 4.1, width: 1.2, opacity: 0.6 },
        ]}
      />
      <div className="score-foot">
        <div>
          <div className="k">Flashcards</div>
          <div className="v">{Math.round(flash.value * 7)}/7 days</div>
        </div>
        <div className="mid" tabIndex={0}>
          <span className="orb sm">
            <Sparkles size={15} strokeWidth={1.8} />
          </span>
          {missing.length ? 'What’s missing' : 'All done'}
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
        </div>
        <div className="right">
          <div className="k">Mistakes redone</div>
          <div className="v">{Math.round(redo.value * 100)}%</div>
        </div>
      </div>
    </Card>
  );
}

function PaperCard({ data, index, subject }: { data: AllData; index: number; subject?: Subject }) {
  const papers = subject ? subjectPapers(data, subject.id) : [];
  const avg = subject ? subjectAverage(data, subject.id) : null;
  const best = papers.length ? Math.max(...papers.map(pct)) : null;
  const today = todayKey();
  const byDay = new Map<string, number>();
  for (const p of papers) byDay.set(p.date, Math.max(byDay.get(p.date) ?? 0, pct(p)));
  const lastDate = papers[papers.length - 1]?.date;
  return (
    <Card className="wide home-card score-card" index={index}>
      <CardHead
        icon={<FileText size={18} strokeWidth={1.8} />}
        tone="dark"
        title={<Link to={subject ? `/papers?subject=${subject.id}` : '/papers'} style={{ textDecoration: 'none' }}>Paper scores</Link>}
      />
      {papers.length === 0 ? (
        <Empty text="No papers logged yet." action={<button type="button" className="glass-pill" onClick={() => openUI({ logPaper: { preset: { subjectId: subject?.id } } })}>Log a paper</button>} />
      ) : (
        <>
          <div className="center">
            <div className="score-num">
              <CountUp value={Math.round(avg ?? 0)} />%
            </div>
            <div className="score-title">Average score</div>
            <div className="score-sub">
              {subject?.name} · target {subject?.targetPct}%
            </div>
          </div>
          <Barcode
            height={64}
            build={(count) => {
              // Put the latest paper about two thirds across, like a playhead.
              const end = lastDate ? addDays(lastDate, Math.floor(count * 0.33)) : today;
              const days = lastNDays(count, end);
              return { values: days.map((d) => byDay.get(d) ?? null), highlight: lastDate ? days.indexOf(lastDate) : -1 };
            }}
          />
          <div className="score-foot">
            <div>
              <div className="k">Best</div>
              <div className="v">{best == null ? '–' : `${Math.round(best)}%`}</div>
            </div>
            <Link to={subject ? `/papers?subject=${subject.id}` : '/papers'} className="mid" style={{ textDecoration: 'none' }}>
              <span className="orb sm">
                <ArrowUpRight size={15} strokeWidth={1.8} />
              </span>
              All papers
            </Link>
            <div className="right">
              <div className="k">Papers logged</div>
              <div className="v">{papers.length}</div>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

function TargetCard({ data, index, subject, onPick }: { data: AllData; index: number; subject?: Subject; onPick: (id: string) => void }) {
  const today = todayKey();
  const avg = subject ? subjectAverage(data, subject.id) : null;
  const days = subject?.nextTestDate ? daysBetween(today, subject.nextTestDate) : null;
  return (
    <Card className="tall target-card" index={index}>
      <Scene />
      <div className="content">
        <div className="orbs">
          {activeSubjects(data).map((s) => (
            <button
              key={s.id}
              type="button"
              className={s.id === subject?.id ? 'orb active' : 'orb'}
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
            <div className="sub" style={{ marginTop: 6 }}>
              <Target size={12} strokeWidth={2} style={{ verticalAlign: '-1px', marginRight: 4 }} />
              {subject.name} · average vs target
            </div>
            <div className="gauge-wrap">
              <ArcGauge value={avg} target={subject.targetPct} label={`${subject.targetPct}%`} />
              <div className="gauge-num">{avg == null ? '–' : <><CountUp value={Math.round(avg)} />%</>}</div>
            </div>
            <div style={{ width: '100%' }}>
              <Waves
                height={40}
                lines={[
                  { amp: 9, cycles: 2, colour: '#ff6a2b', speed: 12, width: 1.6 },
                  { amp: 7, cycles: 1, colour: '#ffffff', speed: 18, phase: 2, width: 1.1, opacity: 0.7 },
                ]}
              />
            </div>
            <div className="verdict">
              {avg == null ? 'No scores yet' : avg >= subject.targetPct ? 'On track for the target' : `${Math.round(subject.targetPct - avg)} points to the target`}
            </div>
            <div className="sub">
              {days == null
                ? 'No test date set'
                : days < 0
                  ? 'Test date has passed'
                  : days === 0
                    ? `${subject.name} test is today`
                    : `${days} ${days === 1 ? 'day' : 'days'} until the ${subject.name} test`}
            </div>
          </>
        ) : (
          <Empty text="Add a subject to set a target." action={<Link className="glass-pill" to="/subjects">Add subject</Link>} />
        )}
      </div>
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
    <Card index={index} className="home-card">
      <CardHead icon={<CalendarCheck size={18} strokeWidth={1.8} />} tone="dark" title="Study calendar" aside={`${fmtDay(start)} – ${fmtDay(end)}`} />
      <div className="row" style={{ gap: 40, alignItems: 'flex-end' }}>
        <div>
          <div className="big">
            <CountUp value={studyStreak(data)} />
            <span className="u">days</span>
          </div>
          <div className="foot-note">Study streak</div>
        </div>
        <div>
          <div className="big">
            <CountUp value={Math.round((total / 60) * 10) / 10} decimals={1} />
            <span className="u">h</span>
          </div>
          <div className="foot-note">This month</div>
        </div>
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
      <CardHead icon={<Target size={18} strokeWidth={1.8} />} accent title="This week’s goals" />
      {goals.length ? (
        <div className="stack" style={{ gap: 12 }}>
          {goals.map((g, i) => (
            <div key={i} className="row" style={{ flexWrap: 'nowrap', gap: 12, alignItems: 'flex-start' }}>
              <span className="orb sm" style={{ width: 26, height: 26 }}>
                {i + 1}
              </span>
              <span style={{ paddingTop: 2 }}>{g}</span>
            </div>
          ))}
        </div>
      ) : (
        <Empty text="Set three goals in your Sunday check-in." action={<Link className="glass-pill" to="/checkin">Open check-in</Link>} />
      )}
    </Card>
  );
}
