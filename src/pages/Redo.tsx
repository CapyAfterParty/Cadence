import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, RotateCcw, X } from 'lucide-react';
import { useData, type AllData } from '../db/db';
import { courseTitle, splitCourse } from '../lib/course';
import type { ID, Mistake, Subject } from '../db/types';
import { recordAttempt } from '../db/ops';
import { relDays } from '../lib/dates';
import { activeSubjects, isDue, lastAttemptMap, sortForRedo } from '../lib/stats';
import { settings } from '../lib/state';
import { Button, Empty, ErrorPill, PageSkeleton, WeaknessPill } from '../components/ui';
import { DotNum, Glass, GlassHead, Panel } from '../components/glass';
import './pages.css';
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
      {subjects.length === 0 ? (
        <Panel>
          <Empty text="Add a course first." action={<Link to="/subjects" className="btn sm">Courses</Link>} />
        </Panel>
      ) : (
        <div className="redo-pick">
          {subjects.map((s, i) => {
            const open = data.mistakes.filter((m) => m.subjectId === s.id && !m.cleared);
            const due = open.filter((m) => isDue(m, last, st.redoDays)).length;
            return (
              <Glass key={s.id} tone="course" colour={s.colour} index={i}>
                <GlassHead title={<span className="glass-tag">{splitCourse(s.name).code ?? 'Course'}</span>} />
                <span className="cc-title">{courseTitle(s.name)}</span>
                <div className="cc-mid">
                  <DotNum big className="lead">
                    {due}
                  </DotNum>
                  <span className="label-dim">due · {open.length} open</span>
                </div>
                <button type="button" className="white-pill" onClick={() => nav(`/redo?subject=${s.id}`)} disabled={!open.length}>
                  <RotateCcw size={14} strokeWidth={2} /> {open.length ? 'Redo' : 'All clear'}
                </button>
              </Glass>
            );
          })}
        </div>
      )}
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
  const topicName = new Map(data.topics.map((t) => [t.id, t.name]));
  const candidates = sortForRedo(
    data.mistakes.filter(
      (m) => m.subjectId === subjectId && !m.cleared && (!topicId || m.topicId === topicId) && (scope === 'all' || isDue(m, last, st.redoDays)),
    ),
    last,
  );

  if (queue) return <Session data={data} ids={queue} subject={subject} onDone={() => setQueue(null)} />;

  return (
    <div className="page">
      <Topbar eyebrow="Mistakes" title={`Redo · ${courseTitle(subject.name)}`}>
        <Link to="/redo" className="btn">
          Change course
        </Link>
      </Topbar>
      <div className="split wide-right">
        <Glass tone="course" colour={subject.colour} index={0} className="redo-ready">
          <GlassHead title="Ready">
            <div className="glass-tabs inline">
              <button type="button" className={scope === 'all' ? 'on' : undefined} onClick={() => setScope('all')}>
                All open
              </button>
              <button type="button" className={scope === 'due' ? 'on' : undefined} onClick={() => setScope('due')}>
                Only due
              </button>
            </div>
          </GlassHead>
          <DotNum big className="lead">
            {candidates.length}
          </DotNum>
          <span className="label-dim">{candidates.length === 1 ? 'mistake to redo' : 'mistakes to redo'}, most overdue first</span>
          <div className="redo-topic">
            <TopicSelect data={data} subjectId={subjectId} value={topicId} onChange={setTopicId} allowAny />
          </div>
          <span className="label-dim">Redo each one on paper, then reveal the fix. Right clears it; wrong keeps it in the queue.</span>
          {candidates.length ? (
            <button type="button" className="white-pill big" onClick={() => setQueue(candidates.map((m) => m.id))}>
              <RotateCcw size={16} strokeWidth={2} /> Start redo
            </button>
          ) : (
            <Link className="white-pill" to={`/subjects/${subjectId}`}>
              Nothing here. Back to {courseTitle(subject.name)}
            </Link>
          )}
        </Glass>
        <Panel index={1} title="In the queue" aside={`${candidates.length}`} className="aura-violet">
          {candidates.length === 0 ? (
            <Empty text="Nothing to redo here. Nice." />
          ) : (
            <div className="queue">
              {candidates.slice(0, 10).map((m, i) => {
                const l = last.get(m.id);
                return (
                  <div key={m.id} className="q-row">
                    <span className="q-n num">{String(i + 1).padStart(2, '0')}</span>
                    <span className="q-main">
                      {m.source}
                      <small>{m.topicId ? topicName.get(m.topicId) : 'No topic'} · last {l ? relDays(l) : 'never'}</small>
                    </span>
                    <ErrorPill value={m.errorType} />
                    <WeaknessPill value={m.weakness} />
                  </div>
                );
              })}
              {candidates.length > 10 && <span className="label-dim">and {candidates.length - 10} more</span>}
            </div>
          )}
        </Panel>
      </div>
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

function Session({ data, ids, subject, onDone }: { data: AllData; ids: ID[]; subject: Subject; onDone: () => void }) {
  const subjectName = courseTitle(subject.name);
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
        <Topbar eyebrow="Redo" title={subjectName} />
        <div className="split">
          <Glass tone="course" colour={subject.colour} index={0} className="redo-done">
            <GlassHead title="Session done" />
            <div className="trend-figs">
              <div>
                <DotNum big className="lead">
                  {right.length}
                </DotNum>
                <span className="label-dim">right, now cleared</span>
              </div>
              <div>
                <DotNum big className="lead">
                  {wrong.length}
                </DotNum>
                <span className="label-dim">wrong, still queued</span>
              </div>
            </div>
            <div className="hero-foot row">
              <button type="button" className="white-pill" onClick={onDone}>
                Back to redo
              </button>
              <Link to="/" className="dark-pill">
                Today
              </Link>
            </div>
          </Glass>
          <Panel index={1} title="Still to fix" aside={`${wrong.length}`}>
            {wrong.length === 0 ? (
              <Empty text="Everything you tried was right." />
            ) : (
              <div className="list">
                {wrong.map(({ m }) => (
                  <Link key={m.id} to={`/mistakes?subject=${m.subjectId}&open=${m.id}`} className="list-item">
                    <span className="grow">{m.source}</span>
                    {m.topicId && <span className="small muted">{topicName.get(m.topicId)}</span>}
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    );
  }

  const l = last.get(m.id);
  return (
    <div className="page">
      <Topbar eyebrow="Redo" title={subjectName}>
        <span className="small muted num">
          {i + 1} of {items.length}
        </span>
        <Button variant="ghost" onClick={() => setI(items.length)}>
          End
        </Button>
      </Topbar>
      <section className="redo-stage" key={m.id} style={{ ['--c' as string]: subject.colour }}>
        <div className="rs-progress">
          {items.map((it, k) => (
            <span key={it.id} className={k < i ? (results[k]?.correct ? 'rp ok' : 'rp bad') : k === i ? 'rp now' : 'rp'} />
          ))}
        </div>
        <div className="row">
          {m.topicId && <span className="glass-tag">{topicName.get(m.topicId)}</span>}
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
            <div className="rs-actions">
              <button type="button" className="dark-pill big" onClick={() => mark(false)}>
                <X size={16} strokeWidth={2} /> Wrong
              </button>
              <button type="button" className="white-pill big" onClick={() => mark(true)}>
                <Check size={16} strokeWidth={2} /> Right
              </button>
            </div>
            <p className="tiny muted" style={{ textAlign: 'center' }}>
              ← wrong · → right
            </p>
          </>
        ) : (
          <>
            <p className="muted">Redo the question on paper. Then check the fix.</p>
            <div className="rs-actions">
              <button type="button" className="white-pill big" autoFocus onClick={() => setRevealed(true)}>
                Reveal fix
              </button>
            </div>
            <p className="tiny muted" style={{ textAlign: 'center' }}>
              Space to reveal
            </p>
          </>
        )}
      </section>
    </div>
  );
}
