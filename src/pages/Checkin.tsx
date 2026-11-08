import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Download, FileText, PenLine, Search, Target } from 'lucide-react';
import { db, newRow, useData, type AllData } from '../db/db';
import type { Checkin as CheckinRow, WeekStats } from '../db/types';
import { addDays, fmtDay, fmtHours, todayKey, weekStartKey } from '../lib/dates';
import { isCheckinDone, weekStats } from '../lib/stats';
import { exportBackup } from '../lib/backup';
import { settings } from '../lib/state';
import { Button, Card, CardHead, Empty, PageSkeleton, Progress, Stat } from '../components/ui';
import { AutoInput, AutoTextarea } from '../components/auto';
import { Topbar } from '../components/Topbar';

export default function Checkin() {
  const data = useData();
  const [params] = useSearchParams();
  if (!data) return <PageSkeleton />;
  const week = params.get('week') ?? weekStartKey();
  return <CheckinView key={week} data={data} weekStart={week} />;
}

/** Creates the week's row on the first edit, and refreshes the stats snapshot on every save. */
async function save(weekStart: string, stats: WeekStats, patch: Partial<CheckinRow>) {
  const existing = await db.checkins.where('weekStart').equals(weekStart).first();
  if (existing) await db.checkins.update(existing.id, { ...patch, stats, updatedAt: Date.now() });
  else
    await db.checkins.add(
      newRow<CheckinRow>({ weekStart, didThisWeek: '', distractions: '', changes: '', goals: ['', '', ''], stats, updatedAt: Date.now(), ...patch }),
    );
}

