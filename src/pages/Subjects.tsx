import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useData } from '../db/db';
import { daysBetween, fmtDay, todayKey } from '../lib/dates';
import { activeSubjects, dueMistakes, pct, subjectAverage, subjectPapers } from '../lib/stats';
import { settings } from '../lib/state';
import { PageSkeleton } from '../components/ui';
import { Topbar } from '../components/Topbar';
import { splitCourse } from '../lib/course';
import { AddSubject } from '../components/SubjectEditor';
import { CornerLink, DotNum, DotStrip, Glass, GlassHead } from '../components/glass';
import { RangeLine } from '../components/charts/fancy';
import './pages.css';

export default function Subjects() {
  const data = useData();
  const st = settings.use();
  if (!data) return <PageSkeleton />;
  const subjects = activeSubjects(data);
  const due = dueMistakes(data, st.redoDays);
  const today = todayKey();
  return (
    <div className="page">
      <Topbar title="Courses" />
      <div className="course-grid">
        {subjects.map((s, i) => {
          const avg = subjectAverage(data, s.id);
          const papers = subjectPapers(data, s.id);
          const last = papers.slice(-7);
          const open = data.mistakes.filter((m) => m.subjectId === s.id && !m.cleared).length;
          const dueN = due.filter((m) => m.subjectId === s.id).length;
          const days = s.nextTestDate ? daysBetween(today, s.nextTestDate) : null;
          const { code, title } = splitCourse(s.name);
          return (
            <Glass key={s.id} tone="course" colour={s.colour} index={i} className="course-card">
              <GlassHead title={<span className="glass-tag">{code ?? 'Course'}</span>}>
                <CornerLink to={`/subjects/${s.id}`} label={`Open ${title}`} />
              </GlassHead>
              <Link to={`/subjects/${s.id}`} className="cc-title">
                {title}
              </Link>
              <span className="label-dim">
                {days == null ? 'No test date' : days < 0 ? 'Test date passed' : days === 0 ? 'Test today' : `Test in ${days} ${days === 1 ? 'day' : 'days'} · ${fmtDay(s.nextTestDate!)}`}
              </span>
              <div className="cc-mid">
                <DotNum big className="lead">
                  {avg == null ? '–' : Math.round(avg)}
                  <small>%</small>
                </DotNum>
                <span className="label-dim">average · target {s.targetPct}%</span>
                <div className="cc-range">
                  <RangeLine value={avg} target={s.targetPct} />
                </div>
              </div>
              <div className="cc-marks">
                <span className="label-dim">Last {last.length || 'no'} marks</span>
                <DotStrip values={Array.from({ length: 7 }, (_, k) => { const p = last[k - (7 - last.length)]; return !!p && pct(p) >= s.targetPct; })} />
              </div>
              <div className="hc-foot">
                <span className="cc-counts num">
                  {open} open · {dueN} due
                </span>
                <Link to={dueN ? `/redo?subject=${s.id}` : `/mistakes?subject=${s.id}`} className="dark-pill">
                  {dueN ? 'Redo' : 'Mistakes'}
                </Link>
              </div>
            </Glass>
          );
        })}
        <section className="hc add-course" style={{ ['--i' as string]: subjects.length }}>
          <span className="ac-plus">
            <Plus size={22} strokeWidth={1.6} />
          </span>
          <span className="hc-title">New course</span>
          <span className="label-dim">Use the Ontario code first, like SPH4U Physics. It is read for the badge and the colour.</span>
          <AddSubject count={data.subjects.length} />
        </section>
      </div>
    </div>
  );
}
