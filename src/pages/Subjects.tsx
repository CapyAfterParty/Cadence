import { Link } from 'react-router-dom';
import { useData } from '../db/db';
import { daysBetween, todayKey } from '../lib/dates';
import { activeSubjects, dueMistakes, subjectAverage } from '../lib/stats';
import { settings } from '../lib/state';
import { Card, Empty, PageSkeleton, Progress } from '../components/ui';
import { Topbar } from '../components/Topbar';
import { splitCourse } from '../lib/course';
import { AddSubject } from '../components/SubjectEditor';

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
      <Card index={0}>
        <AddSubject count={data.subjects.length} />
      </Card>
      {subjects.length === 0 ? (
        <Card index={1}>
          <Empty text="Add the courses you are taking this semester." />
        </Card>
      ) : (
        <div className="grid-3">
          {subjects.map((s, i) => {
            const avg = subjectAverage(data, s.id);
            const open = data.mistakes.filter((m) => m.subjectId === s.id && !m.cleared).length;
            const dueN = due.filter((m) => m.subjectId === s.id).length;
            const days = s.nextTestDate ? daysBetween(today, s.nextTestDate) : null;
            return (
              <Link key={s.id} to={`/subjects/${s.id}`} style={{ textDecoration: 'none' }}>
                <Card hoverable tilt tint={s.colour} index={i + 1} className="subject-card">
                  <div className="subject-head">
                    <span className="swatch" style={{ background: `linear-gradient(150deg, color-mix(in srgb, ${s.colour} 65%, white), ${s.colour} 55%, color-mix(in srgb, ${s.colour} 75%, black))`, ['--c' as string]: s.colour }} />
                    <div style={{ minWidth: 0 }}>
                      <div className="subject-name">
                        {splitCourse(s.name).title} {splitCourse(s.name).code && <em className="code">{splitCourse(s.name).code}</em>}
                      </div>
                      <div className="muted small">
                        {days == null ? 'No test date' : days < 0 ? 'Test date passed' : days === 0 ? 'Test today' : `Test in ${days} ${days === 1 ? 'day' : 'days'}`}
                      </div>
                    </div>
                  </div>
                  <div className="row-between">
                    <span className="small muted">Average vs target</span>
                    <span className="num" style={{ fontWeight: 600 }}>
                      {avg == null ? '–' : `${Math.round(avg)}%`} <span className="muted">/ {s.targetPct}%</span>
                    </span>
                  </div>
                  <Progress value={avg ?? 0} target={s.targetPct} color={avg != null && avg >= s.targetPct ? 'var(--green)' : undefined} />
                  <div className="row small muted">
                    <span>{open} open mistakes</span>
                    <span>·</span>
                    <span>{dueN} due</span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