function CheckinView({ data, weekStart }: { data: AllData; weekStart: string }) {
  const isCurrent = weekStart === weekStartKey();
  const row = data.checkins.find((c) => c.weekStart === weekStart);
  // Live stats for the current week; past weeks show what was saved then.
  const stats = isCurrent || !row ? weekStats(data, weekStart, todayKey()) : row.stats;
  const goals = row?.goals ?? ['', '', ''];
  const put = (patch: Partial<CheckinRow>) => save(weekStart, stats, patch);

  return (
    <div className="page">
      <Topbar eyebrow="Weekly review" title={isCurrent ? 'Weekly check-in' : `Check-in · week of ${fmtDay(weekStart)}`}>
        {!isCurrent && (
          <Link to="/checkin" className="btn">
            This week
          </Link>
        )}
      </Topbar>
      <p className="muted" style={{ marginTop: -12 }}>
        {fmtDay(weekStart, { weekday: 'short', day: 'numeric', month: 'short' })} – {fmtDay(addDays(weekStart, 6), { weekday: 'short', day: 'numeric', month: 'short' })}
        {isCheckinDone(row) && (
          <span className="pill green" style={{ marginLeft: 10 }}>
            <CheckCircle2 size={12} strokeWidth={2} style={{ marginRight: 4 }} /> Saved
          </span>
        )}
      </p>

      <StatsGrid data={data} stats={stats} />

      <div className="grid-2" style={{ gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', alignItems: 'start' }}>
        <Card index={6}>
          <CardHead icon={<PenLine size={18} strokeWidth={1.7} />} tone="orchid" title="Reflect" aside="Saves as you type" />
          <div className="stack">
            <label className="field">
              <span className="field-label">What did I actually do this week?</span>
              <AutoTextarea value={row?.didThisWeek ?? ''} onSave={(didThisWeek) => put({ didThisWeek })} />
            </label>
            <label className="field">
              <span className="field-label">What distracted me?</span>
              <AutoTextarea value={row?.distractions ?? ''} onSave={(distractions) => put({ distractions })} />
            </label>
            <label className="field">
              <span className="field-label">What will I change next week?</span>
              <AutoTextarea value={row?.changes ?? ''} onSave={(changes) => put({ changes })} />
            </label>
            <div className="field">
              <span className="field-label">Top 3 goals for next week</span>
              {[0, 1, 2].map((i) => (
                <AutoInput
                  key={i}
                  value={goals[i] ?? ''}
                  placeholder={`Goal ${i + 1}`}
                  aria-label={`Goal ${i + 1}`}
                  onSave={(g) => {
                    const next = [...goals];
                    next[i] = g;
                    return put({ goals: next });
                  }}
                />
              ))}
            </div>
          </div>
        </Card>
        <div className="stack">
          <SubjectsProgress stats={stats} data={data} />
          <BackupCard />
        </div>
      </div>

      <History data={data} current={weekStart} />
    </div>
  );
}

function StatsGrid({ data, stats }: { data: AllData; stats: WeekStats }) {
  const subjectName = new Map(data.subjects.map((s) => [s.id, s.name]));
  return (
    <>
      <div className="grid-4">
        <Card index={0}>
          <Stat value={Math.round((stats.studyMinutes / 60) * 10) / 10} decimals={1} unit="h" label="Study time" />
        </Card>
        <Card index={1}>
          <Stat value={stats.streak} unit="days" label="Streak" />
        </Card>
        <Card index={2}>
          <Stat value={stats.cardsDone} unit="cards" label={`Flashcards · ${stats.flashDays}/7 days${stats.flashAccuracy != null ? ` · ${stats.flashAccuracy}% acc` : ''}`} />
        </Card>
        <Card index={3}>
          <Stat value={stats.mistakesCleared} unit="cleared" label={`Mistakes · ${stats.mistakesLogged} logged this week`} />
        </Card>
      </div>
      <Card index={4}>
        <CardHead icon={<FileText size={18} strokeWidth={1.7} />} tone="lagoon" title="Papers this week" aside={stats.timedPaperDone ? 'Timed paper done' : 'No timed paper'} />
        {stats.papers.length === 0 ? (
          <p className="muted small">No papers logged this week.</p>
        ) : (
          <div className="row" style={{ gap: 10 }}>
            {stats.papers.map((p, i) => {
              const prev = stats.papers.slice(0, i).filter((x) => x.subjectId === p.subjectId).pop();
              const delta = prev ? p.pct - prev.pct : null;
              return (
                <span key={i} className="chip" style={{ cursor: 'default' }}>
                  {subjectName.get(p.subjectId)} · {p.name} <strong className="num">{p.pct}%</strong>
                  {delta != null && <span className={delta >= 0 ? 'tiny' : 'tiny'} style={{ color: delta >= 0 ? 'var(--green)' : 'var(--red)' }}>{delta >= 0 ? `+${delta}` : delta}</span>}
                </span>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}

function SubjectsProgress({ stats, data }: { stats: WeekStats; data: AllData }) {
  const colour = new Map(data.subjects.map((s) => [s.id, s.colour]));
  return (
    <Card index={7}>
      <CardHead icon={<Target size={18} strokeWidth={1.7} />} tone="meadow" title="On track?" aside="Average vs target" />
      {stats.subjects.length === 0 ? (
        <p className="muted small">No subjects yet.</p>
      ) : (
        <div className="stack" style={{ gap: 14 }}>
          {stats.subjects.map((s) => {
            const on = s.avg != null && s.avg >= s.target;
            return (
              <div key={s.subjectId} className="stack" style={{ gap: 6 }}>
                <div className="row-between small">
                  <span className="row" style={{ gap: 8 }}>
                    <span className="subject-dot" style={{ background: colour.get(s.subjectId) }} /> {s.name}
                  </span>
                  <span className="num">
                    {s.avg == null ? '–' : `${Math.round(s.avg)}%`} <span className="muted">/ {s.target}%</span>{' '}
                    <span className={on ? 'pill green' : s.avg == null ? 'pill' : 'pill amber'}>{s.avg == null ? 'No data' : on ? 'On track' : 'Behind'}</span>
                  </span>
                </div>
                <Progress value={s.avg ?? 0} target={s.target} color={on ? 'var(--green)' : undefined} />
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function BackupCard() {
  const st = settings.use();
  const days = st.lastBackupAt ? Math.floor((Date.now() - st.lastBackupAt) / 86_400_000) : null;
  return (
    <Card index={8}>
      <CardHead icon={<Download size={18} strokeWidth={1.7} />} tone="gold" title="Back up your data" />
      <p className="muted small" style={{ marginBottom: 16 }}>
        {st.lastBackupAt
          ? `Last backup ${days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`} (${new Date(st.lastBackupAt).toLocaleDateString()}).`
          : 'No backup yet. Everything lives in this browser only.'}
      </p>
      <Button variant={days == null || days >= 7 ? 'primary' : undefined} onClick={exportBackup}>
        Export JSON backup
      </Button>
    </Card>
  );
}

function History({ data, current }: { data: AllData; current: string }) {
  const [q, setQ] = useState('');
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const list = data.checkins
    .filter((c) => c.weekStart !== current)
    .filter((c) => {
      const hay = `${c.didThisWeek} ${c.distractions} ${c.changes} ${c.goals.join(' ')}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    })
    .sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));
  return (
    <Card index={9}>
      <div className="card-head">
        <h2>Past check-ins</h2>
        <div className="row" style={{ marginLeft: 'auto', flexWrap: 'nowrap' }}>
          <Search size={16} strokeWidth={1.5} className="muted" />
          <input className="input sm" style={{ width: 220 }} placeholder="Search check-ins" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search check-ins" />
        </div>
      </div>
      {list.length === 0 ? (
        <Empty text={q ? 'No check-ins match.' : 'Past check-ins will collect here, one per week.'} />
      ) : (
        <div className="list">
          {list.map((c) => (
            <Link key={c.id} to={`/checkin?week=${c.weekStart}`} className="list-item" style={{ alignItems: 'flex-start' }}>
              <span style={{ width: 120, flex: 'none' }} className="small">
                Week of {fmtDay(c.weekStart)}
              </span>
              <span className="grow small muted" style={{ whiteSpace: 'normal' }}>
                {c.didThisWeek || 'No notes'}
              </span>
              <span className="small num muted" style={{ flex: 'none' }}>
                {fmtHours(c.stats.studyMinutes)} · {c.stats.cardsDone} cards
              </span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
