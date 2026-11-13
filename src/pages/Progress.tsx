import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useData, type AllData } from '../db/db';
import type { Subject } from '../db/types';
import { addDays, daysBetween, fmtDay, fmtHours, inWeek, isSunday, lastNDays, parseDay, todayKey, weekStartKey, weekdayLetter } from '../lib/dates';
import { activeSubjects, cardsByDay, dueMistakes, flashStreak, loopScore, minutesByDay, monthMinutes, pct, recentWeeks, studyStreak, subjectAverage, subjectPapers } from '../lib/stats';
import { openUI, settings } from '../lib/state';
import { Bars, MultiLine, RangeLine, Spark } from '../components/charts/fancy';
import { Skeleton, cx } from '../components/ui';
import { Topbar } from '../components/Topbar';
import { CornerLink, DotNum, DotStrip, Glass, GlassHead, Panel } from '../components/glass';
import { courseTitle, splitCourse } from '../lib/course';
import './pages.css';

export default function Progress() {
  const data = useData();
  return (
    <div className="page">
      <Topbar title="Progress" />
      {data ? <Body data={data} /> : <Skeleton height="40rem" />}
    </div>
  );
}

function Body({ data }: { data: AllData }) {
  const st = settings.use();
  const subjects = activeSubjects(data);
  const [chosenId, setChosenId] = useState(st.lastSubjectId ?? '');
  const subject = subjects.find((s) => s.id === chosenId) ?? subjects[0];
  return (
    <>
      <div className="hero-row tall">
        <LoopGel data={data} redoDays={st.redoDays} />
        <StudySmoke data={data} />
        <TestsGel data={data} subject={subject} onPick={setChosenId} />
        <FlashGel data={data} />
      </div>
      <CalendarPanel data={data} />
      <div className="split">
        <MistakesPanel data={data} redoDays={st.redoDays} />
        <TargetsPanel data={data} />
      </div>
    </>
  );
}

/* ---------- Hero cards ---------- */

function LoopGel({ data, redoDays }: { data: AllData; redoDays: number }) {
  const weekStart = weekStartKey();
  const today = todayKey();
  const loop = loopScore(data, weekStart, redoDays);
  const [flash, paper, redo, check] = loop.parts;
  const cards = cardsByDay(data);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const rows = [
    { label: 'Flashcards', dots: days.map((d) => (cards.get(d) ?? 0) > 0), status: `${Math.round(flash.value * 7)}/7` },
    { label: 'Timed practice', dots: Array.from({ length: 7 }, (_, i) => i < Math.round(paper.value * 7)), status: paper.value >= 1 ? 'Done' : 'Not yet' },
    { label: 'Redone', dots: Array.from({ length: 7 }, (_, i) => i < Math.round(redo.value * 7)), status: `${Math.round(redo.value * 100)}%` },
    { label: 'Review', dots: Array.from({ length: 7 }, (_, i) => i < Math.round(check.value * 7)), status: check.value >= 1 ? 'Done' : isSunday(today) ? 'Today' : 'Sunday' },
  ];
  return (
    <Glass tone="pink" index={0}>
      <GlassHead title="This week">
        <span className="glass-tag">Day {Math.min(7, daysBetween(weekStart, today) + 1)} of 7</span>
      </GlassHead>
      <DotNum big className="lead">
        {loop.score}
        <small>%</small>
      </DotNum>
      <span className="label-dim">The weekly loop</span>
      <div className="loop-rows">
        {rows.map((r) => (
          <div key={r.label} className="loop-row">
            <span className="lr-label">{r.label}</span>
            <DotStrip values={r.dots} current={r.label === 'Flashcards' ? days.indexOf(today) : undefined} />
            <span className="lr-status num">{r.status}</span>
          </div>
        ))}
      </div>
    </Glass>
  );
}

function StudySmoke({ data }: { data: AllData }) {
  const days = lastNDays(7);
  const mins = minutesByDay(data);
  const weekStart = weekStartKey();
  const week = data.sessions.filter((s) => s.date >= weekStart).reduce((a, s) => a + s.minutes, 0);
  return (
    <Glass tone="smoke" index={1}>
      <GlassHead title="Study">
        <CornerLink to="/timer" label="Open Focus" />
      </GlassHead>
      <div className="hc-figure">
        <span className="thin-num">
          {Math.floor(week / 60)}
          <small>h</small> {Math.round(week % 60)}
          <small>m</small>
        </span>
      </div>
      <span className="label-dim">This week · streak {studyStreak(data)} days</span>
      <div className="hero-chart">
        <Bars values={days.map((d) => mins.get(d) ?? 0)} labels={days.map(weekdayLetter)} highlight={6} format={fmtHours} hue="white" />
      </div>
    </Glass>
  );
}

