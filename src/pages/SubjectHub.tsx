import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FileText, ListPlus, NotebookPen, Play, Plus, RotateCcw, X } from 'lucide-react';
import { db, newRow, useData, type AllData } from '../db/db';
import { courseTitle, splitCourse } from '../lib/course';
import type { Note, Subject, Topic, Weakness } from '../db/types';
import { createTopic, deleteTopic } from '../db/ops';
import { daysBetween, fmtDay, relDays, todayKey } from '../lib/dates';
import { dueMistakes, pct, subjectAverage, subjectPapers, topicWeakness } from '../lib/stats';
import { openUI, rememberSubject, settings } from '../lib/state';
import { Button, Card, Chip, Empty, ErrorPill, PageSkeleton, WeaknessPill } from '../components/ui';
import { DotNum, DotStrip, Glass, GlassHead, Panel } from '../components/glass';
import './pages.css';
import { Topbar } from '../components/Topbar';
import { MultiLine } from '../components/charts/fancy';
import { ScanGrid, ScanUploadButton } from '../components/Scans';
import { SubjectEditor } from '../components/SubjectEditor';
import { startStudy } from '../features/timerActions';
import { paperLabel } from '../features/MistakeForms';

const SW = 1.5;
const statusColour: Record<Weakness, string> = { high: 'var(--red)', medium: 'var(--amber)', low: 'var(--green)' };

export default function SubjectHub() {
  const { id } = useParams();
  const data = useData();
  if (!data) return <PageSkeleton />;
  const subject = data.subjects.find((s) => s.id === id);
  if (!subject)
    return (
      <div className="page">
        <Topbar title="Course" />
        <Card>
          <Empty text="This course no longer exists." action={<Link className="btn sm" to="/subjects">All courses</Link>} />
        </Card>
      </div>
    );
  return <Hub data={data} subject={subject} />;
}

