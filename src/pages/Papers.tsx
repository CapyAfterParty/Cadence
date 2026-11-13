import { Fragment, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FileText, ListPlus, Trash2, Zap } from 'lucide-react';
import { useData, type AllData } from '../db/db';
import { deletePaper } from '../db/ops';
import { addDays, fmtDay, todayKey, weekStartKey } from '../lib/dates';
import { activeSubjects, pct, subjectAverage, subjectPapers } from '../lib/stats';
import { openUI, settings } from '../lib/state';
import { Button, PageSkeleton } from '../components/ui';
import { DotNum, DotStrip, Glass, GlassHead, Panel } from '../components/glass';
import { courseTitle, splitCourse } from '../lib/course';
import './pages.css';
import { Topbar } from '../components/Topbar';
import { MultiLine } from '../components/charts/fancy';
import { ScanGrid, ScanUploadButton } from '../components/Scans';
import { paperLabel } from '../features/MistakeForms';

const SW = 1.5;

export default function Papers() {
  const data = useData();
  if (!data) return <PageSkeleton />;
  return <PapersView data={data} />;
}

function PapersView({ data }: { data: AllData }) {
  const st = settings.use();
  const [params, setParams] = useSearchParams();
  const subjects = activeSubjects(data);
  const subjectId = params.get('subject') ?? st.lastSubjectId ?? subjects[0]?.id ?? '';
  const subject = data.subjects.find((s) => s.id === subjectId) ?? subjects[0];
  const [expanded, setExpanded] = useState<string | null>(params.get('open'));

  useEffect(() => {
    const open = params.get('open');
    if (open) {
      setExpanded(open);
      setTimeout(() => document.getElementById(`p-${open}`)?.scrollIntoView({ block: 'center' }), 50);
    }
  }, [params]);

  const today = todayKey();
  const weekStart = weekStartKey(today);
  const weekEnd = addDays(weekStart, 6);
  const timedThisWeek = data.papers.filter((p) => p.timed && p.date >= weekStart && p.date <= weekEnd);
  const papers = subject ? subjectPapers(data, subject.id) : [];
  const mistakeCount = (id: string) => data.mistakes.filter((m) => m.paperId === id).length;
  const avg = subject ? subjectAverage(data, subject.id) : null;

  return (
    <div className="page">
      <Topbar title="Tests">
        <Link to="/timer?sprint=1" className="btn">
          <Zap size={16} strokeWidth={SW} /> Timed sprint
        </Link>
        <Button variant="primary" onClick={() => openUI({ logPaper: { preset: { subjectId: subject?.id } } })}>
          <FileText size={16} strokeWidth={SW} /> Log a test
        </Button>
      </Topbar>

      {subject && (
        <div className="tests-hero">
          <Glass tone="blue" wide index={0} className="trend-gel">
            <GlassHead title={`${courseTitle(subject.name)} trend`}>
              <div className="glass-tabs inline">
                {subjects.map((s) => (
                  <button key={s.id} type="button" className={s.id === subject.id ? 'on' : undefined} onClick={() => setParams({ subject: s.id }, { replace: true })}>
                    {splitCourse(s.name).code ?? courseTitle(s.name)}
                  </button>
                ))}
              </div>
            </GlassHead>
            <div className="trend-figs">
              <div>
                <DotNum big className="lead">
                  {papers.length ? Math.round(pct(papers[papers.length - 1])) : '–'}
                  <small>%</small>
                </DotNum>
                <span className="label-dim">latest mark</span>
              </div>
              <div>
                <DotNum big className="lead">
                  {avg == null ? '–' : Math.round(avg)}
                  <small>%</small>
                </DotNum>
                <span className="label-dim">average, last three</span>
              </div>
              <div>
                <DotNum big className="lead">
                  {subject.targetPct}
                  <small>%</small>
                </DotNum>
                <span className="label-dim">target</span>
              </div>
            </div>
            <div className="hero-chart">
              {papers.length ? (
                <MultiLine series={[{ id: subject.id, colour: '#ffffff', values: papers.map(pct) }]} labels={papers.map((p) => fmtDay(p.date))} target={subject.targetPct} focus={subject.id} hue="white" />
              ) : (
                <div className="trend-empty">
                  <button type="button" className="white-pill" onClick={() => openUI({ logPaper: { preset: { subjectId: subject.id } } })}>
                    Log the first {courseTitle(subject.name)} mark
                  </button>
                </div>
              )}
            </div>
          </Glass>

          <Glass tone="pink" index={1}>
            <GlassHead title="Timed practice">
              <span className="glass-tag">{fmtDay(weekStart)} – {fmtDay(weekEnd)}</span>
            </GlassHead>
            <DotNum big className="lead">
              {timedThisWeek.length}
            </DotNum>
            <span className="label-dim">{timedThisWeek.length ? 'done this week, exam conditions' : 'this week. One full paper by Sunday.'}</span>
            <div className="hero-foot">
              <span className="label-dim">Last 8 weeks</span>
              <DotStrip
                values={Array.from({ length: 8 }, (_, i) => {
                  const ws = addDays(weekStart, (i - 7) * 7);
                  return data.papers.some((p) => p.timed && p.date >= ws && p.date <= addDays(ws, 6));
                })}
                current={7}
              />
              <Link to="/timer?sprint=1" className="white-pill small">
                <Zap size={14} strokeWidth={2} /> {timedThisWeek.length ? 'Another sprint' : 'Start a sprint'}
              </Link>
            </div>
          </Glass>

          <Glass tone="smoke" index={2}>
            <GlassHead title="Latest, every course" />
            <div className="latest-list">
              {subjects.map((s) => {
                const ps = subjectPapers(data, s.id);
                const latest = ps[ps.length - 1];
                const v = latest ? pct(latest) : null;
                return (
                  <button key={s.id} type="button" className={s.id === subject.id ? 'll-row on' : 'll-row'} onClick={() => setParams({ subject: s.id }, { replace: true })} style={{ ['--c' as string]: s.colour }}>
                    <span className="ll-name">{courseTitle(s.name)}</span>
                    <span className="ll-track">
                      <i style={{ width: `${v ?? 0}%` }} />
                      <b style={{ left: `${s.targetPct}%` }} />
                    </span>
                    <span className="ll-val num">{v == null ? '–' : `${Math.round(v)}%`}</span>
                  </button>
                );
              })}
            </div>
          </Glass>
        </div>
      )}

      {subject && (
        <>
          {papers.length > 0 && (
            <Panel index={3} title={`${courseTitle(subject.name)} marks`} aside={`${papers.length} logged`} className="aura-blue">
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Paper</th>
                      <th>Kind</th>
                      <th className="right">Score</th>
                      <th className="right">%</th>
                      <th className="right">Time</th>
                      <th>Mistakes</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {[...papers].reverse().map((p) => {
                      const open = expanded === p.id;
                      const topic = p.topicId ? data.topics.find((t) => t.id === p.topicId)?.name : undefined;
                      return (
                        <Fragment key={p.id}>
                          <tr id={`p-${p.id}`} className={open ? 'clickable expanded' : 'clickable'} onClick={() => setExpanded(open ? null : p.id)}>
                            <td className="muted">{fmtDay(p.date)}</td>
                            <td style={{ fontWeight: 500 }}>
                              {paperLabel(p)} {p.timed && <span className="pill accent" style={{ marginLeft: 6 }}>Timed</span>}
                            </td>
                            <td className="muted">{p.kind === 'past_paper' ? 'Practice exam' : `Unit test${topic ? ` · ${topic}` : ''}`}</td>
                            <td className="right num">
                              {p.score}/{p.maxScore}
                            </td>
                            <td className="right num" style={{ fontWeight: 600, color: pct(p) >= subject.targetPct ? 'var(--green)' : undefined }}>
                              {Math.round(pct(p))}%
                            </td>
                            <td className="right num muted">{p.minutesTaken ? `${p.minutesTaken}m` : '–'}</td>
                            <td className="muted">{mistakeCount(p.id) || '–'}</td>
                            <td className="right" onClick={(e) => e.stopPropagation()}>
                              <Button icon size="sm" variant="ghost" aria-label="Delete test" onClick={() => deletePaper(p.id)}>
                                <Trash2 size={14} strokeWidth={SW} />
                              </Button>
                            </td>
                          </tr>
                          {open && (
                            <tr className="expanded">
                              <td colSpan={8}>
                                <div className="stack" style={{ padding: '8px 0' }} onClick={(e) => e.stopPropagation()}>
                                  <div className="row">
                                    <ScanUploadButton ownerType="paper" ownerId={p.id} size="sm" label="Upload marked test" />
                                    <Button size="sm" onClick={() => openUI({ bulk: { subjectId: p.subjectId, paperId: p.id } })}>
                                      <ListPlus size={14} strokeWidth={SW} /> Log mistakes
                                    </Button>
                                    {mistakeCount(p.id) > 0 && (
                                      <Link className="btn sm" to={`/mistakes?subject=${p.subjectId}`}>
                                        See {mistakeCount(p.id)} mistakes
                                      </Link>
                                    )}
                                  </div>
                                  <ScanGrid ownerType="paper" ownerId={p.id} emptyText="No scans yet." />
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
