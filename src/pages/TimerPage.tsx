import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Flame, Play, Square, Trash2, Zap } from 'lucide-react';
import { db, newRow, useData, type AllData } from '../db/db';
import type { StudySession } from '../db/types';
import { deleteFlashLog, deleteSession } from '../db/ops';
import { fmtClock, fmtDay, fmtHours, todayKey } from '../lib/dates';
import { cardsByDay, flashStreak, monthMinutes, studyStreak } from '../lib/stats';
import { openUI, rememberSubject, settings, timer, toast } from '../lib/state';
import { Button, Empty, Field, PageSkeleton } from '../components/ui';
import { DotNum, Glass, GlassHead, Panel } from '../components/glass';
import { courseTitle, splitCourse } from '../lib/course';
import './pages.css';
import { SubjectSelect } from '../components/pickers';
import { Topbar } from '../components/Topbar';
import { discardStudy, startSprint, startStudy, stopStudy } from '../features/timerActions';
import { timerSeconds, useNow } from '../features/TimerController';

const SW = 1.5;

export default function TimerPage() {
  const data = useData();
  if (!data) return <PageSkeleton />;
  return <TimerView data={data} />;
}

function TimerView({ data }: { data: AllData }) {
  const [params] = useSearchParams();
  const sprintFirst = params.get('sprint') === '1';
  return (
    <div className="page">
      <Topbar title="Focus" />
      <div className={sprintFirst ? 'focus-hero sprint-first' : 'focus-hero'}>
        <StudyCard data={data} index={sprintFirst ? 1 : 0} />
        <SprintCard data={data} index={sprintFirst ? 0 : 1} />
      </div>
      <div className="split">
        <SessionsCard data={data} />
        <FlashcardsCard data={data} />
      </div>
    </div>
  );
}

function CourseOrbs({ data, value, onChange, disabled }: { data: AllData; value: string; onChange: (id: string) => void; disabled?: boolean }) {
  return (
    <div className="course-orbs" role="radiogroup" aria-label="Course">
      {data.subjects
        .filter((x) => !x.archived)
        .map((x) => {
          const { code, title } = splitCourse(x.name);
          return (
            <button
              key={x.id}
              type="button"
              role="radio"
              aria-checked={x.id === value}
              disabled={disabled}
              className={x.id === value ? 'c-orb on' : 'c-orb'}
              style={{ ['--c' as string]: x.colour }}
              onClick={() => onChange(x.id)}
              title={x.name}
            >
              <span className="c-orb-face">{code?.slice(0, 3) ?? title.slice(0, 2)}</span>
              <span className="c-orb-name">{title}</span>
            </button>
          );
        })}
    </div>
  );
}

function StudyCard({ data, index }: { data: AllData; index: number }) {
  const st = settings.use();
  const t = timer.use();
  const now = useNow(t?.kind === 'study');
  const firstActive = data.subjects.find((s) => !s.archived)?.id ?? '';
  const [subjectId, setSubjectId] = useState(st.lastSubjectId && data.subjects.some((s) => s.id === st.lastSubjectId) ? st.lastSubjectId : firstActive);
  const running = t?.kind === 'study' ? t : null;
  const runningSubject = data.subjects.find((s) => s.id === running?.subjectId);
  const secs = running ? timerSeconds(running, now) : 0;
  const clock = fmtClock(secs);
  const today = data.sessions.filter((x) => x.date === todayKey()).reduce((a, x) => a + x.minutes, 0);
  return (
    <Glass tone="violet" wide index={index} className="study-gel">
      <GlassHead title="Study session">
        <span className="glass-tag">{running ? 'Running' : `${fmtHours(today)} today`}</span>
      </GlassHead>
      <div className={running ? 'focus-clock live' : 'focus-clock'}>
        <DotNum>{clock}</DotNum>
        <span className="label-dim">{running ? `${runningSubject ? courseTitle(runningSubject.name) : ''} · keeps running if you leave or refresh` : 'Pick a course, then start. It saves when you stop.'}</span>
      </div>
      <CourseOrbs data={data} value={running?.subjectId ?? subjectId} onChange={setSubjectId} disabled={!!running} />
      <div className="focus-actions">
        {running ? (
          <>
            <button type="button" className="dark-pill" onClick={discardStudy}>
              Discard
            </button>
            <button type="button" className="white-pill" onClick={stopStudy}>
              <Square size={13} strokeWidth={2.4} fill="currentColor" /> Stop and save
            </button>
          </>
        ) : (
          <button type="button" className="white-pill big" disabled={!subjectId || !!t} onClick={() => startStudy(subjectId)}>
            <Play size={15} strokeWidth={2.2} fill="currentColor" /> Start {courseTitle(data.subjects.find((x) => x.id === subjectId)?.name ?? '')}
          </button>
        )}
      </div>
    </Glass>
  );
}

const LENGTHS = [30, 60, 90, 120, 150];

