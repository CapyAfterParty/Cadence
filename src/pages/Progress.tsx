import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarDays, Check, CircleAlert, FileText, Layers, Repeat, Target, Timer } from 'lucide-react';
import { useData, type AllData } from '../db/db';
import type { Subject } from '../db/types';
import { addDays, daysBetween, fmtDay, fmtHours, inWeek, isSunday, lastNDays, parseDay, todayKey, weekStartKey, weekdayLetter } from '../lib/dates';
import {
  activeSubjects,
  cardsByDay,
  dueMistakes,
  flashStreak,

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
import { Topbar } from '../components/Topbar';
import { courseTitle } from '../lib/course';

export default function Progress() {
  const data = useData();
  return (
    <div className="page">
      <Topbar title="Progress" />
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

function Body({ data }: { data: AllData }) {
  const st = settings.use();
  const subjects = activeSubjects(data);
  const [chosenId, setChosenId] = useState(st.lastSubjectId ?? '');
  const subject = subjects.find((s) => s.id === chosenId) ?? subjects[0];
  return (
    <div className="zen-grid">
      <LoopCard data={data} redoDays={st.redoDays} />
      <StudyCard data={data} />
      <FlashCard data={data} />
      <MistakesCard data={data} redoDays={st.redoDays} />
      <PapersCard data={data} subject={subject} onPick={setChosenId} />
      <TargetCard data={data} subject={subject} onPick={setChosenId} />
      <CalendarCard data={data} />
    </div>
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

const LOOP_HUES = ['lavender', 'mist', 'rose', 'sand'] as const;

function LoopCard({ data, redoDays }: { data: AllData; redoDays: number }) {
  const weekStart = weekStartKey();
  const today = todayKey();
  const current = loopScore(data, weekStart, redoDays);
  const [flash, paper, redo, check] = current.parts;
  const rows = [
    { label: 'Flashcards', value: flash.value, status: `${Math.round(flash.value * 7)}/7 days`, hue: LOOP_HUES[0] },
    { label: 'Timed practice', value: paper.value, status: paper.value >= 1 ? 'Done' : 'Not yet', hue: LOOP_HUES[1] },
    { label: 'Mistakes redone', value: redo.value, status: `${Math.round(redo.value * 100)}%`, hue: LOOP_HUES[2] },
    { label: 'Check-in', value: check.value, status: check.value >= 1 ? 'Done' : isSunday(today) ? 'Today' : 'Sunday', hue: LOOP_HUES[3] },
  ];
  return (
    <Card className="z-card loop" index={0} tint="#b9a8e0">
      <CardHead icon={<Repeat size={15} strokeWidth={1.8} />} tone="orchid" title="This week" aside={`Day ${Math.min(7, daysBetween(weekStart, today) + 1)} of 7`} />
      <div className="loop-wrap">
        <LoopRing parts={current.parts.map((p, i) => ({ ...p, hue: LOOP_HUES[i] }))}>
          <span className="loop-score num">
            <CountUp value={current.score} />
          </span>
          <span className="loop-caption">this week</span>
        </LoopRing>
      </div>
      <ul className="quiet-list">
        {rows.map((r) => (
          <li key={r.label}>
            <span className={cx('q-mark', r.value >= 1 && 'on')} style={{ ['--h' as string]: `var(--${r.hue})` }}>
              {r.value >= 1 && <Check size={10} strokeWidth={2.6} />}
            </span>
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
    <Card className="z-card" index={1} tint="#e6cd92">
      <CardHead icon={<Timer size={15} strokeWidth={1.8} />} tone="gold" title={<Link to="/timer">Study</Link>} aside="This week" />
      <Big>
        <CountUp value={h} />
        <span className="u">h</span> <CountUp value={m} />
        <span className="u">m</span>
      </Big>
      <p className="caption">Streak {studyStreak(data)} days</p>
      <div className="chart">
        <Bars values={days.map((d) => mins.get(d) ?? 0)} labels={days.map(weekdayLetter)} format={fmtHours} hue="sand" />
      </div>
    </Card>
  );
}

function FlashCard({ data }: { data: AllData }) {
  const cards = cardsByDay(data);
  const days = lastNDays(7);
  const today = cards.get(todayKey()) ?? 0;
  return (
    <Card className="z-card" index={2} tint="#b9a8e0">
      <CardHead
        icon={<Layers size={15} strokeWidth={1.8} />}
        tone="orchid"
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
      <p className="caption">Streak {flashStreak(data)} days</p>
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
    <Card className="z-card" index={3} tint="#e3a4b1">
      <CardHead icon={<CircleAlert size={15} strokeWidth={1.8} />} tone="coral" title={<Link to="/mistakes">Mistakes</Link>} aside={`${open} open`} />
      <Big unit="due">
        <CountUp value={due} />
      </Big>
      <p className="caption">Due for redo</p>
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
          {courseTitle(s.name)}
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
    <Card className="z-card" index={4} tint="#9dbbdc">
      <CardHead icon={<FileText size={15} strokeWidth={1.8} />} tone="lagoon" title={<Link to={subject ? `/papers?subject=${subject.id}` : '/papers'}>Tests</Link>} aside="10 weeks" />
      {!data.papers.length ? (
        <Empty text="Log a paper to see the trend." action={<button type="button" className="btn sm" onClick={() => openUI({ logPaper: { preset: { subjectId: subject?.id } } })}>Log a paper</button>} />
      ) : (
        <>
          <Big unit="%">{avg == null ? '–' : <CountUp value={Math.round(avg)} />}</Big>
          <p className="caption">
            {subject ? courseTitle(subject.name) : ''}, last three · {papers.length} logged
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
    <Card className="z-card" index={5} tint="#9fc8a8">
      <CardHead icon={<Target size={15} strokeWidth={1.8} />} tone="meadow" title="Target" aside={subject ? courseTitle(subject.name) : undefined} />
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
        <Empty text="Add a course to set a target." action={<Link className="btn sm" to="/subjects">Add course</Link>} />
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
    <Card className="z-card full" index={6} tint="#9fc8a8">
      <CardHead icon={<CalendarDays size={15} strokeWidth={1.8} />} tone="meadow" title="Study calendar" aside={`${fmtHours(monthMinutes(data))} this month`} />
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
