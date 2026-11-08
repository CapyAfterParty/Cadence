import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { useData, type AllData } from '../db/db';
import type { Subject } from '../db/types';
import { addDays, daysBetween, fmtDay, fmtHours, greeting, inWeek, isSunday, lastNDays, parseDay, todayKey, weekStartKey, weekdayLetter } from '../lib/dates';
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
  recentWeeks,
  studyStreak,
  subjectAverage,
  subjectPapers,
} from '../lib/stats';
import { openUI, settings } from '../lib/state';
import { Heatmap } from '../components/charts/charts';
import { Arc, Bars, LoopRing, MultiLine, Spark } from '../components/charts/fancy';
import { Card, CardHead, CountUp, Empty, Skeleton, cx } from '../components/ui';
import { SearchTrigger } from '../features/Search';
import { RunningPill } from '../features/TimerController';

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
    <div className="zen-grid">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} height="18rem" />
      ))}
    </div>
  );
}

/* ---------- Header: the date, a greeting, one line on what matters ---------- */

function brief(data: AllData, redoDays: number) {
  const today = todayKey();
  const due = dueMistakes(data, redoDays, today).length;
  const cards = cardsByDay(data).get(today) ?? 0;
  const soon = activeSubjects(data)
    .filter((s) => s.nextTestDate && daysBetween(today, s.nextTestDate) >= 0)
    .sort((a, b) => (a.nextTestDate! < b.nextTestDate! ? -1 : 1))[0];
  const bits: string[] = [];
  if (!cards) bits.push('flashcards are still to do');
  if (due) bits.push(`${due} ${due === 1 ? 'mistake waits' : 'mistakes wait'} for a redo`);
  if (soon) {
    const d = daysBetween(today, soon.nextTestDate!);
    bits.push(`${soon.name} is ${d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`}`);
  }
  if (!bits.length) return 'Nothing pressing today.';
  const s = bits.length === 1 ? bits[0] : `${bits.slice(0, -1).join(', ')}, and ${bits[bits.length - 1]}`;
  return s[0].toUpperCase() + s.slice(1) + '.';
}

function Header({ data, name }: { data?: AllData; name: string }) {
  const st = settings.use();
  const today = todayKey();
  const first = name.split(' ')[0];
  return (
    <header className="home-head">
      <div className="hh-left">
        <span className="eyebrow">{parseDay(today).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        <h1 className="hh-title">
          {greeting()}
          {first ? (
            <>
              , <span className="serif">{first}</span>.
            </>
          ) : (
            '.'
          )}
        </h1>
        <p className="hh-brief">{data ? brief(data, st.redoDays) : ' '}</p>
      </div>
      <div className="hh-right">
        <RunningPill />
        <SearchTrigger />
      </div>
      {data && <Today data={data} />}
    </header>
  );
}

/** What to do now, as a quiet line of actions. */
function Today({ data }: { data: AllData }) {
  const nav = useNavigate();
  const st = settings.use();
  const today = todayKey();
  const subjects = activeSubjects(data);
  if (!subjects.length)
    return (
      <nav className="today">
        <button type="button" onClick={() => nav('/subjects')}>
          <i /> Add your first subject
        </button>
      </nav>
    );
  const cardsToday = cardsByDay(data).get(today) ?? 0;
  const due = dueMistakes(data, st.redoDays, today).length;
  const timedDone = data.papers.some((p) => p.timed && inWeek(p.date, weekStartKey(today)));
  const last = subjects.find((s) => s.id === st.lastSubjectId) ?? subjects[0];
  const items = [
    { done: cardsToday > 0, label: cardsToday > 0 ? `${cardsToday} cards today` : 'Flashcards', run: () => openUI({ flashLog: true }) },
    { done: due === 0, label: due ? `Redo ${due} ${due === 1 ? 'mistake' : 'mistakes'}` : 'Redo queue clear', run: () => nav(`/redo?subject=${last.id}`) },
    { done: timedDone, label: timedDone ? 'Timed paper done' : 'Timed paper this weekend', run: () => nav(timedDone ? '/papers' : '/timer?sprint=1') },
  ];
  return (
    <nav className="today" aria-label="Today">
      {items.map((it) => (
        <button key={it.label} type="button" className={it.done ? 'done' : undefined} onClick={it.run}>
          {it.done ? <Check size={13} strokeWidth={2} /> : <i />}
          {it.label}
        </button>
      ))}
    </nav>
  );
}

/* ---------- Body ---------- */

function Body({ data }: { data: AllData }) {
  const st = settings.use();
  const subjects = activeSubjects(data);
  const [chosenId, setChosenId] = useState(st.lastSubjectId ?? '');
  const subject = subjects.find((s) => s.id === chosenId) ?? subjects[0];
  const today = todayKey();
  const checkinDone = isCheckinDone(data.checkins.find((c) => c.weekStart === weekStartKey(today)));

  return (
    <>
      {isSunday(today) && !checkinDone && (
        <div className="banner">
          <span>
            <strong>It’s Sunday.</strong> Your weekly check-in is ready, with the week already filled in.
          </span>
          <Link to="/checkin" className="btn sm">
            Open check-in <ArrowRight size={13} strokeWidth={1.8} />
          </Link>
        </div>
      )}
      <div className="zen-grid">
        <LoopCard data={data} redoDays={st.redoDays} />
        <StudyCard data={data} />
        <FlashCard data={data} />
        <MistakesCard data={data} redoDays={st.redoDays} />
        <PapersCard data={data} subject={subject} onPick={setChosenId} />
        <TargetCard data={data} subject={subject} onPick={setChosenId} />
        <CalendarCard data={data} />
        <AheadCard data={data} />
      </div>
    </>
  );
}

function Big({ children, unit }: { children: React.ReactNode; unit?: string }) {
  return (
    <div className="big">
      {children}
      {unit && <span className="u">{unit}</span>}
    </div>
  );
}

function LoopCard({ data, redoDays }: { data: AllData; redoDays: number }) {
  const weekStart = weekStartKey();
  const today = todayKey();
  const current = loopScore(data, weekStart, redoDays);
  const [flash, paper, redo, check] = current.parts;
  const rows = [
    { label: 'Flashcards', value: flash.value, status: `${Math.round(flash.value * 7)}/7 days` },
    { label: 'Timed paper', value: paper.value, status: paper.value >= 1 ? 'Done' : 'Not yet' },
    { label: 'Mistakes redone', value: redo.value, status: `${Math.round(redo.value * 100)}%` },
    { label: 'Check-in', value: check.value, status: check.value >= 1 ? 'Done' : isSunday(today) ? 'Today' : 'Sunday' },
  ];
  return (
    <Card className="z-card loop" index={0}>
      <CardHead title="This week" aside={`Day ${Math.min(7, daysBetween(weekStart, today) + 1)} of 7`} />
      <div className="loop-wrap">
        <LoopRing parts={current.parts}>
          <span className="loop-score num">
            <CountUp value={current.score} />
          </span>
          <span className="loop-caption">of the loop</span>
        </LoopRing>
      </div>
      <ul className="quiet-list">
        {rows.map((r) => (
          <li key={r.label}>
            <span className={cx('q-mark', r.value >= 1 && 'on')}>{r.value >= 1 && <Check size={10} strokeWidth={2.4} />}</span>
            <span className="q-label">{r.label}</span>
            <span className="q-value num">{r.status}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function StudyCard({ data }: { data: AllData }) {
  const days = lastNDays(7);
  const mins = minutesByDay(data);
  const weekStart = weekStartKey();
  const week = data.sessions.filter((s) => s.date >= weekStart).reduce((a, s) => a + s.minutes, 0);
  const h = Math.floor(week / 60);
  const m = Math.round(week % 60);
  return (
    <Card className="z-card" index={1}>
      <CardHead title={<Link to="/timer">Study</Link>} aside="This week" />
      <Big>
        <CountUp value={h} />
        <span className="u">h</span> <CountUp value={m} />
        <span className="u">m</span>
      </Big>
      <p className="caption">{studyStreak(data)}-day streak</p>
      <div className="chart">
        <Bars values={days.map((d) => mins.get(d) ?? 0)} labels={days.map(weekdayLetter)} format={fmtHours} />
      </div>
    </Card>
  );
}

function FlashCard({ data }: { data: AllData }) {
  const cards = cardsByDay(data);
  const days = lastNDays(7);
  const today = cards.get(todayKey()) ?? 0;
  return (
    <Card className="z-card" index={2}>
      <CardHead
        title="Flashcards"
        aside={
          <button type="button" className="text-btn" onClick={() => openUI({ flashLog: true })}>
            Log
          </button>
        }
      />
      <Big unit="today">
        <CountUp value={today} />
      </Big>
      <p className="caption">{flashStreak(data)}-day streak · dashed line is last week</p>
      <div className="chart">
        <Spark values={days.map((d) => cards.get(d) ?? 0)} compare={days.map((d) => cards.get(addDays(d, -7)) ?? 0)} labels={days.map(weekdayLetter)} />
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
  const open = data.mistakes.filter((m) => !m.cleared).length;
  return (
    <Card className="z-card" index={3}>
      <CardHead title={<Link to="/mistakes">Mistakes</Link>} aside={`${open} open`} />
      <Big unit="due">
        <CountUp value={due} />
      </Big>
      <p className="caption">Not redone in {redoDays} days</p>
      <ul className="quiet-list push">
        <li>
          <span className="q-label">Redone, 7 days</span>
          <span className="q-value num">{redone}</span>
        </li>
        <li>
          <span className="q-label">Cleared, 7 days</span>
          <span className="q-value num">{cleared}</span>
        </li>
        <li>
          <span className="q-label">Logged, 7 days</span>
          <span className="q-value num">{logged}</span>
        </li>
      </ul>
      <button type="button" className="text-btn go" disabled={!due} onClick={() => nav(`/redo?subject=${settings.get().lastSubjectId ?? ''}`)}>
        Start a redo <ArrowRight size={13} strokeWidth={1.8} />
      </button>
    </Card>
  );
}

function SubjectTabs({ data, value, onPick }: { data: AllData; value?: string; onPick: (id: string) => void }) {
  return (
    <div className="tabs">
      {activeSubjects(data).map((s) => (
        <button key={s.id} type="button" className={s.id === value ? 'on' : undefined} onClick={() => onPick(s.id)}>
          {s.name}
        </button>
      ))}
    </div>
  );
}

function PapersCard({ data, subject, onPick }: { data: AllData; subject?: Subject; onPick: (id: string) => void }) {
  const weeks = recentWeeks(10);
  const series = activeSubjects(data).map((s) => ({
    id: s.id,
    colour: s.colour,
    values: weeks.map((w) => {
      const ps = data.papers.filter((p) => p.subjectId === s.id && inWeek(p.date, w));
      return ps.length ? ps.reduce((a, p) => a + pct(p), 0) / ps.length : null;
    }),
  }));
  const avg = subject ? subjectAverage(data, subject.id) : null;
  const papers = subject ? subjectPapers(data, subject.id) : [];
  return (
    <Card className="z-card" index={4}>
      <CardHead title={<Link to={subject ? `/papers?subject=${subject.id}` : '/papers'}>Papers</Link>} aside="10 weeks" />
      {!data.papers.length ? (
        <Empty text="Log a paper to see the trend." action={<button type="button" className="btn sm" onClick={() => openUI({ logPaper: { preset: { subjectId: subject?.id } } })}>Log a paper</button>} />
      ) : (
        <>
          <Big unit="%">{avg == null ? '–' : <CountUp value={Math.round(avg)} />}</Big>
          <p className="caption">
            {subject?.name}, last three · {papers.length} logged
          </p>
          <div className="chart">
            <MultiLine series={series} labels={weeks.map((w) => fmtDay(w, { day: 'numeric', month: 'short' }))} target={subject?.targetPct} focus={subject?.id} />
          </div>
          <SubjectTabs data={data} value={subject?.id} onPick={onPick} />
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
    <Card className="z-card" index={5}>
      <CardHead title="Target" aside={subject?.name} />
      {subject ? (
        <>
          <div className="arc-wrap">
            <Arc value={avg} target={subject.targetPct} />
            <div className="arc-num num">{avg == null ? '–' : <CountUp value={Math.round(avg)} />}</div>
          </div>
          <p className="caption center">
            {avg == null ? 'No scores yet' : avg >= subject.targetPct ? `At or above the ${subject.targetPct}% target` : `${Math.round(subject.targetPct - avg)} points below ${subject.targetPct}%`}
          </p>
          <p className="caption center faint">
            {days == null ? 'No test date set' : days < 0 ? 'Test date has passed' : days === 0 ? 'Test is today' : `Test in ${days} ${days === 1 ? 'day' : 'days'}`}
          </p>
          <SubjectTabs data={data} value={subject.id} onPick={onPick} />
        </>
      ) : (
        <Empty text="Add a subject to set a target." action={<Link className="btn sm" to="/subjects">Add subject</Link>} />
      )}
    </Card>
  );
}

function CalendarCard({ data }: { data: AllData }) {
  const mins = minutesByDay(data);
  const start = addDays(weekStartKey(), -7 * 38);
  const days = Array.from({ length: 39 * 7 }, (_, i) => addDays(start, i));
  const months: { label: string; col: number }[] = [];
  days.forEach((d, i) => {
    if (i % 7 === 0) {
      const m = parseDay(d).toLocaleDateString(undefined, { month: 'short' });
      if (!months.length || months[months.length - 1].label !== m) months.push({ label: m, col: i / 7 });
    }
  });
  return (
    <Card className="z-card wide" index={6}>
      <CardHead title="Study calendar" aside={`${fmtHours(monthMinutes(data))} this month`} />
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

function AheadCard({ data }: { data: AllData }) {
  const today = todayKey();
  const tests = activeSubjects(data)
    .filter((s) => s.nextTestDate && s.nextTestDate >= today)
    .sort((a, b) => (a.nextTestDate! < b.nextTestDate! ? -1 : 1));
  const prev = data.checkins.filter((c) => c.weekStart < weekStartKey()).sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1))[0];
  const goals = prev?.goals.filter((g) => g.trim()) ?? [];
  return (
    <Card className="z-card" index={7}>
      <CardHead title="Ahead" />
      {tests.length === 0 && goals.length === 0 && <Empty text="Test dates and weekly goals appear here." />}
      {tests.length > 0 && (
        <ul className="quiet-list">
          {tests.map((s) => {
            const d = daysBetween(today, s.nextTestDate!);
            return (
              <li key={s.id}>
                <Link to={`/subjects/${s.id}`} className="q-label">
                  {s.name} test
                </Link>
                <span className={cx('q-value num', d <= 7 && 'soon')}>{d === 0 ? 'today' : `${d} days`}</span>
              </li>
            );
          })}
        </ul>
      )}
      {goals.length > 0 && (
        <>
          <span className="eyebrow goals-title">This week’s goals</span>
          <ol className="goals">
            {goals.map((g, i) => (
              <li key={i}>
                <span className="g-num serif">{i + 1}</span>
                <span>{g}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </Card>
  );
}

