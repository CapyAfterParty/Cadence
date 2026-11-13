import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, ListPlus, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { db, useData, type AllData } from '../db/db';
import { ERROR_TYPES, WEAKNESSES, errorLabel, type ErrorType, type Mistake, type Weakness } from '../db/types';
import { deleteMistakes } from '../db/ops';
import { addDays, fmtDay, relDays, todayKey } from '../lib/dates';
import { ankiCsv, downloadText, tagify } from '../lib/download';
import { activeSubjects, isDue, lastAttemptMap, sortForRedo } from '../lib/stats';
import { openUI, settings, toast } from '../lib/state';
import { Button, Empty, ErrorPill, PageSkeleton, Segmented, WeaknessPill, cx, nextWeakness } from '../components/ui';
import { TopicSelect } from '../components/pickers';
import { DotNum, DotStrip, Glass, GlassHead, Panel } from '../components/glass';
import { courseTitle } from '../lib/course';
import './pages.css';
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
    downloadText(`summit-anki-${today}.csv`, csv, 'text/csv');
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

      <MistakeHero data={data} last={last} redoDays={st.redoDays} onStatus={setStatus} redoLink={redoLink} />

      <div className="m-layout">
        <aside className="panel filter-rail" style={{ ['--i' as string]: 4 }}>
          <span className="fr-label">Course</span>
          <button type="button" className={cx('fr-item', !subjectId && 'on')} onClick={() => setSubject('')}>
            <i className="fr-dot all" />
            <span>All courses</span>
            <b className="num">{data.mistakes.filter((m) => !m.cleared).length}</b>
          </button>
          {activeSubjects(data).map((sub) => (
            <button key={sub.id} type="button" className={cx('fr-item', subjectId === sub.id && 'on')} onClick={() => setSubject(sub.id)} style={{ ['--c' as string]: sub.colour }}>
              <i className="fr-dot" />
              <span>{courseTitle(sub.name)}</span>
              <b className="num">{data.mistakes.filter((m) => m.subjectId === sub.id && !m.cleared).length}</b>
            </button>
          ))}
          {subjectId && (
            <>
              <span className="fr-label">Topic</span>
              <TopicSelect data={data} subjectId={subjectId} value={topicId} onChange={setTopicId} size="sm" allowAny />
            </>
          )}
          <span className="fr-label">Error type</span>
          <button type="button" className={cx('fr-item', !errorType && 'on')} onClick={() => setErrorType('')}>
            <span>Any error</span>
          </button>
          {ERROR_TYPES.map((o) => (
            <button key={o.value} type="button" className={cx('fr-item', errorType === o.value && 'on')} onClick={() => setErrorType(o.value)}>
              <span>{o.short}</span>
              <b className="num">{data.mistakes.filter((m) => !m.cleared && m.errorType === o.value && (!subjectId || m.subjectId === subjectId)).length}</b>
            </button>
          ))}
          <span className="fr-label">Weakness</span>
          <div className="fr-chips">
            {(['', ...WEAKNESSES] as (Weakness | '')[]).map((w) => (
              <button key={w || 'any'} type="button" className={cx('fr-chip', weakness === w && 'on', w)} onClick={() => setWeakness(w)}>
                {w ? w[0].toUpperCase() + w.slice(1) : 'Any'}
              </button>
            ))}
          </div>
        </aside>

        <Panel index={5} className="m-table aura-violet">
          <div className="m-tools">
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
            <span className="m-count num">{rows.length} shown</span>
            <select className="select sm" style={{ width: 150, marginLeft: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
              <option value="due">Most overdue</option>
              <option value="newest">Newest</option>
              <option value="weakness">Weakest</option>
            </select>
          </div>
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
        </Panel>
      </div>

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

function MistakeHero({ data, last, redoDays, onStatus, redoLink }: { data: AllData; last: Map<string, string>; redoDays: number; onStatus: (s: Status) => void; redoLink: string }) {
  const today = todayKey();
  const open = data.mistakes.filter((m) => !m.cleared);
  const due = open.filter((m) => isDue(m, last, redoDays, today));
  const monthStart = today.slice(0, 8) + '01';
  const clearedMonth = new Set(data.attempts.filter((a) => a.correct && a.date >= monthStart).map((a) => a.mistakeId)).size;
  const withCards = data.mistakes.filter((m) => m.cardMade).length;
  const cardPct = data.mistakes.length ? Math.round((withCards / data.mistakes.length) * 100) : 0;
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const redoneOn = new Set(data.attempts.map((a) => a.date));
  const byType = ERROR_TYPES.map((t) => ({ ...t, n: open.filter((m) => m.errorType === t.value).length }));
  const maxType = Math.max(1, ...byType.map((t) => t.n));
  return (
    <div className="hero-row short">
      <Glass tone="pink" index={0}>
        <GlassHead title="Due now">
          <Link to={redoLink} className="white-pill small">
            <RotateCcw size={14} strokeWidth={2} /> Redo
          </Link>
        </GlassHead>
        <DotNum big className="lead">
          {due.length}
        </DotNum>
        <span className="label-dim">waiting {redoDays}+ days since the last try</span>
        <div className="hero-foot">
          <span className="label-dim">Redo days, last week</span>
          <DotStrip values={days.map((d) => redoneOn.has(d))} current={6} />
        </div>
      </Glass>
      <Glass tone="smoke" index={1}>
        <GlassHead title="Open">
          <button type="button" className="mode-pill" onClick={() => onStatus('open')}>
            Show
            <i />
          </button>
        </GlassHead>
        <div className="hc-figure">
          <span className="thin-num">{open.length}</span>
          <span className="hc-unit">by error type</span>
        </div>
        <div className="type-bars">
          {byType.map((t) => (
            <div key={t.value} className="tb-row">
              <span>{t.short}</span>
              <span className="tb-track">
                <i style={{ width: `${(t.n / maxType) * 100}%` }} />
              </span>
              <b className="num">{t.n}</b>
            </div>
          ))}
        </div>
      </Glass>
      <Glass tone="blue" index={2}>
        <GlassHead title="Cleared">
          <button type="button" className="mode-pill" onClick={() => onStatus('cleared')}>
            Show
            <i />
          </button>
        </GlassHead>
        <DotNum big className="lead">
          {clearedMonth}
        </DotNum>
        <span className="label-dim">right on the redo, this month</span>
        <div className="hero-foot">
          <span className="label-dim">{data.mistakes.filter((m) => m.cleared).length} cleared of {data.mistakes.length} logged</span>
        </div>
      </Glass>
      <Glass tone="violet" index={3}>
        <GlassHead title="Anki cards" />
        <DotNum big className="lead">
          {cardPct}
          <small>%</small>
        </DotNum>
        <span className="label-dim">of mistakes have a card</span>
        <div className="hero-foot">
          <span className="label-dim">Select rows below to export them as Anki CSV</span>
        </div>
      </Glass>
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
