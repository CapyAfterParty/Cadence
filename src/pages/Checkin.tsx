import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Download, Search } from 'lucide-react';
import { db, newRow, useData, type AllData } from '../db/db';
import type { Checkin as CheckinRow, WeekStats } from '../db/types';
import { addDays, fmtDay, fmtHours, todayKey, weekStartKey } from '../lib/dates';
import { isCheckinDone, weekStats } from '../lib/stats';
import { exportBackup } from '../lib/backup';
import { settings } from '../lib/state';
import { Empty, PageSkeleton } from '../components/ui';
import { DotNum, DotStrip, Glass, GlassHead, Panel } from '../components/glass';
import { RangeLine } from '../components/charts/fancy';
import { splitCourse } from '../lib/course';
import './pages.css';
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
      <Topbar eyebrow={isCurrent ? 'This week' : `Week of ${fmtDay(weekStart)}`} title="Review">
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

      <div className="split wide-left" style={{ alignItems: 'start' }}>
        <Panel index={6} title="Reflect" aside="Saves as you type" className="aura-violet">
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
        </Panel>
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
      <div className="hero-row short">
        <Glass tone="pink" index={0}>
          <GlassHead title="Study time" />
          <DotNum big className="lead">
            {(Math.round((stats.studyMinutes / 60) * 10) / 10).toFixed(1)}
            <small>h</small>
          </DotNum>
          <span className="label-dim">{fmtHours(stats.studyMinutes)} across the week</span>
        </Glass>
        <Glass tone="smoke" index={1}>
          <GlassHead title="Streak" />
          <div className="hc-figure">
            <span className="thin-num">{stats.streak}</span>
            <span className="hc-unit">days in a row</span>
          </div>
          <div className="hero-foot">
            <DotStrip values={Array.from({ length: 7 }, (_, i) => i < Math.min(7, stats.streak))} />
          </div>
        </Glass>
        <Glass tone="blue" index={2}>
          <GlassHead title="Flashcards" />
          <DotNum big className="lead">
            {stats.cardsDone}
          </DotNum>
          <span className="label-dim">cards{stats.flashAccuracy != null ? ` · ${stats.flashAccuracy}% accuracy` : ''}</span>
          <div className="hero-foot">
            <span className="label-dim">{stats.flashDays} of 7 days</span>
            <DotStrip values={Array.from({ length: 7 }, (_, i) => i < stats.flashDays)} />
          </div>
        </Glass>
        <Glass tone="violet" index={3}>
          <GlassHead title="Mistakes" />
          <DotNum big className="lead">
            {stats.mistakesCleared}
          </DotNum>
          <span className="label-dim">cleared · {stats.mistakesLogged} logged this week</span>
        </Glass>
      </div>
      <Panel index={4} title="Marks this week" aside={stats.timedPaperDone ? 'Timed paper done' : 'No timed paper yet'} className="aura-green">
        {stats.papers.length === 0 ? (
          <p className="muted small">No papers logged this week.</p>
        ) : (
          <div className="row" style={{ gap: 10 }}>
            {stats.papers.map((p, i) => {
              const prev = stats.papers.slice(0, i).filter((x) => x.subjectId === p.subjectId).pop();
              const delta = prev ? p.pct - prev.pct : null;
              return (
                <span key={i} className="mark-chip">
                  {subjectName.get(p.subjectId)} · {p.name} <strong className="num">{p.pct}%</strong>
                  {delta != null && <span className={delta >= 0 ? 'tiny' : 'tiny'} style={{ color: delta >= 0 ? 'var(--green)' : 'var(--red)' }}>{delta >= 0 ? `+${delta}` : delta}</span>}
                </span>
              );
            })}
          </div>
        )}
      </Panel>
    </>
  );
}

function SubjectsProgress({ stats, data }: { stats: WeekStats; data: AllData }) {
  const colour = new Map(data.subjects.map((s) => [s.id, s.colour]));
  return (
    <Panel index={7} title="On track?" aside="Average vs target" className="aura-blue">
      {stats.subjects.length === 0 ? (
        <p className="muted small">No courses yet.</p>
      ) : (
        <div className="targets">
          {stats.subjects.map((s) => {
            const on = s.avg != null && s.avg >= s.target;
            const { code, title } = splitCourse(s.name);
            return (
              <Link key={s.subjectId} to={`/subjects/${s.subjectId}`} className="tg-row compact" style={{ ['--c' as string]: colour.get(s.subjectId) }}>
                <span className="tg-badge">{code?.slice(0, 3) ?? title.slice(0, 2)}</span>
                <span className="tg-name">
                  {title}
                  <small>{s.avg == null ? 'No marks yet' : on ? 'On track' : 'Behind'}</small>
                </span>
                <span className="tg-range">
                  <RangeLine value={s.avg} target={s.target} />
                </span>
                <span className={on ? 'tg-avg num ok' : 'tg-avg num'}>
                  {s.avg == null ? '–' : `${Math.round(s.avg)}%`}
                  <small>/ {s.target}</small>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function BackupCard() {
  const st = settings.use();
  const days = st.lastBackupAt ? Math.floor((Date.now() - st.lastBackupAt) / 86_400_000) : null;
  return (
    <Panel index={8} title="Back up your data" className="aura-orange">
      <p className="muted small" style={{ marginBottom: 16 }}>
        {st.lastBackupAt
          ? `Last backup ${days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`} (${new Date(st.lastBackupAt).toLocaleDateString()}).`
          : 'No backup yet. Everything lives in this browser only.'}
      </p>
      <button type="button" className="white-pill" onClick={exportBackup}>
        <Download size={14} strokeWidth={2} /> Export JSON backup
      </button>
    </Panel>
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
    <Panel index={9}>
      <div className="panel-head">
        <h2>Past reviews</h2>
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
    </Panel>
  );
}
