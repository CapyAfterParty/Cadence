import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, RotateCcw, X } from 'lucide-react';
import { useData, type AllData } from '../db/db';
import { courseTitle } from '../lib/course';
import type { ID, Mistake } from '../db/types';
import { recordAttempt } from '../db/ops';
import { relDays } from '../lib/dates';
import { activeSubjects, isDue, lastAttemptMap, sortForRedo } from '../lib/stats';
import { settings } from '../lib/state';
import { Button, Card, Chip, Empty, ErrorPill, PageSkeleton, Progress, Segmented, Stat, WeaknessPill } from '../components/ui';
import { Topbar } from '../components/Topbar';
import { TopicSelect } from '../components/pickers';
import { useScans } from '../components/Scans';

export default function Redo() {
  const data = useData();
  const [params] = useSearchParams();
  const subjectId = params.get('subject') ?? '';
  if (!data) return <PageSkeleton />;
  const subject = data.subjects.find((s) => s.id === subjectId);
  return subject ? <Setup key={subject.id} data={data} subjectId={subject.id} topicParam={params.get('topic') ?? undefined} /> : <PickSubject data={data} />;
}

function PickSubject({ data }: { data: AllData }) {
  const nav = useNavigate();
  const st = settings.use();
  const last = lastAttemptMap(data.attempts);
  const subjects = activeSubjects(data);
  return (
    <div className="page">
      <Topbar eyebrow="Mistakes" title="Redo" />
      <Card>
        <h2 style={{ fontSize: 'var(--fs-17)', fontWeight: 600, marginBottom: 16 }}>Pick a course</h2>
        {subjects.length === 0 ? (
          <Empty text="Add a course first." action={<Link to="/subjects" className="btn sm">Courses</Link>} />
        ) : (
          <div className="list">
            {subjects.map((s) => {
              const open = data.mistakes.filter((m) => m.subjectId === s.id && !m.cleared);
              const due = open.filter((m) => isDue(m, last, st.redoDays)).length;
              return (
                <button key={s.id} type="button" className="list-item" onClick={() => nav(`/redo?subject=${s.id}`)} disabled={!open.length}>
                  <span className="subject-dot" style={{ background: s.colour }} />
                  <span className="grow">{s.name}</span>
                  <span className="small muted">
                    {open.length} open · {due} due
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function Setup({ data, subjectId, topicParam }: { data: AllData; subjectId: ID; topicParam?: ID }) {
  const st = settings.use();
  const [topicId, setTopicId] = useState<ID | undefined>(topicParam);
  const [scope, setScope] = useState<'all' | 'due'>('all');
  const [queue, setQueue] = useState<ID[] | null>(null);
  const subject = data.subjects.find((s) => s.id === subjectId)!;
  const last = useMemo(() => lastAttemptMap(data.attempts), [data.attempts]);
  const candidates = sortForRedo(
    data.mistakes.filter(
      (m) => m.subjectId === subjectId && !m.cleared && (!topicId || m.topicId === topicId) && (scope === 'all' || isDue(m, last, st.redoDays)),
    ),
    last,
  );

  if (queue) return <Session data={data} ids={queue} subjectName={subject.name} onDone={() => setQueue(null)} />;

  return (
    <div className="page">
      <Topbar eyebrow="Mistakes" title={`Redo · ${courseTitle(subject.name)}`}>
        <Link to="/redo" className="btn">
          Change subject
        </Link>
      </Topbar>
      <Card className="redo-card">
        <div className="row-between">
          <Stat value={candidates.length} label={candidates.length === 1 ? 'mistake to redo' : 'mistakes to redo'} />
          <Segmented
            label="Scope"
            value={scope}
            onChange={setScope}
            options={[
              { value: 'all', label: 'All open' },
              { value: 'due', label: 'Only due' },
            ]}
          />
        </div>
        <div style={{ maxWidth: 280 }}>
          <TopicSelect data={data} subjectId={subjectId} value={topicId} onChange={setTopicId} allowAny />
        </div>
        <p className="muted small">Most overdue first. Mark each one right or wrong. Right clears it; wrong keeps it in the queue.</p>
        {candidates.length ? (
          <Button variant="primary" size="lg" onClick={() => setQueue(candidates.map((m) => m.id))}>
            <RotateCcw size={18} strokeWidth={1.5} /> Start redo
          </Button>
        ) : (
          <Empty text="Nothing to redo here. Nice." action={<Link className="btn sm" to={`/subjects/${subjectId}`}>Back to {subject.name}</Link>} />
        )}
      </Card>
    </div>
  );
}

function QuestionScans({ mistakeId }: { mistakeId: ID }) {
  const scans = useScans('mistake', mistakeId);
  const urls = useMemo(() => (scans ?? []).filter((s) => s.blob.type.startsWith('image/')).map((s) => URL.createObjectURL(s.blob)), [scans]);
  useEffect(() => () => urls.forEach(URL.revokeObjectURL), [urls]);
  if (!urls.length) return null;
  return (
    <div className="row">
      {urls.map((u) => (
        <img key={u} src={u} alt="Question scan" style={{ maxHeight: 240, maxWidth: '100%', borderRadius: 14 }} />
      ))}
    </div>
  );
}

function Session({ data, ids, subjectName, onDone }: { data: AllData; ids: ID[]; subjectName: string; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<{ m: Mistake; correct: boolean }[]>([]);
  // Freeze the mistakes at session start so clearing one does not reshuffle the queue.
  const [items] = useState(() => ids.map((id) => data.mistakes.find((m) => m.id === id)!).filter(Boolean));
  const last = lastAttemptMap(data.attempts);
  const topicName = new Map(data.topics.map((t) => [t.id, t.name]));
  const m = items[i];

  const mark = async (correct: boolean) => {
    if (!m) return;
    await recordAttempt(m, correct);
    setResults((r) => [...r, { m, correct }]);
    setRevealed(false);
    setI((x) => x + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (!m) return;
      if (e.key === ' ' && !revealed) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed && (e.key === 'ArrowRight' || e.key === '1')) mark(true);
      else if (revealed && (e.key === 'ArrowLeft' || e.key === '2')) mark(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!m) {
    const right = results.filter((r) => r.correct);
    const wrong = results.filter((r) => !r.correct);
    return (
      <div className="page">
        <Topbar title={`Redo · ${subjectName}`} />
        <Card className="redo-card">
          <h2 style={{ fontSize: 'var(--fs-24)', fontWeight: 600 }}>Session done</h2>
          <div className="grid-2">
            <Stat value={right.length} label="Right, now cleared" />
            <Stat value={wrong.length} label="Wrong, still in the queue" accent={wrong.length > 0} />
          </div>
          {wrong.length > 0 && (
            <div>
              <div className="field-label" style={{ marginBottom: 8 }}>
                Still to fix
              </div>
              <div className="list">
                {wrong.map(({ m }) => (
                  <Link key={m.id} to={`/mistakes?subject=${m.subjectId}&open=${m.id}`} className="list-item">
                    <span className="grow">{m.source}</span>
                    {m.topicId && <span className="small muted">{topicName.get(m.topicId)}</span>}
                  </Link>
                ))}
              </div>
            </div>
          )}
          <div className="row">
            <Button variant="primary" onClick={onDone}>
              Back to redo
            </Button>
            <Link to="/" className="btn">
              Home
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const l = last.get(m.id);
  return (
    <div className="page">
      <Topbar title={`Redo · ${subjectName}`}>
        <span className="small muted num">
          {i + 1} of {items.length}
        </span>
        <Button variant="ghost" onClick={() => setI(items.length)}>
          End
        </Button>
      </Topbar>
      <div style={{ maxWidth: 720, width: '100%', margin: '0 auto' }}>
        <Progress value={(i / items.length) * 100} />
      </div>
      <Card className="redo-card" key={m.id}>
        <div className="row">
          {m.topicId && <Chip>{topicName.get(m.topicId)}</Chip>}
          <ErrorPill value={m.errorType} />
          <WeaknessPill value={m.weakness} />
          <span className="tiny muted" style={{ marginLeft: 'auto' }}>
            Last redone: {l ? relDays(l) : 'never'}
          </span>
        </div>
        <div className="redo-source">{m.source}</div>
        <QuestionScans mistakeId={m.id} />
        {revealed ? (
          <>
            <div className="redo-fix">{m.fix || <span className="muted">No fix written for this one.</span>}</div>
            <div className="redo-actions">
              <Button size="lg" className="wrong" onClick={() => mark(false)}>
                <X size={18} strokeWidth={1.5} /> Wrong
              </Button>
              <Button size="lg" className="right" onClick={() => mark(true)}>
                <Check size={18} strokeWidth={1.5} /> Right
              </Button>
            </div>
            <p className="tiny muted" style={{ textAlign: 'center' }}>
              ← wrong · → right
            </p>
          </>
        ) : (
          <>
            <p className="muted">Redo the question on paper. Then check the fix.</p>
            <Button size="lg" variant="white" autoFocus onClick={() => setRevealed(true)}>
              Reveal fix
            </Button>
            <p className="tiny muted" style={{ textAlign: 'center' }}>
              Space to reveal
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
