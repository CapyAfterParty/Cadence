import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CircleAlert, FileText, ImagePlus, ListPlus, NotebookPen, Play, Plus, RotateCcw, Settings2, Target, X } from 'lucide-react';
import { db, newRow, useData, type AllData } from '../db/db';
import { courseTitle, splitCourse } from '../lib/course';
import type { Note, Subject, Topic, Weakness } from '../db/types';
import { createTopic, deleteTopic } from '../db/ops';
import { daysBetween, fmtDay, relDays, todayKey } from '../lib/dates';
import { dueMistakes, pct, subjectAverage, subjectPapers, topicWeakness } from '../lib/stats';
import { openUI, rememberSubject, settings } from '../lib/state';
import { Button, Card, CardHead, Chip, Empty, ErrorPill, PageSkeleton, Stat, WeaknessPill } from '../components/ui';
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

  const addNote = async () => {
    const note = newRow<Note>({ subjectId: subject.id, title: '', body: '', updatedAt: Date.now() });
    await db.notes.add(note);
    nav(`/notes/${note.id}`);
  };
  const preset = { subjectId: subject.id };
  useEffect(() => rememberSubject(subject.id), [subject.id]);

  return (
    <div className="page">
      <Topbar
        eyebrow={splitCourse(subject.name).code ?? 'Course'}
        title={
          <span className="row" style={{ gap: 12 }}>
            <span className="swatch-sm" style={{ background: `linear-gradient(150deg, color-mix(in srgb, ${subject.colour} 65%, white), ${subject.colour} 55%, color-mix(in srgb, ${subject.colour} 75%, black))`, ['--c' as string]: subject.colour }} />
            {courseTitle(subject.name)}
            {subject.archived && <span className="pill">Archived</span>}
          </span>
        }
      />

      <div className="grid-4">
        <Card index={0} tint={subject.colour}>
          <Stat value={avg == null ? null : Math.round(avg)} unit="%" label={`Average · target ${subject.targetPct}%`} accent={avg != null && avg < subject.targetPct} />
        </Card>
        <Card index={1}>
          <Stat
            value={days == null || days < 0 ? null : days}
            unit={days === 1 ? 'day' : 'days'}
            label={subject.nextTestDate ? `Until test · ${fmtDay(subject.nextTestDate)}` : 'No test date set'}
          />
        </Card>
        <Card index={2}>
          <Stat value={open.length} label="Open mistakes" />
        </Card>
        <Card index={3}>
          <Stat value={due.length} label="Due for redo" />
        </Card>
      </div>

      <div className="row">
        <Button variant="primary" onClick={() => nav(`/redo?subject=${subject.id}`)} disabled={!open.length}>
          <RotateCcw size={16} strokeWidth={SW} /> Start redo
        </Button>
        <Button variant="ghost" onClick={() => openUI({ quickAdd: { preset } })}>
          <Plus size={16} strokeWidth={SW} /> Add mistake
        </Button>
        <Button variant="ghost" onClick={() => openUI({ bulk: preset })}>
          <ListPlus size={16} strokeWidth={SW} /> Bulk add
        </Button>
        <Button variant="ghost" onClick={() => openUI({ logPaper: { preset } })}>
          <FileText size={16} strokeWidth={SW} /> Log a test
        </Button>
        <Button variant="ghost" onClick={addNote}>
          <NotebookPen size={16} strokeWidth={SW} /> Add note
        </Button>
        <Button variant="ghost" onClick={() => startStudy(subject.id)}>
          <Play size={16} strokeWidth={SW} /> Start timer
        </Button>
        <ScanUploadButton ownerType="subject" ownerId={subject.id} quiet />
      </div>

      <div className="grid-2">
        <TopicsCard data={data} subject={subject} />
        <Card index={5}>
          <CardHead icon={<Settings2 size={18} strokeWidth={SW} />} title="Details" aside="Saves as you type" />
          <SubjectEditor subject={subject} />
        </Card>
      </div>

      <div className="grid-2">
        <NotesCard data={data} subject={subject} onAdd={addNote} />
        <MistakesCard data={data} subject={subject} />
      </div>

      <PapersCard data={data} subject={subject} />

      <Card index={9}>
        <CardHead icon={<ImagePlus size={18} strokeWidth={SW} />} tone="gold" title="Scans" />
        <ScanGrid ownerType="subject" ownerId={subject.id} emptyText="Upload scans of notes or marked work." />
      </Card>
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
    <Card index={4}>
      <CardHead icon={<Target size={18} strokeWidth={SW} />} tone="ember" title="Weakest topics" aside="Click a topic to set its colour by hand" />
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
    </Card>
  );
}

function NotesCard({ data, subject, onAdd }: { data: AllData; subject: Subject; onAdd: () => void }) {
  const notes = data.notes.filter((n) => n.subjectId === subject.id).sort((a, b) => b.updatedAt - a.updatedAt);
  return (
    <Card index={6}>
      <CardHead icon={<NotebookPen size={18} strokeWidth={SW} />} tone="orchid" title="Notes" aside={`${notes.length}`} />
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
    </Card>
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
    <Card index={7}>
      <CardHead
        icon={<CircleAlert size={18} strokeWidth={SW} />}
        tone="coral"
        title="Open mistakes"
        aside={
          <Link to={`/mistakes?subject=${subject.id}`} className="muted">
            All mistakes
          </Link>
        }
      />
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
    </Card>
  );
}

function PapersCard({ data, subject }: { data: AllData; subject: Subject }) {
  const papers = subjectPapers(data, subject.id);
  const recent = [...papers].reverse().slice(0, 6);
  return (
    <Card index={8}>
      <CardHead
        icon={<FileText size={18} strokeWidth={SW} />}
        tone="lagoon"
        title="Tests"
        aside={
          <Link to={`/papers?subject=${subject.id}`} className="muted">
            All tests
          </Link>
        }
      />
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
    </Card>
  );
}