function TestsGel({ data, subject, onPick }: { data: AllData; subject?: Subject; onPick: (id: string) => void }) {
  const weeks = recentWeeks(10);
  const series = activeSubjects(data).map((s) => ({
    id: s.id,
    colour: s.id === subject?.id ? '#ffffff' : 'rgba(255,255,255,0.35)',
    values: weeks.map((w) => {
      const ps = data.papers.filter((p) => p.subjectId === s.id && inWeek(p.date, w));
      return ps.length ? ps.reduce((a, p) => a + pct(p), 0) / ps.length : null;
    }),
  }));
  const avg = subject ? subjectAverage(data, subject.id) : null;
  return (
    <Glass tone="blue" index={2}>
      <GlassHead title="Tests">
        <CornerLink to={subject ? `/papers?subject=${subject.id}` : '/papers'} label="Open Tests" />
      </GlassHead>
      <DotNum big className="lead">
        {avg == null ? '–' : Math.round(avg)}
        <small>%</small>
      </DotNum>
      <span className="label-dim">{subject ? `${courseTitle(subject.name)}, last three` : 'No course'}</span>
      <div className="hero-chart">
        {data.papers.length > 0 && <MultiLine series={series} labels={weeks.map((w) => fmtDay(w))} target={subject?.targetPct} focus={subject?.id} hue="white" />}
      </div>
      <div className="glass-tabs">
        {activeSubjects(data).map((s) => (
          <button key={s.id} type="button" className={s.id === subject?.id ? 'on' : undefined} onClick={() => onPick(s.id)}>
            {splitCourse(s.name).code ?? courseTitle(s.name)}
          </button>
        ))}
      </div>
    </Glass>
  );
}

function FlashGel({ data }: { data: AllData }) {
  const cards = cardsByDay(data);
  const days = lastNDays(7);
  const today = cards.get(todayKey()) ?? 0;
  const week = days.reduce((a, d) => a + (cards.get(d) ?? 0), 0);
  return (
    <Glass tone="violet" index={3}>
      <GlassHead title="Flashcards">
        <button type="button" className="hc-corner" onClick={() => openUI({ flashLog: true })} aria-label="Log flashcards">
          <Plus size={16} strokeWidth={2} />
        </button>
      </GlassHead>
      <DotNum big className="lead">
        {today}
      </DotNum>
      <span className="label-dim">
        today · {week} this week · streak {flashStreak(data)}
      </span>
      <div className="hero-chart">
        <Spark values={days.map((d) => cards.get(d) ?? 0)} compare={days.map((d) => cards.get(addDays(d, -7)) ?? 0)} labels={days.map(weekdayLetter)} hue="white" />
      </div>
    </Glass>
  );
}

/* ---------- Calendar: every day as a dot ---------- */