function SprintCard({ data, index }: { data: AllData; index: number }) {
  const st = settings.use();
  const t = timer.use();
  const firstActive = data.subjects.find((s) => !s.archived)?.id ?? '';
  const [subjectId, setSubjectId] = useState(st.lastSubjectId && data.subjects.some((s) => s.id === st.lastSubjectId) ? st.lastSubjectId : firstActive);
  const [minutes, setMinutes] = useState(String(st.sprintMinutes));
  const mins = Number(minutes);
  const valid = mins > 0 && mins <= 600;
  return (
    <Glass tone="blue" index={index} className="sprint-gel">
      <GlassHead title="Timed sprint">
        <span className="glass-tag">Exam conditions</span>
      </GlassHead>
      <DotNum big className="lead">
        {valid ? `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}` : '–'}
      </DotNum>
      <span className="label-dim">Full screen, timer only, no pause. The mark log opens at the end.</span>
      <div className="len-dots" role="radiogroup" aria-label="Length in minutes">
        {LENGTHS.map((l) => (
          <button key={l} type="button" role="radio" aria-checked={mins === l} className={mins === l ? 'len on' : 'len'} onClick={() => setMinutes(String(l))}>
            {l}
          </button>
        ))}
        <input className="len-input num" inputMode="numeric" value={minutes} aria-label="Custom length in minutes" onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ''))} />
      </div>
      <div className="sprint-course">
        <SubjectSelect data={data} value={subjectId} onChange={setSubjectId} />
      </div>
      <button type="button" className="white-pill wide" disabled={!subjectId || !valid || !!t} onClick={() => startSprint(subjectId, mins)}>
        <Zap size={15} strokeWidth={2} /> Start {valid ? fmtHours(mins) : ''} sprint
      </button>
      {t && <span className="label-dim">Stop the running timer first.</span>}
    </Glass>
  );
}

function SessionsCard({ data }: { data: AllData }) {
  const st = settings.use();
  const firstActive = data.subjects.find((s) => !s.archived)?.id ?? '';
  const [f, setF] = useState({ subjectId: st.lastSubjectId ?? firstActive, date: todayKey(), minutes: '', note: '' });
  const [tried, setTried] = useState(false);
  const subjectName = new Map(data.subjects.map((s) => [s.id, s.name]));
  const recent = [...data.sessions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt)).slice(0, 8);
  const mins = Number(f.minutes);

  const add = async () => {
    setTried(true);
    if (!f.subjectId || !(mins > 0)) return;
    await db.studySessions.add(newRow<StudySession>({ subjectId: f.subjectId, date: f.date, minutes: mins, note: f.note.trim() || undefined }));
    rememberSubject(f.subjectId);
    toast(`Saved ${fmtHours(mins)}`);
    setF({ ...f, minutes: '', note: '' });
    setTried(false);
  };

  return (
    <Panel index={2} title="Sessions" aside={`${fmtHours(monthMinutes(data))} this month · ${studyStreak(data)}-day streak`} className="aura-orange">
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <Field label="Course">
          <SubjectSelect data={data} value={f.subjectId} onChange={(subjectId) => setF({ ...f, subjectId })} />
        </Field>
        <Field label="Date">
          <input type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value || todayKey() })} />
        </Field>
        <Field label="Minutes" error={tried && !(mins > 0) ? 'How long?' : ''}>
          <input className="input num" inputMode="numeric" value={f.minutes} onChange={(e) => setF({ ...f, minutes: e.target.value.replace(/\D/g, '') })} />
        </Field>
        <Field label="Note (optional)">
          <input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </Field>
        <div className="span-2 row" style={{ justifyContent: 'flex-end' }}>
          <Button type="submit">Add manual session</Button>
        </div>
      </form>
      <hr className="divider" />
      {recent.length === 0 ? (
        <Empty text="No sessions yet. Start the timer above." />
      ) : (
        <div className="list">
          {recent.map((s) => (
            <div key={s.id} className="list-item">
              <span className="grow">
                {subjectName.get(s.subjectId)}
                {s.note && <span className="muted"> · {s.note}</span>}
              </span>
              <span className="small muted">{fmtDay(s.date)}</span>
              <span className="num" style={{ width: 64, textAlign: 'right', fontWeight: 600 }}>
                {fmtHours(s.minutes)}
              </span>
              <Button icon size="sm" variant="ghost" aria-label="Delete session" onClick={() => deleteSession(s.id)}>
                <Trash2 size={14} strokeWidth={SW} />
              </Button>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function FlashcardsCard({ data }: { data: AllData }) {
  const today = todayKey();
  const cards = cardsByDay(data).get(today) ?? 0;
  const logs = [...data.flashLogs].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8);
  return (
    <Panel
      index={3}
      className="aura-violet"
      title="Flashcards"
      aside={
        <span className="row" style={{ gap: 4 }}>
          <Flame size={12} strokeWidth={SW} /> {flashStreak(data)}-day streak
        </span>
      }
    >
      <div className="row-between" style={{ marginBottom: 16 }}>
        <div>
          <DotNum big>
            {cards}
            <small>cards</small>
          </DotNum>
          <span className="label-dim">{cards > 0 ? 'Done today. Rule kept.' : 'Some cards every day, weekends too.'}</span>
        </div>
        <button type="button" className="white-pill" onClick={() => openUI({ flashLog: true })}>
          {cards ? 'Edit today' : 'Log today'}
        </button>
      </div>
      {logs.length === 0 ? (
        <Empty text="No flashcard logs yet." />
      ) : (
        <div className="list">
          {logs.map((l) => (
            <div key={l.id} className="list-item">
              <span className="grow">{fmtDay(l.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              <span className="small muted">
                {[l.accuracyPct != null && `${l.accuracyPct}%`, l.minutes != null && `${l.minutes}m`].filter(Boolean).join(' · ')}
              </span>
              <span className="num" style={{ width: 96, textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {l.cardsDone} cards
              </span>
              <Button icon size="sm" variant="ghost" aria-label="Delete log" onClick={() => deleteFlashLog(l.id)}>
                <Trash2 size={14} strokeWidth={SW} />
              </Button>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
