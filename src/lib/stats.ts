// Derived values. Nothing here is stored; it is all computed from the tables.
import type { AllData } from '../db/db';
import type { Checkin, ID, Mistake, MistakeAttempt, Paper, Topic, Weakness, WeekStats } from '../db/types';
import { addDays, daysBetween, inWeek, lastNDays, todayKey, weekStartKey } from './dates';

export const pct = (p: Paper) => (p.maxScore > 0 ? (p.score / p.maxScore) * 100 : 0);

export function minutesByDay(data: AllData): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of data.sessions) m.set(s.date, (m.get(s.date) ?? 0) + s.minutes);
  return m;
}

export function cardsByDay(data: AllData): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of data.flashLogs) m.set(l.date, (m.get(l.date) ?? 0) + l.cardsDone);
  return m;
}

/** Days in a row ending today. If today is not done yet, the streak is still alive from yesterday. */
export function streak(done: (day: string) => boolean, today = todayKey()): number {
  let day = done(today) ? today : addDays(today, -1);
  let n = 0;
  while (done(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

export function flashStreak(data: AllData, today = todayKey()) {
  const cards = cardsByDay(data);
  return streak((d) => (cards.get(d) ?? 0) > 0, today);
}

export function studyStreak(data: AllData, today = todayKey()) {
  const cards = cardsByDay(data);
  const mins = minutesByDay(data);
  return streak((d) => (cards.get(d) ?? 0) > 0 || (mins.get(d) ?? 0) > 0, today);
}

export function monthMinutes(data: AllData, today = todayKey()) {
  const prefix = today.slice(0, 7);
  return data.sessions.filter((s) => s.date.startsWith(prefix)).reduce((a, s) => a + s.minutes, 0);
}

/* ---------- Mistakes and the redo queue ---------- */

export function lastAttemptMap(attempts: MistakeAttempt[]): Map<ID, string> {
  const m = new Map<ID, string>();
  for (const a of attempts) {
    const prev = m.get(a.mistakeId);
    if (!prev || a.date > prev) m.set(a.mistakeId, a.date);
  }
  return m;
}

/** Open, and never redone or not redone for redoDays. */
export function isDue(m: Mistake, last: Map<ID, string>, redoDays: number, today = todayKey()) {
  if (m.cleared) return false;
  const l = last.get(m.id);
  return !l || daysBetween(l, today) >= redoDays;
}

const weakRank: Record<Weakness, number> = { high: 0, medium: 1, low: 2 };

/** Most overdue first, then weakest. Never-redone counts as most overdue. */
export function sortForRedo(mistakes: Mistake[], last: Map<ID, string>) {
  return [...mistakes].sort((a, b) => {
    const la = last.get(a.id) ?? '';
    const lb = last.get(b.id) ?? '';
    if (la !== lb) return la < lb ? -1 : 1;
    if (a.weakness !== b.weakness) return weakRank[a.weakness] - weakRank[b.weakness];
    return a.date < b.date ? -1 : 1;
  });
}

export function dueMistakes(data: AllData, redoDays: number, today = todayKey()) {
  const last = lastAttemptMap(data.attempts);
  return data.mistakes.filter((m) => isDue(m, last, redoDays, today));
}

/* ---------- Scores and topics ---------- */

export function subjectPapers(data: AllData, subjectId: ID) {
  return data.papers.filter((p) => p.subjectId === subjectId).sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Current average: mean of the last three results. */
export function subjectAverage(data: AllData, subjectId: ID): number | null {
  const ps = subjectPapers(data, subjectId).slice(-3);
  if (!ps.length) return null;
  return ps.reduce((a, p) => a + pct(p), 0) / ps.length;
}

/** Weakness from open mistakes and recent topic test scores, unless set by hand. */
export function topicWeakness(data: AllData, topic: Topic): Weakness {
  if (topic.weaknessOverride) return topic.weaknessOverride;
  const open = data.mistakes.filter((m) => m.topicId === topic.id && !m.cleared);
  let score = open.length + open.filter((m) => m.weakness === 'high').length;
  const tests = data.papers.filter((p) => p.topicId === topic.id).sort((a, b) => (a.date < b.date ? -1 : 1));
  const lastTest = tests[tests.length - 1];
  if (lastTest) {
    const p = pct(lastTest);
    if (p < 60) score += 3;
    else if (p < 75) score += 1;
  }
  return score >= 4 ? 'high' : score >= 2 ? 'medium' : 'low';
}

export function activeSubjects(data: AllData) {
  return data.subjects.filter((s) => !s.archived);
}

/** Nearest upcoming test across active subjects. */
export function nextTest(data: AllData, today = todayKey()) {
  return activeSubjects(data)
    .filter((s) => s.nextTestDate && s.nextTestDate >= today)
    .sort((a, b) => (a.nextTestDate! < b.nextTestDate! ? -1 : 1))[0];
}

/* ---------- Weeks ---------- */

export function weekStats(data: AllData, weekStart: string, today = todayKey()): WeekStats {
  const inW = (d: string) => inWeek(d, weekStart);
  const weekEnd = addDays(weekStart, 6);
  const logs = data.flashLogs.filter((l) => inW(l.date));
  const acc = logs.filter((l) => l.accuracyPct != null);
  const papers = data.papers.filter((p) => inW(p.date)).sort((a, b) => (a.date < b.date ? -1 : 1));
  return {
    studyMinutes: data.sessions.filter((s) => inW(s.date)).reduce((a, s) => a + s.minutes, 0),
    streak: studyStreak(data, today < weekEnd ? today : weekEnd),
    papers: papers.map((p) => ({ name: [p.name, p.year].filter(Boolean).join(' '), subjectId: p.subjectId, pct: Math.round(pct(p)), date: p.date })),
    timedPaperDone: papers.some((p) => p.timed),
    cardsDone: logs.reduce((a, l) => a + l.cardsDone, 0),
    flashDays: new Set(logs.filter((l) => l.cardsDone > 0).map((l) => l.date)).size,
    flashAccuracy: acc.length ? Math.round(acc.reduce((a, l) => a + (l.accuracyPct ?? 0), 0) / acc.length) : null,
    mistakesLogged: data.mistakes.filter((m) => inW(m.date)).length,
    mistakesCleared: new Set(data.attempts.filter((a) => a.correct && inW(a.date)).map((a) => a.mistakeId)).size,
    subjects: activeSubjects(data).map((s) => ({
      subjectId: s.id,
      name: s.name,
      avg: subjectAverage(data, s.id),
      target: s.targetPct,
    })),
  };
}

export const isCheckinDone = (c?: Checkin) => !!c && c.didThisWeek.trim().length > 0;

export interface LoopPart {
  label: string;
  value: number; // 0..1
  missing?: string;
}

/**
 * Share of the week's loop that is done. Four equal parts:
 * flashcards every day, the timed paper, mistakes redone, the Sunday check-in.
 */
export function loopScore(data: AllData, weekStart: string, redoDays: number, today = todayKey()) {
  const inW = (d: string) => inWeek(d, weekStart);
  const isCurrent = weekStart === weekStartKey(today);
  const cards = cardsByDay(data);
  const flashDays = lastNDays(7, addDays(weekStart, 6)).filter((d) => (cards.get(d) ?? 0) > 0).length;
  const timed = data.papers.some((p) => p.timed && inW(p.date));
  const redone = new Set(data.attempts.filter((a) => inW(a.date)).map((a) => a.mistakeId)).size;
  let mistakesValue: number;
  if (isCurrent) {
    const due = dueMistakes(data, redoDays, today).length;
    mistakesValue = due === 0 ? 1 : redone / (redone + due);
  } else {
    const hadOpen = data.mistakes.some((m) => m.date <= addDays(weekStart, 6));
    mistakesValue = redone > 0 || !hadOpen ? 1 : 0;
  }
  const checkin = data.checkins.find((c) => c.weekStart === weekStart);
  const parts: LoopPart[] = [
    { label: 'Flashcards every day', value: flashDays / 7, missing: flashDays < 7 ? `${7 - flashDays} days without cards` : undefined },
    { label: 'Timed paper', value: timed ? 1 : 0, missing: timed ? undefined : 'No timed paper yet' },
    {
      label: 'Mistakes redone',
      value: mistakesValue,
      missing: mistakesValue < 1 ? 'Mistakes still due for redo' : undefined,
    },
    {
      label: 'Sunday check-in',
      value: isCheckinDone(checkin) ? 1 : 0,
      missing: isCheckinDone(checkin) ? undefined : 'Check-in not done',
    },
  ];
  const score = Math.round((parts.reduce((a, p) => a + p.value, 0) / parts.length) * 100);
  return { score, parts };
}

export function recentWeeks(n: number, today = todayKey()) {
  const current = weekStartKey(today);
  return Array.from({ length: n }, (_, i) => addDays(current, (i - (n - 1)) * 7));
}