function Hub({ data, subject }: { data: AllData; subject: Subject }) {
  const nav = useNavigate();
  const st = settings.use();
  const today = todayKey();
  const avg = subjectAverage(data, subject.id);
  const days = subject.nextTestDate ? daysBetween(today, subject.nextTestDate) : null;
  const open = data.mistakes.filter((m) => m.subjectId === subject.id && !m.cleared);
  const due = dueMistakes(data, st.redoDays).filter((m) => m.subjectId === subject.id);
  const papers = subjectPapers(data, subject.id);

  const addNote = async () => {
    const note = newRow<Note>({ subjectId: subject.id, title: '', body: '', updatedAt: Date.now() });
    await db.notes.add(note);
    nav(`/notes/${note.id}`);
  };
  const preset = { subjectId: subject.id };
  useEffect(() => rememberSubject(subject.id), [subject.id]);

  return (
    <div className="page">
      <div className="hub-hero">
        <Glass tone="course" colour={subject.colour} wide index={0} className="hub-gel">
          <GlassHead title={<span className="glass-tag">{splitCourse(subject.name).code ?? 'Course'}</span>}>
            {subject.archived && <span className="glass-tag">Archived</span>}
          </GlassHead>
          <div className="hub-title-row">
            <div>
              <h1 className="hub-title">{courseTitle(subject.name)}</h1>
              <span className="label-dim">
                {subject.nextTestDate ? (days != null && days >= 0 ? `Test in ${days} ${days === 1 ? 'day' : 'days'} · ${fmtDay(subject.nextTestDate, { weekday: 'long', day: 'numeric', month: 'long' })}` : 'Test date passed') : 'No test date set'}
              </span>
            </div>
            <div className="hub-figs">
              <div>
                <DotNum big className="lead">
                  {avg == null ? '–' : Math.round(avg)}
                  <small>%</small>
                </DotNum>
                <span className="label-dim">average</span>
              </div>
              <div>
                <DotNum big className="lead">
                  {subject.targetPct}
                  <small>%</small>
                </DotNum>
                <span className="label-dim">target</span>
              </div>
            </div>
          </div>
          <div className="hero-chart">
            {papers.length > 0 && <MultiLine series={[{ id: subject.id, colour: '#ffffff', values: papers.map(pct) }]} labels={papers.map((p) => fmtDay(p.date))} target={subject.targetPct} focus={subject.id} hue="white" />}
          </div>
          <div className="g-dock hub-dock">
            <button type="button" className="dock-pill white" onClick={() => startStudy(subject.id)}>
              <Play size={14} strokeWidth={2} fill="currentColor" /> Study now
            </button>
            <button type="button" className="dock-pill" onClick={() => openUI({ quickAdd: { preset } })} title="Add mistake" aria-label="Add mistake">
              <Plus size={16} strokeWidth={1.8} />
            </button>
            <button type="button" className="dock-pill" onClick={() => openUI({ bulk: preset })} title="Mistakes from a test" aria-label="Bulk add">
              <ListPlus size={16} strokeWidth={1.8} />
            </button>
            <button type="button" className="dock-pill" onClick={() => openUI({ logPaper: { preset } })} title="Log a test" aria-label="Log a test">
              <FileText size={16} strokeWidth={1.8} />
            </button>
            <button type="button" className="dock-pill" onClick={addNote} title="Add note" aria-label="Add note">
              <NotebookPen size={16} strokeWidth={1.8} />
            </button>
          </div>
        </Glass>
        <div className="hub-side">
          <Glass tone="smoke" index={1}>
            <GlassHead title="Mistakes">
              <Link to={`/mistakes?subject=${subject.id}`} className="mode-pill">
                All
                <i />
              </Link>
            </GlassHead>
            <div className="hc-figure">
              <span className="thin-num">{due.length}</span>
              <span className="hc-unit">due of {open.length} open</span>
            </div>
            <div className="hero-foot">
              <DotStrip values={Array.from({ length: 10 }, (_, i) => i < Math.min(10, due.length))} />
              <button type="button" className="white-pill small" disabled={!open.length} onClick={() => nav(`/redo?subject=${subject.id}`)}>
                <RotateCcw size={14} strokeWidth={2} /> Start redo
              </button>
            </div>
          </Glass>
          <Glass tone="pink" index={2}>
            <GlassHead title="Countdown" />
            <DotNum big className="lead">
              {days == null || days < 0 ? '–' : String(days).padStart(2, '0')}
              <small>{days === 1 ? 'day' : 'days'}</small>
            </DotNum>
            <span className="label-dim">{subject.nextTestDate ? fmtDay(subject.nextTestDate, { weekday: 'short', day: 'numeric', month: 'short' }) : 'Set a date in Details'}</span>
          </Glass>
        </div>
      </div>

      <div className="grid-2">
        <TopicsCard data={data} subject={subject} />
        <Panel index={5} title="Details" aside="Saves as you type">
          <SubjectEditor subject={subject} />
        </Panel>
      </div>

      <div className="grid-2">
        <NotesCard data={data} subject={subject} onAdd={addNote} />
        <MistakesCard data={data} subject={subject} />
      </div>

      <PapersCard data={data} subject={subject} />

      <Panel index={9} title="Scans" aside={<ScanUploadButton ownerType="subject" ownerId={subject.id} quiet size="sm" />}>
        <ScanGrid ownerType="subject" ownerId={subject.id} emptyText="Upload scans of notes or marked work." />
      </Panel>
    </div>
  );
}

function TopicsCard({ data, subject }: { data: AllData; subject: Subject }) {
  const [name, setName] = useState('');
  const topics = data.topics.filter((t) => t.subjectId === subject.id);
  const rank = { high: 0, medium: 1, low: 2 };
  const withWeak = topics.map((t) => ({ t, w: topicWeakness(data, t) })).sort((a, b) => rank[a.w] - rank[b.w] || a.t.name.localeCompare(b.t.name));
  const cycle = (t: Topic) => {
    const order: (Weakness | undefined)[] = [undefined, 'high', 'medium', 'low'];
    const next = order[(order.indexOf(t.weaknessOverride) + 1) % order.length];
    db.topics.update(t.id, { weaknessOverride: next });
  };
  return (
    <Panel index={4} title="Weakest topics" aside="Click a topic to set its colour by hand" className="aura-pink">
      {withWeak.length === 0 ? (
        <p className="muted small" style={{ marginBottom: 16 }}>
          Topics show here, coloured by open mistakes and recent topic test scores.
        </p>
      ) : (
        <div className="chip-row" style={{ marginBottom: 16 }}>
          {withWeak.map(({ t, w }) => (
            <span key={t.id} className="row" style={{ gap: 0 }}>
              <Chip dot={statusColour[w]} onClick={() => cycle(t)} title={t.weaknessOverride ? `Set by hand: ${w}` : `Worked out: ${w}`}>
                {t.name}
                {t.weaknessOverride && <span className="tiny muted">•</span>}
              </Chip>
              <Button icon size="sm" variant="ghost" aria-label={`Delete topic ${t.name}`} onClick={() => deleteTopic(t.id)}>
                <X size={12} strokeWidth={SW} />
              </Button>
            </span>
          ))}
        </div>
      )}
      <form
        className="row"
        style={{ flexWrap: 'nowrap' }}
        onSubmit={async (e) => {
          e.preventDefault();
          if (name.trim()) await createTopic(subject.id, name);
          setName('');
        }}
      >
        <input className="input sm" placeholder="Add a topic" value={name} onChange={(e) => setName(e.target.value)} aria-label="New topic" />
        <Button type="submit" size="sm" disabled={!name.trim()}>
          Add
        </Button>
      </form>
    </Panel>
  );
}