function CalendarPanel({ data }: { data: AllData }) {
  const mins = minutesByDay(data);
  const today = todayKey();
  const WEEKS = 40;
  const start = addDays(weekStartKey(), -7 * (WEEKS - 1));
  const weeks = Array.from({ length: WEEKS }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
  const all = weeks.flat().filter((d) => d <= today);
  const studied = all.filter((d) => (mins.get(d) ?? 0) > 0);
  const best = all.reduce((b, d) => ((mins.get(d) ?? 0) > (mins.get(b) ?? 0) ? d : b), all[0]);
  const total = all.reduce((a, d) => a + (mins.get(d) ?? 0), 0);
  const level = (m: number) => (m <= 0 ? 0 : m < 30 ? 1 : m < 90 ? 2 : m < 180 ? 3 : 4);
  return (
    <Panel title="Study calendar" aside={`${WEEKS} weeks`} index={4} className="cal-panel">
      <div className="cal-wrap">
        <div className="cal-grid">
          <div className="cal-months" style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))` }}>
            {weeks.map((w, i) => {
              const m = parseDay(w[0]).getMonth();
              const prev = i > 0 ? parseDay(weeks[i - 1][0]).getMonth() : -1;
              return <span key={i}>{m !== prev ? parseDay(w[0]).toLocaleDateString(undefined, { month: 'short' }) : ''}</span>;
            })}
          </div>
          <div className="cal-dots" style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))` }}>
            {weeks.map((w, i) => (
              <div key={i} className="cal-col">
                {w.map((d) => (
                  <span
                    key={d}
                    className={cx('cd', `l${level(mins.get(d) ?? 0)}`, d === today && 'now', d > today && 'future')}
                    title={`${fmtDay(d, { weekday: 'short', day: 'numeric', month: 'short' })}: ${fmtHours(mins.get(d) ?? 0)}`}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="cal-legend">
            <span>Less</span>
            {[0, 1, 2, 3, 4].map((l) => (
              <span key={l} className={`cd l${l}`} />
            ))}
            <span>More</span>
          </div>
        </div>
        <div className="cal-stats">
          <Stat label="This month" value={fmtHours(monthMinutes(data))} />
          <Stat label="Days studied" value={`${studied.length}`} sub={`of ${all.length}`} />
          <Stat label="Best day" value={fmtHours(mins.get(best) ?? 0)} sub={best ? fmtDay(best) : ''} />
          <Stat label="Total" value={fmtHours(total)} />
        </div>
      </div>
    </Panel>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="mini-stat">
      <span className="ms-label">{label}</span>
      <span className="ms-value">
        {value}
        {sub && <small>{sub}</small>}
      </span>
    </div>
  );
}

/* ---------- Mistakes and targets ---------- */

function MistakesPanel({ data, redoDays }: { data: AllData; redoDays: number }) {
  const days = lastNDays(7);
  const due = dueMistakes(data, redoDays);
  const redone = new Set(data.attempts.filter((a) => days.includes(a.date)).map((a) => a.mistakeId)).size;
  const cleared = new Set(data.attempts.filter((a) => a.correct && days.includes(a.date)).map((a) => a.mistakeId)).size;
  const logged = data.mistakes.filter((m) => days.includes(m.date)).length;
  const open = data.mistakes.filter((m) => !m.cleared);
  const subjects = activeSubjects(data);
  const maxOpen = Math.max(1, ...subjects.map((s) => open.filter((m) => m.subjectId === s.id).length));
  return (
    <Panel title="Mistakes" aside={`${open.length} open`} index={5} className="aura-pink">
      <div className="mp-top">
        <div>
          <DotNum big>{due.length}</DotNum>
          <span className="label-dim">due for redo</span>
        </div>
        <div className="mp-stats">
          <Stat label="Redone" value={String(redone)} sub="7 days" />
          <Stat label="Cleared" value={String(cleared)} sub="7 days" />
          <Stat label="Logged" value={String(logged)} sub="7 days" />
        </div>
      </div>
      <div className="course-bars">
        {subjects.map((s) => {
          const n = open.filter((m) => m.subjectId === s.id).length;
          const d = due.filter((m) => m.subjectId === s.id).length;
          return (
            <Link key={s.id} to={`/mistakes?subject=${s.id}`} className="cb-row" style={{ ['--c' as string]: s.colour }}>
              <span className="cb-name">{courseTitle(s.name)}</span>
              <span className="cb-track">
                <i style={{ width: `${(n / maxOpen) * 100}%` }} />
                <b style={{ width: `${(d / maxOpen) * 100}%` }} />
              </span>
              <span className="cb-num num">
                {d}
                <small>/{n}</small>
              </span>
            </Link>
          );
        })}
      </div>
      <Link to={`/redo?subject=${settings.get().lastSubjectId ?? ''}`} className="white-pill">
        Start a redo
      </Link>
    </Panel>
  );
}

function TargetsPanel({ data }: { data: AllData }) {
  const today = todayKey();
  return (
    <Panel title="Targets" aside="Average vs target" index={6} className="aura-blue">
      <div className="targets">
        {activeSubjects(data).map((s) => {
          const avg = subjectAverage(data, s.id);
          const n = subjectPapers(data, s.id).length;
          const d = s.nextTestDate ? daysBetween(today, s.nextTestDate) : null;
          const { code, title } = splitCourse(s.name);
          return (
            <Link key={s.id} to={`/subjects/${s.id}`} className="tg-row" style={{ ['--c' as string]: s.colour }}>
              <span className="tg-badge">{code?.slice(0, 3) ?? title.slice(0, 2)}</span>
              <span className="tg-name">
                {title}
                <small>{n} marks{d != null && d >= 0 ? ` · test in ${d}d` : ''}</small>
              </span>
              <span className="tg-range">
                <RangeLine value={avg} target={s.targetPct} />
              </span>
              <span className={cx('tg-avg num', avg != null && avg >= s.targetPct && 'ok')}>
                {avg == null ? '–' : `${Math.round(avg)}%`}
                <small>/ {s.targetPct}</small>
              </span>
            </Link>
          );
        })}
      </div>
    </Panel>
  );
}
