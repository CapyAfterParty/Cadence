import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { db, newRow, useData, type AllData } from '../db/db';
import { ERROR_TYPES, ORIGINS, WEAKNESSES, type ErrorType, type ID, type Mistake, type MistakeOrigin, type Weakness } from '../db/types';
import { todayKey } from '../lib/dates';
import { rememberSubject, settings, toast, ui } from '../lib/state';
import { Button, Field, Modal, WeaknessPill, nextWeakness } from '../components/ui';
import { SubjectSelect, TopicSelect } from '../components/pickers';

export const paperLabel = (p: { name: string; year?: string }) => [p.year, p.name].filter(Boolean).join(' ');

function rememberChoices(subjectId: ID, errorType: ErrorType, weakness: Weakness, origin: MistakeOrigin) {
  rememberSubject(subjectId);
  settings.set((s) => ({ ...s, lastErrorType: errorType, lastWeakness: weakness, lastOrigin: origin }));
}

/* ---------- Quick add: one mistake, from anywhere (N) ---------- */

export function QuickAddMistake({ preset }: { preset?: Partial<Mistake> }) {
  const data = useData();
  const close = () => ui.set((s) => ({ ...s, quickAdd: null }));
  if (!data) return null;
  return <QuickAddForm data={data} preset={preset} close={close} />;
}

