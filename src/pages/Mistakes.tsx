import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, ListPlus, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { db, useData, type AllData } from '../db/db';
import { ERROR_TYPES, WEAKNESSES, errorLabel, type ErrorType, type Mistake, type Weakness } from '../db/types';
import { deleteMistakes } from '../db/ops';
import { fmtDay, relDays, todayKey } from '../lib/dates';
import { ankiCsv, downloadText, tagify } from '../lib/download';
import { isDue, lastAttemptMap, sortForRedo } from '../lib/stats';
import { openUI, settings, toast } from '../lib/state';
import { Button, Card, Empty, ErrorPill, PageSkeleton, Segmented, WeaknessPill, nextWeakness } from '../components/ui';
import { SubjectSelect, TopicSelect } from '../components/pickers';
import { Topbar } from '../components/Topbar';
import { AutoInput, AutoTextarea } from '../components/auto';
import { ScanGrid, ScanUploadButton } from '../components/Scans';

type Status = 'open' | 'due' | 'cleared' | 'all';
type Sort = 'due' | 'newest' | 'weakness';
const SW = 1.5;
const weakRank: Record<Weakness, number> = { high: 0, medium: 1, low: 2 };

export default function Mistakes() {
  const data = useData();
  if (!data) return <PageSkeleton />;
  return <MistakesView data={data} />;
}

