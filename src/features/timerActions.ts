import { db, newRow } from '../db/db';
import type { ID, StudySession } from '../db/types';
import { todayKey } from '../lib/dates';
import { rememberSubject, settings, timer, toast } from '../lib/state';

export function startStudy(subjectId: ID) {
  if (!subjectId) return toast('Add a subject first');
  if (timer.get()) return toast('A timer is already running');
  rememberSubject(subjectId);
  timer.set({ kind: 'study', subjectId, startedAt: Date.now() });
}

/** Stops the study timer and saves the session. */
export async function stopStudy() {
  const t = timer.get();
  if (!t || t.kind !== 'study') return;
  timer.set(null);
  const minutes = Math.max(1, Math.round((Date.now() - t.startedAt) / 60000));
  const row = newRow<StudySession>({ subjectId: t.subjectId, date: todayKey(), minutes });
  await db.studySessions.add(row);
  toast(`Saved ${minutes} min session`, () => db.studySessions.delete(row.id));
}

export function discardStudy() {
  timer.set(null);
}

export function startSprint(subjectId: ID, minutes: number) {
  if (!subjectId) return toast('Pick a subject first');
  if (timer.get()) return toast('A timer is already running');
  rememberSubject(subjectId);
  settings.set((s) => ({ ...s, sprintMinutes: minutes }));
  timer.set({ kind: 'sprint', subjectId, startedAt: Date.now(), durationMin: minutes });
  document.documentElement.requestFullscreen?.().catch(() => {});
}

export function exitFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
}
