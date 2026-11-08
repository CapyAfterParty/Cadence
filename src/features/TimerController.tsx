import { useEffect, useState } from 'react';
import { Square } from 'lucide-react';
import { useData } from '../db/db';
import { fmtClock } from '../lib/dates';
import { openUI, timer } from '../lib/state';
import { playDone } from '../lib/sound';
import { Button } from '../components/ui';
import { exitFullscreen, stopStudy } from './timerActions';

export function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

/** Seconds elapsed (study) or remaining (sprint). */
export function timerSeconds(t: NonNullable<ReturnType<typeof timer.get>>, now: number) {
  const elapsed = (now - t.startedAt) / 1000;
  return t.kind === 'sprint' ? (t.durationMin ?? 0) * 60 - elapsed : elapsed;
}

/**
 * Keeps the running timer alive across screens: shows it in the tab title,
 * ends sprints on time (sound + log form), and renders exam mode.
 */
export function TimerController() {
  const t = timer.use();
  const now = useNow(!!t);
  const data = useData();
  const subject = data?.subjects.find((s) => s.id === t?.subjectId);
  const secs = t ? timerSeconds(t, now) : 0;

  useEffect(() => {
    document.title = t ? `${fmtClock(secs)} · ${subject?.name ?? 'Timer'} · Cadence` : 'Cadence';
  }, [t, secs, subject?.name]);

  useEffect(() => {
    if (t?.kind === 'sprint' && secs <= 0) {
      timer.set(null);
      exitFullscreen();
      playDone();
      openUI({ logPaper: { preset: { subjectId: t.subjectId, timed: true, kind: 'past_paper', minutesTaken: t.durationMin } } });
    }
  }, [t, secs]);

  if (t?.kind !== 'sprint') return null;
  return <ExamMode secs={secs} subjectName={subject?.name} total={(t.durationMin ?? 0) * 60} />;
}

/** Full screen, timer only. No pause button. */
function ExamMode({ secs, subjectName, total }: { secs: number; subjectName?: string; total: number }) {
  const [confirming, setConfirming] = useState(false);
  const done = 1 - secs / total;
  return (
    <div className="exam">
      <div className="exam-label">{subjectName} · timed paper</div>
      <div className="exam-clock num">{fmtClock(secs)}</div>
      <div className="exam-bar">
        <span style={{ width: `${Math.max(0, Math.min(1, done)) * 100}%` }} />
      </div>
      <div className="exam-foot">
        {confirming ? (
          <div className="row">
            <span className="muted small">End now and log the paper?</span>
            <Button size="sm" onClick={() => setConfirming(false)}>
              Keep going
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                const t = timer.get();
                timer.set(null);
                exitFullscreen();
                if (t) {
                  const mins = Math.max(1, Math.round((Date.now() - t.startedAt) / 60000));
                  openUI({ logPaper: { preset: { subjectId: t.subjectId, timed: true, kind: 'past_paper', minutesTaken: mins } } });
                }
              }}
            >
              Finish early
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
            Finish early
          </Button>
        )}
      </div>
    </div>
  );
}

/** Small pill in the top bar for a running study session. */
export function RunningPill() {
  const t = timer.use();
  const now = useNow(t?.kind === 'study');
  const data = useData();
  if (!t || t.kind !== 'study') return null;
  const subject = data?.subjects.find((s) => s.id === t.subjectId);
  return (
    <div className="running-pill">
      <span className="pulse" style={{ background: subject?.colour }} />
      <span className="small">{subject?.name}</span>
      <span className="num" style={{ fontWeight: 600 }}>
        {fmtClock(timerSeconds(t, now))}
      </span>
      <Button icon size="sm" variant="white" aria-label="Stop and save" onClick={stopStudy}>
        <Square size={12} strokeWidth={2} fill="currentColor" />
      </Button>
    </div>
  );
}