function MistakesView({ data }: { data: AllData }) {
  const st = settings.use();
  const [params, setParams] = useSearchParams();
  const subjectId = params.get('subject') ?? '';
  const [topicId, setTopicId] = useState<string | undefined>();
  const [errorType, setErrorType] = useState<ErrorType | ''>('');
  const [weakness, setWeakness] = useState<Weakness | ''>('');
  const [status, setStatus] = useState<Status>(params.get('open') ? 'all' : ((params.get('status') as Status) ?? 'open'));
  const [sort, setSort] = useState<Sort>('due');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(params.get('open'));

  useEffect(() => {
    const open = params.get('open');
    if (open) {
      setExpanded(open);
      setTimeout(() => document.getElementById(`m-${open}`)?.scrollIntoView({ block: 'center' }), 50);
    }
  }, [params]);

  const today = todayKey();
  const last = useMemo(() => lastAttemptMap(data.attempts), [data.attempts]);
  const subjectName = new Map(data.subjects.map((s) => [s.id, s.name]));
  const topicName = new Map(data.topics.map((t) => [t.id, t.name]));

  const rows = useMemo(() => {
    const list = data.mistakes.filter(
      (m) =>
        (!subjectId || m.subjectId === subjectId) &&
        (!topicId || m.topicId === topicId) &&
        (!errorType || m.errorType === errorType) &&
        (!weakness || m.weakness === weakness) &&
        (status === 'all' ||
          (status === 'open' && !m.cleared) ||
          (status === 'cleared' && m.cleared) ||
          (status === 'due' && isDue(m, last, st.redoDays, today))),
    );
    if (sort === 'due') return sortForRedo(list, last);
    if (sort === 'weakness') return [...list].sort((a, b) => weakRank[a.weakness] - weakRank[b.weakness] || (a.date < b.date ? 1 : -1));
    return [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
  }, [data.mistakes, subjectId, topicId, errorType, weakness, status, sort, last, st.redoDays, today]);

  const setSubject = (id: string) => {
    const p = new URLSearchParams(params);
    if (id) p.set('subject', id);
    else p.delete('subject');
    p.delete('open');
    setParams(p, { replace: true });
    setTopicId(undefined);
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const chosen = data.mistakes.filter((m) => selected.has(m.id));

  const exportCsv = () => {
    const csv = ankiCsv(
      chosen.map((m) => {
        const topic = m.topicId ? topicName.get(m.topicId) : undefined;
        const subject = subjectName.get(m.subjectId) ?? '';
        return {
          front: `${topic ?? subject}: ${m.source}`,
          back: m.fix || '(add the fix)',
          tags: ['cadence', tagify(subject), topic ? tagify(topic) : '', m.errorType].filter(Boolean),
        };
      }),
    );
    downloadText(`cadence-anki-${today}.csv`, csv, 'text/csv');
    toast(`Exported ${chosen.length}. Import into Anki, then tick Card made.`);
  };

  const markCards = async () => {
    const ids = chosen.map((m) => m.id);
    await db.mistakes.where('id').anyOf(ids).modify({ cardMade: true });
    toast(`Card made ticked for ${ids.length}`, () => db.mistakes.where('id').anyOf(ids).modify({ cardMade: false }));
  };

  const redoLink = `/redo${subjectId ? `?subject=${subjectId}${topicId ? `&topic=${topicId}` : ''}` : ''}`;

  return (
    <div className="page">
      <Topbar title="Mistakes">
        <Button onClick={() => openUI({ bulk: { subjectId: subjectId || st.lastSubjectId } })}>
          <ListPlus size={16} strokeWidth={SW} /> Bulk add
        </Button>
        <Button onClick={() => openUI({ quickAdd: { preset: { subjectId: subjectId || st.lastSubjectId } } })}>
          <Plus size={16} strokeWidth={SW} /> Add
        </Button>
        <Link to={redoLink} className="btn primary">
          <RotateCcw size={16} strokeWidth={SW} /> Start redo
        </Link>
      </Topbar>

      <Card index={0}>
        <div className="row" style={{ gap: 12 }}>
          <div style={{ width: 180 }}>
            <SubjectSelect data={data} value={subjectId} onChange={setSubject} includeAll size="sm" />
          </div>
          <div style={{ width: 180 }}>
            <TopicSelect data={data} subjectId={subjectId} value={topicId} onChange={setTopicId} size="sm" allowAny />
          </div>
          <select className="select sm" style={{ width: 170 }} value={errorType} onChange={(e) => setErrorType(e.target.value as ErrorType | '')} aria-label="Error type">
            <option value="">All error types</option>
            {ERROR_TYPES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.short}
              </option>
            ))}
          </select>
          <select className="select sm" style={{ width: 150 }} value={weakness} onChange={(e) => setWeakness(e.target.value as Weakness | '')} aria-label="Weakness">
            <option value="">Any weakness</option>
            {WEAKNESSES.map((w) => (
              <option key={w} value={w}>
                {w[0].toUpperCase() + w.slice(1)}
              </option>
            ))}
          </select>
          <Segmented
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'open', label: 'Open' },
              { value: 'due', label: 'Due' },
              { value: 'cleared', label: 'Cleared' },
              { value: 'all', label: 'All' },
            ]}
          />
          <select className="select sm" style={{ width: 150, marginLeft: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
            <option value="due">Most overdue</option>
            <option value="newest">Newest</option>
            <option value="weakness">Weakest</option>
          </select>
        </div>
      </Card>

      <Card index={1}>
        {rows.length === 0 ? (
          <Empty
            text={data.mistakes.length ? 'No mistakes match these filters.' : 'No mistakes yet. Every one you log becomes practice.'}
            action={<Button size="sm" onClick={() => openUI({ quickAdd: { preset: { subjectId: subjectId || st.lastSubjectId } } })}>Add mistake</Button>}
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 32 }}>
                    <input
                      type="checkbox"
                      className="checkbox"
                      aria-label="Select all"
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                    />
                  </th>
                  <th>Source</th>
                  {!subjectId && <th>Subject</th>}
                  <th>Topic</th>
                  <th>Error</th>
                  <th>Weakness</th>
                  <th>Last redone</th>
                  <th>Card</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => {
                  const l = last.get(m.id);
                  const due = isDue(m, last, st.redoDays, today);
                  const open = expanded === m.id;
                  return (
                    <Fragment key={m.id}>
                      <tr id={`m-${m.id}`} className={open ? 'clickable expanded' : 'clickable'} onClick={() => setExpanded(open ? null : m.id)}>
                        <td onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" className="checkbox" aria-label={`Select ${m.source}`} checked={selected.has(m.id)} onChange={() => toggle(m.id)} />
                        </td>
                        <td style={{ fontWeight: 500 }}>
                          {m.source}
                          {m.cleared && <span className="pill green" style={{ marginLeft: 8 }}>Cleared</span>}
                        </td>
                        {!subjectId && <td className="muted">{subjectName.get(m.subjectId)}</td>}
                        <td className="muted">{m.topicId ? topicName.get(m.topicId) ?? '–' : '–'}</td>
                        <td>
                          <ErrorPill value={m.errorType} />
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <WeaknessPill value={m.weakness} onClick={() => db.mistakes.update(m.id, { weakness: nextWeakness(m.weakness) })} />
                        </td>
                        <td className={due ? '' : 'muted'}>
                          {l ? relDays(l, today) : 'Never'}
                          {due && <span className="pill accent" style={{ marginLeft: 8 }}>Due</span>}
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="checkbox"
                            aria-label="Card made"
                            checked={m.cardMade}
                            onChange={(e) => db.mistakes.update(m.id, { cardMade: e.target.checked })}
                          />
                        </td>
                        <td className="right" onClick={(e) => e.stopPropagation()}>
                          <Button icon size="sm" variant="ghost" aria-label="Delete mistake" onClick={() => deleteMistakes([m.id])}>
                            <Trash2 size={14} strokeWidth={SW} />
                          </Button>
                        </td>
                      </tr>
                      {open && (
                        <tr className="expanded">
                          <td colSpan={subjectId ? 8 : 9}>
                            <MistakeEditor data={data} m={m} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected.size > 0 && (
        <div className="bulkbar">
          <span className="small">{selected.size} selected</span>
          <Button size="sm" variant="primary" onClick={exportCsv}>
            <Download size={14} strokeWidth={SW} /> Export to Anki CSV
          </Button>
          <Button size="sm" onClick={markCards}>
            Tick Card made
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={async () => {
              await deleteMistakes([...selected]);
              setSelected(new Set());
            }}
          >
            Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}

function MistakeEditor({ data, m }: { data: AllData; m: Mistake }) {
  const up = (patch: Partial<Mistake>) => db.mistakes.update(m.id, patch);
  const attempts = data.attempts.filter((a) => a.mistakeId === m.id).sort((a, b) => b.createdAt - a.createdAt);
  return (
    <div className="grid-2" style={{ padding: '8px 0', alignItems: 'start' }} onClick={(e) => e.stopPropagation()}>
      <div className="stack">
        <div className="form-grid">
          <label className="field">
            <span className="field-label">Source</span>
            <AutoInput value={m.source} onSave={(source) => source.trim() && up({ source: source.trim() })} />
          </label>
          <label className="field">
            <span className="field-label">Topic</span>
            <TopicSelect data={data} subjectId={m.subjectId} value={m.topicId} onChange={(topicId) => up({ topicId })} />
          </label>
          <label className="field">
            <span className="field-label">Error type</span>
            <select className="select" value={m.errorType} onChange={(e) => up({ errorType: e.target.value as ErrorType })}>
              {ERROR_TYPES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Date</span>
            <input type="date" className="input" value={m.date} onChange={(e) => e.target.value && up({ date: e.target.value })} />
          </label>
          <label className="field span-2">
            <span className="field-label">Correct fix</span>
            <AutoTextarea value={m.fix} onSave={(fix) => up({ fix })} placeholder="What the right answer or method is" />
          </label>
          <label className="field span-2">
            <span className="field-label">Anki card link (note or tag)</span>
            <AutoInput value={m.cardRef ?? ''} onSave={(cardRef) => up({ cardRef: cardRef || undefined })} placeholder="e.g. deck::physics tag or card front" />
          </label>
        </div>
        <label className="check-label">
          <input type="checkbox" className="checkbox" checked={m.cleared} onChange={(e) => up({ cleared: e.target.checked })} />
          Cleared (out of the redo queue)
        </label>
      </div>
      <div className="stack">
        <div>
          <div className="field-label" style={{ marginBottom: 8 }}>
            Attempts
          </div>
          {attempts.length === 0 ? (
            <p className="muted small">Not redone yet.</p>
          ) : (
            <div className="row">
              {attempts.map((a) => (
                <span key={a.id} className={a.correct ? 'pill green' : 'pill red'} title={a.date}>
                  {fmtDay(a.date)} · {a.correct ? 'Right' : 'Wrong'}
                </span>
              ))}
            </div>
          )}
        </div>
        <div>
          <div className="row-between" style={{ marginBottom: 8 }}>
            <span className="field-label">Scans</span>
            <ScanUploadButton ownerType="mistake" ownerId={m.id} size="sm" label="Add" />
          </div>
          <ScanGrid ownerType="mistake" ownerId={m.id} emptyText="No scan of this question." />
        </div>
        <p className="tiny muted">{errorLabel(m.errorType)} · logged {fmtDay(m.date, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
      </div>
    </div>
  );
}
