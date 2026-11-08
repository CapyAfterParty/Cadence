import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Flame, Layers, Play, Square, Trash2, Zap } from 'lucide-react';
import { db, newRow, useData, type AllData } from '../db/db';
import type { StudySession } from '../db/types';
import { deleteFlashLog, deleteSession } from '../db/ops';
import { fmtClock, fmtDay, fmtHours, todayKey } from '../lib/dates';
import { cardsByDay, flashStreak, monthMinutes, studyStreak } from '../lib/stats';
import { openUI, rememberSubject, settings, timer, toast } from '../lib/state';
import { Button, Card, CardHead, Chip, Empty, Field, PageSkeleton, Stat } from '../components/ui';
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
      <Topbar title="Timer" />
      <div className="grid-2">
        {sprintFirst ? (
          <>
            <SprintCard data={data} index={0} />
            <StudyCard data={data} index={1} />
          </>
        ) : (
          <>
            <StudyCard data={data} index={0} />
            <SprintCard data={data} index={1} />
          </>
        )}
      </div>
      <div className="grid-2">
        <SessionsCard data={data} />
        <FlashcardsCard data={data} />
      </div>
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
  return (
    <Card index={index} className="home-card">
      <CardHead icon={<Play size={18} strokeWidth={SW} />} title="Study session" aside="Start, stop, saved" />
      <div className="big-clock" style={{ textAlign: 'center', padding: '16px 0' }}>
        {fmtClock(running ? timerSeconds(running, now) : 0)}
      </div>
      {running ? (
        <>
          <p className="muted" style={{ textAlign: 'center' }}>
            {runningSubject?.name} · keeps running if you leave this page or refresh
          </p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <Button variant="ghost" onClick={discardStudy}>
              Discard
            </Button>
            <Button variant="white" size="lg" onClick={stopStudy}>
              <Square size={14} strokeWidth={2} fill="currentColor" /> Stop and save
            </Button>
          </div>
        </>
      ) : (
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <SubjectSelect data={data} value={subjectId} onChange={setSubjectId} />
          <Button variant="primary" size="lg" disabled={!subjectId || !!t} onClick={() => startStudy(subjectId)}>
            <Play size={16} strokeWidth={SW} /> Start
          </Button>
        </div>
      )}
    </Card>
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
    <Card index={index} className="home-card">
      <CardHead icon={<Zap size={18} strokeWidth={SW} />} title="Timed sprint" aside="Exam conditions" />
      <p className="muted small">Full screen, timer only, no pause. When it ends, the paper log opens.</p>
      <Field label="Subject">
        <SubjectSelect data={data} value={subjectId} onChange={setSubjectId} />
      </Field>
      <div className="field">
        <span className="field-label">Length (minutes)</span>
        <div className="row">
          {LENGTHS.map((l) => (
            <Chip key={l} active={mins === l} onClick={() => setMinutes(String(l))}>
              {l}
            </Chip>
          ))}
          <input
            className="input sm num"
            style={{ width: 90 }}
            inputMode="numeric"
            value={minutes}
            aria-label="Custom length in minutes"
            onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ''))}
          />
        </div>
      </div>
      <Button variant="primary" size="lg" className="push" disabled={!subjectId || !valid || !!t} onClick={() => startSprint(subjectId, mins)}>
        <Zap size={16} strokeWidth={SW} /> Start {valid ? fmtHours(mins) : ''} sprint
      </Button>
      {t && <p className="tiny muted">Stop the running timer first.</p>}
    </Card>
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
    <Card index={2}>
      <CardHead title="Sessions" aside={`${fmtHours(monthMinutes(data))} this month · ${studyStreak(data)}-day streak`} />
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <Field label="Subject">
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
    </Card>
  );
}

function FlashcardsCard({ data }: { data: AllData }) {
  const today = todayKey();
  const cards = cardsByDay(data).get(today) ?? 0;
  const logs = [...data.flashLogs].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8);
  return (
    <Card index={3}>
      <CardHead
        icon={<Layers size={18} strokeWidth={SW} />}
        title="Flashcards"
        aside={
          <span className="row" style={{ gap: 4 }}>
            <Flame size={12} strokeWidth={SW} /> {flashStreak(data)}-day streak
          </span>
        }
      />
      <div className="row-between" style={{ marginBottom: 16 }}>
        <Stat value={cards} unit="cards" label={cards > 0 ? 'Done today. Rule kept.' : 'Some cards every day, weekends too.'} accent={cards === 0} />
        <Button variant={cards ? undefined : 'primary'} onClick={() => openUI({ flashLog: true })}>
          {cards ? 'Edit today' : 'Log today'}
        </Button>
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
              <span className="num" style={{ width: 72, textAlign: 'right', fontWeight: 600 }}>
                {l.cardsDone} cards
              </span>
              <Button icon size="sm" variant="ghost" aria-label="Delete log" onClick={() => deleteFlashLog(l.id)}>
                <Trash2 size={14} strokeWidth={SW} />
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