function QuickAddForm({ data, preset, close }: { data: AllData; preset?: Partial<Mistake>; close: () => void }) {
  const st = settings.get();
  const firstSubject = data.subjects.find((s) => !s.archived)?.id ?? '';
  const [m, setM] = useState({
    subjectId: preset?.subjectId && data.subjects.some((s) => s.id === preset.subjectId) ? preset.subjectId : firstSubject,
    origin: preset?.origin ?? st.lastOrigin,
    source: preset?.source ?? '',
    topicId: preset?.topicId as ID | undefined,
    errorType: preset?.errorType ?? st.lastErrorType,
    weakness: preset?.weakness ?? st.lastWeakness,
    fix: '',
    date: todayKey(),
    paperId: preset?.paperId,
  });
  const [tried, setTried] = useState(false);
  const set = (patch: Partial<typeof m>) => setM((x) => ({ ...x, ...patch }));
  const errors = { subject: !m.subjectId ? 'Pick a course' : '', source: !m.source.trim() ? 'Say where it came from' : '' };

  const save = async (again: boolean) => {
    setTried(true);
    if (errors.subject || errors.source) return;
    const row = newRow<Mistake>({ ...m, source: m.source.trim(), fix: m.fix.trim(), cardMade: false, cleared: false });
    await db.mistakes.add(row);
    rememberChoices(m.subjectId, m.errorType, m.weakness, m.origin);
    toast('Mistake added', () => db.mistakes.delete(row.id));
    if (again) {
      set({ source: '', fix: '' });
      setTried(false);
    } else close();
  };

  if (!firstSubject) return <NoSubjects close={close} />;

  return (
    <Modal title="Add mistake" onClose={close}>
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          save(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save(false);
        }}
      >
        <Field label="Course" error={tried ? errors.subject : ''}>
          <SubjectSelect data={data} value={m.subjectId} onChange={(subjectId) => set({ subjectId, topicId: undefined })} />
        </Field>
        <Field label="From">
          <select className="select" value={m.origin} onChange={(e) => set({ origin: e.target.value as MistakeOrigin })}>
            {ORIGINS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Source" className="span-2" error={tried ? errors.source : ''}>
          <input
            autoFocus
            className={tried && errors.source ? 'input invalid' : 'input'}
            placeholder="2024 Paper 2, Q4"
            value={m.source}
            onChange={(e) => set({ source: e.target.value })}
          />
        </Field>
        <Field label="Topic">
          <TopicSelect data={data} subjectId={m.subjectId} value={m.topicId} onChange={(topicId) => set({ topicId })} />
        </Field>
        <Field label="Error type">
          <select className="select" value={m.errorType} onChange={(e) => set({ errorType: e.target.value as ErrorType })}>
            {ERROR_TYPES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Correct fix" className="span-2">
          <textarea className="textarea" placeholder="What the right answer or method is" value={m.fix} onChange={(e) => set({ fix: e.target.value })} />
        </Field>
        <div className="field">
          <span className="field-label">Weakness</span>
          <div className="row">
            {WEAKNESSES.map((w) => (
              <button key={w} type="button" className={m.weakness === w ? `pill ${w}` : 'pill'} onClick={() => set({ weakness: w })} aria-pressed={m.weakness === w}>
                {w[0].toUpperCase() + w.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <Field label="Date">
          <input type="date" className="input" value={m.date} onChange={(e) => set({ date: e.target.value || todayKey() })} />
        </Field>
        <div className="modal-foot span-2" style={{ marginTop: 8 }}>
          <span className="tiny muted" style={{ marginRight: 'auto' }}>
            Ctrl+Enter to add
          </span>
          <Button onClick={() => save(true)}>Add another</Button>
          <Button type="submit" variant="primary">
            Add
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function NoSubjects({ close }: { close: () => void }) {
  return (
    <Modal title="Add a course first" onClose={close}>
      <p className="muted">Mistakes belong to a course. Add one in Courses first.</p>
      <div className="modal-foot">
        <Button
          variant="primary"
          onClick={() => {
            close();
            location.hash = '#/subjects';
          }}
        >
          Go to Courses
        </Button>
      </div>
    </Modal>
  );
}

/* ---------- Bulk entry: type question numbers, fill one table ---------- */

interface BulkRow {
  q: string;
  topicId?: ID;
  errorType: ErrorType;
  weakness: Weakness;
  fix: string;
}

const parseQuestions = (s: string) =>
  Array.from(new Set(s.split(/[,\s;]+/).map((x) => x.trim().replace(/^q/i, '')).filter(Boolean)));

export function BulkMistakes({ subjectId, paperId }: { subjectId?: ID; paperId?: ID }) {
  const data = useData();
  const close = () => ui.set((s) => ({ ...s, bulk: null }));
  if (!data) return null;
  return <BulkForm data={data} initialSubject={subjectId} initialPaper={paperId} close={close} />;
}

function BulkForm({ data, initialSubject, initialPaper, close }: { data: AllData; initialSubject?: ID; initialPaper?: ID; close: () => void }) {
  const st = settings.get();
  const paper0 = data.papers.find((p) => p.id === initialPaper);
  const firstSubject = paper0?.subjectId ?? (initialSubject && data.subjects.some((s) => s.id === initialSubject) ? initialSubject : data.subjects.find((s) => !s.archived)?.id ?? '');
  const [subjectId, setSubjectId] = useState<ID>(firstSubject);
  const [paperId, setPaperId] = useState<ID | ''>(paper0?.id ?? '');
  const [prefix, setPrefix] = useState('');
  const [origin, setOrigin] = useState<MistakeOrigin>(paper0 ? 'paper' : st.lastOrigin);
  const [qText, setQText] = useState('');
  const [rows, setRows] = useState<Record<string, BulkRow>>({});
  const [tried, setTried] = useState(false);

  const papers = useMemo(
    () => data.papers.filter((p) => p.subjectId === subjectId).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [data.papers, subjectId],
  );
  const paper = papers.find((p) => p.id === paperId);
  const qs = parseQuestions(qText);
  const rowFor = (q: string): BulkRow => rows[q] ?? { q, errorType: st.lastErrorType, weakness: st.lastWeakness, fix: '' };
  const update = (q: string, patch: Partial<BulkRow>) => setRows((r) => ({ ...r, [q]: { ...rowFor(q), ...patch } }));
  const setAll = (patch: Partial<BulkRow>) => setRows(() => Object.fromEntries(qs.map((q) => [q, { ...rowFor(q), ...patch }])));
  const base = paper ? paperLabel(paper) : prefix.trim();

  const save = async () => {
    setTried(true);
    if (!subjectId || !qs.length || !base) return;
    const list = qs.map((q) => {
      const r = rowFor(q);
      return newRow<Mistake>({
        subjectId,
        paperId: paper?.id,
        origin: paper ? 'paper' : origin,
        source: `${base}, Q${q}`,
        topicId: r.topicId,
        errorType: r.errorType,
        weakness: r.weakness,
        fix: r.fix.trim(),
        date: paper?.date ?? todayKey(),
        cardMade: false,
        cleared: false,
      });
    });
    await db.mistakes.bulkAdd(list);
    const lastRow = rowFor(qs[qs.length - 1]);
    rememberChoices(subjectId, lastRow.errorType, lastRow.weakness, paper ? 'paper' : origin);
    toast(`${list.length} mistakes added`, () => db.mistakes.bulkDelete(list.map((x) => x.id)));
    close();
  };

  if (!firstSubject) return <NoSubjects close={close} />;

  return (
    <Modal title={paper ? `Log mistakes · ${paperLabel(paper)}` : 'Bulk add mistakes'} onClose={close} wide>
      <div className="stack">
        <div className="grid-3">
          <Field label="Course">
            <SubjectSelect
              data={data}
              value={subjectId}
              onChange={(id) => {
                setSubjectId(id);
                setPaperId('');
                setRows({});
              }}
            />
          </Field>
          <Field label="Paper">
            <select className="select" value={paperId} onChange={(e) => setPaperId(e.target.value)}>
              <option value="">Not from a logged paper</option>
              {papers.map((p) => (
                <option key={p.id} value={p.id}>
                  {paperLabel(p)} · {p.date}
                </option>
              ))}
            </select>
          </Field>
          {paper ? (
            <Field label="Source">
              <input className="input" value={paperLabel(paper)} disabled />
            </Field>
          ) : (
            <Field label="Source" error={tried && !base ? 'Name the source' : ''}>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <select className="select" style={{ width: 130 }} value={origin} onChange={(e) => setOrigin(e.target.value as MistakeOrigin)} aria-label="From">
                  {ORIGINS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <input className="input" placeholder="Class test 3" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
              </div>
            </Field>
          )}
        </div>
        <Field label="Question numbers" error={tried && !qs.length ? 'Type at least one question number' : ''}>
          <input autoFocus className="input" placeholder="4, 5, 7a, 14b" value={qText} onChange={(e) => setQText(e.target.value)} />
        </Field>

        {qs.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Q</th>
                  <th>Topic</th>
                  <th>Error type</th>
                  <th>Weakness</th>
                  <th style={{ width: '34%' }}>Fix (optional)</th>
                  <th />
                </tr>
                <tr>
                  <td className="tiny muted">All</td>
                  <td>
                    <TopicSelect data={data} subjectId={subjectId} value={undefined} size="sm" onChange={(topicId) => setAll({ topicId })} />
                  </td>
                  <td>
                    <select className="select sm" value="" onChange={(e) => e.target.value && setAll({ errorType: e.target.value as ErrorType })}>
                      <option value="">Set all…</option>
                      {ERROR_TYPES.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.short}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td />
                  <td />
                  <td />
                </tr>
              </thead>
              <tbody>
                {qs.map((q) => {
                  const r = rowFor(q);
                  return (
                    <tr key={q}>
                      <td className="num" style={{ fontWeight: 600 }}>
                        Q{q}
                      </td>
                      <td>
                        <TopicSelect data={data} subjectId={subjectId} value={r.topicId} size="sm" onChange={(topicId) => update(q, { topicId })} />
                      </td>
                      <td>
                        <select className="select sm" value={r.errorType} onChange={(e) => update(q, { errorType: e.target.value as ErrorType })}>
                          {ERROR_TYPES.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.short}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <WeaknessPill value={r.weakness} onClick={() => update(q, { weakness: nextWeakness(r.weakness) })} />
                      </td>
                      <td>
                        <input className="input sm" value={r.fix} onChange={(e) => update(q, { fix: e.target.value })} placeholder="Correct fix" />
                      </td>
                      <td>
                        <Button
                          icon
                          size="sm"
                          variant="ghost"
                          aria-label={`Remove Q${q}`}
                          onClick={() => setQText(qs.filter((x) => x !== q).join(', '))}
                        >
                          <Trash2 size={14} strokeWidth={1.5} />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="modal-foot">
        <Button onClick={close}>Cancel</Button>
        <Button variant="primary" onClick={save}>
          Add {qs.length || ''} {qs.length === 1 ? 'mistake' : 'mistakes'}
        </Button>
      </div>
    </Modal>
  );
}