function NotesCard({ data, subject, onAdd }: { data: AllData; subject: Subject; onAdd: () => void }) {
  const notes = data.notes.filter((n) => n.subjectId === subject.id).sort((a, b) => b.updatedAt - a.updatedAt);
  return (
    <Panel index={6} title="Notes" aside={`${notes.length}`} className="aura-violet">
      {notes.length === 0 ? (
        <Empty text="No notes yet." action={<Button size="sm" onClick={onAdd}>Write a note</Button>} />
      ) : (
        <div className="list">
          {notes.map((n) => (
            <Link key={n.id} to={`/notes/${n.id}`} className="list-item">
              <span className="grow">{n.title || 'Untitled note'}</span>
              <span className="tiny muted">{relDays(fmtISO(n.updatedAt))}</span>
            </Link>
          ))}
        </div>
      )}
    </Panel>
  );
}

const fmtISO = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function MistakesCard({ data, subject }: { data: AllData; subject: Subject }) {
  const topic = new Map(data.topics.map((t) => [t.id, t.name]));
  const open = data.mistakes.filter((m) => m.subjectId === subject.id && !m.cleared).sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <Panel
      index={7}
      title="Open mistakes"
      aside={
        <Link to={`/mistakes?subject=${subject.id}`} className="muted">
          All mistakes
        </Link>
      }
    >
      {open.length === 0 ? (
        <Empty text="Nothing open. Every mistake here is cleared." action={<Button size="sm" onClick={() => openUI({ quickAdd: { preset: { subjectId: subject.id } } })}>Add mistake</Button>} />
      ) : (
        <div className="list">
          {open.slice(0, 6).map((m) => (
            <Link key={m.id} to={`/mistakes?subject=${subject.id}&open=${m.id}`} className="list-item">
              <span className="grow">
                {m.source}
                {m.topicId && <span className="muted"> · {topic.get(m.topicId)}</span>}
              </span>
              <ErrorPill value={m.errorType} />
              <WeaknessPill value={m.weakness} />
            </Link>
          ))}
          {open.length > 6 && (
            <Link to={`/mistakes?subject=${subject.id}`} className="list-item muted small">
              {open.length - 6} more…
            </Link>
          )}
        </div>
      )}
    </Panel>
  );
}

function PapersCard({ data, subject }: { data: AllData; subject: Subject }) {
  const papers = subjectPapers(data, subject.id);
  const recent = [...papers].reverse().slice(0, 6);
  return (
    <Panel
      index={8}
      title="Marks"
      className="aura-blue"
      aside={
        <Link to={`/papers?subject=${subject.id}`} className="muted">
          All tests
        </Link>
      }
    >
      {papers.length === 0 ? (
        <Empty text="No papers logged yet." action={<Button size="sm" onClick={() => openUI({ logPaper: { preset: { subjectId: subject.id } } })}>Log a paper</Button>} />
      ) : (
        <div className="grid-2" style={{ alignItems: 'center' }}>
          <div style={{ height: '11rem' }}>
            <MultiLine series={[{ id: subject.id, colour: subject.colour, values: papers.map(pct) }]} labels={papers.map((p) => fmtDay(p.date))} target={subject.targetPct} focus={subject.id} />
          </div>
          <div className="list">
            {recent.map((p) => (
              <Link key={p.id} to={`/papers?subject=${subject.id}&open=${p.id}`} className="list-item">
                <span className="grow">{paperLabel(p)}</span>
                <span className="tiny muted">{fmtDay(p.date)}</span>
                <span className="num" style={{ fontWeight: 600, width: 48, textAlign: 'right' }}>
                  {Math.round(pct(p))}%
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}
