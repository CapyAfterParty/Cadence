import { Fragment, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BarChart3, CheckCircle2, Circle, FileText, ListPlus, Trash2, TrendingUp, Zap } from 'lucide-react';
import { useData, type AllData } from '../db/db';
import { deletePaper } from '../db/ops';
import { addDays, fmtDay, todayKey, weekStartKey } from '../lib/dates';
import { activeSubjects, pct, subjectPapers } from '../lib/stats';
import { openUI, settings } from '../lib/state';
import { Button, Card, CardHead, Chip, Empty, PageSkeleton, Progress } from '../components/ui';
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

      <div className="grid-2" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2fr)' }}>
        <Card index={0} className="home-card">
          <CardHead icon={<Zap size={18} strokeWidth={SW} />} tone="lagoon" title="Weekly target" aside={`${fmtDay(weekStart)} – ${fmtDay(weekEnd)}`} />
          <div className="row" style={{ gap: 12 }}>
            {timedThisWeek.length ? <CheckCircle2 size={32} strokeWidth={1.5} color="var(--green)" /> : <Circle size={32} strokeWidth={1.5} color="var(--text-2)" />}
            <div>
              <div style={{ fontSize: 'var(--fs-17)', fontWeight: 600 }}>{timedThisWeek.length ? 'Timed practice done' : 'Timed practice this weekend'}</div>
              <div className="small muted">
                {timedThisWeek.length ? timedThisWeek.map((p) => `${paperLabel(p)} · ${Math.round(pct(p))}%`).join(', ') : 'Exam conditions, no breaks.'}
              </div>
            </div>
          </div>
          {!timedThisWeek.length && (
            <Link to="/timer?sprint=1" className="btn primary push" style={{ alignSelf: 'flex-start' }}>
              Start timed sprint
            </Link>
          )}
        </Card>

        <Card index={1}>
          <CardHead icon={<BarChart3 size={18} strokeWidth={SW} />} tone="orchid" title="All courses, latest mark" aside="White line marks the target" />
          {subjects.length === 0 ? (
            <Empty text="Add courses to compare them." action={<Link to="/subjects" className="btn sm">Courses</Link>} />
          ) : (
            subjects.map((s) => {
              const ps = subjectPapers(data, s.id);
              const latest = ps[ps.length - 1];
              const v = latest ? pct(latest) : null;
              return (
                <div key={s.id} className="compare-row">
                  <span className="row small" style={{ flexWrap: 'nowrap', overflow: 'hidden' }}>
                    <span className="subject-dot" style={{ background: s.colour }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                  </span>
                  <Progress value={v ?? 0} target={s.targetPct} color={s.colour} />
                  <span className="num right small" style={{ fontWeight: 600, textAlign: 'right' }}>
                    {v == null ? '–' : `${Math.round(v)}%`}
                  </span>
                </div>
              );
            })
          )}
        </Card>
      </div>

      {subject && (
        <>
          <div className="chip-row">
            {subjects.map((s) => (
              <Chip key={s.id} dot={s.colour} active={s.id === subject.id} onClick={() => setParams({ subject: s.id }, { replace: true })}>
                {s.name}
              </Chip>
            ))}
          </div>

          <Card index={2}>
            <CardHead icon={<TrendingUp size={18} strokeWidth={SW} />} tone="ember" title={`${subject.name} trend`} aside={`Target ${subject.targetPct}%`} />
            {papers.length ? (
              <div style={{ height: '13rem' }}>
                <MultiLine series={[{ id: subject.id, colour: subject.colour, values: papers.map(pct) }]} labels={papers.map((p) => fmtDay(p.date))} target={subject.targetPct} focus={subject.id} />
              </div>
            ) : (
              <Empty text={`No ${subject.name} papers yet.`} action={<Button size="sm" onClick={() => openUI({ logPaper: { preset: { subjectId: subject.id } } })}>Log a paper</Button>} />
            )}
          </Card>

          {papers.length > 0 && (
            <Card index={3}>
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
            </Card>
          )}
        </>
      )}
    </div>
  );
}
