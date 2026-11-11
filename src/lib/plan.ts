// Today's plan, derived from the data. Ordered by what matters most right
// now: a test that is close, then the daily habits, then the weekly ones.
// Finished items sink to the bottom.
import type { AllData } from '../db/db';
import type { ID } from '../db/types';
import { daysBetween, fmtHours, inWeek, isSunday, parseDay, todayKey, weekStartKey } from './dates';
import { activeSubjects, cardsByDay, dueMistakes, flashStreak, isCheckinDone, minutesByDay } from './stats';
import { courseTitle } from './course';
import type { Hue } from '../components/charts/fancy';

export type PlanAction =
  | { kind: 'nav'; to: string }
  | { kind: 'flash' }
  | { kind: 'study'; subjectId: ID }
  | { kind: 'paper'; subjectId?: ID };

export interface PlanItem {
  id: string;
  title: string;
  detail: string;
  done: boolean;
  urgent?: boolean;
  hue: Hue;
  icon: 'test' | 'cards' | 'redo' | 'study' | 'timed' | 'review';
  action: PlanAction;
}

export function todayPlan(data: AllData, redoDays: number, lastSubjectId?: ID, today = todayKey()): PlanItem[] {
  const subjects = activeSubjects(data);
  if (!subjects.length) return [];
  const items: PlanItem[] = [];
  const due = dueMistakes(data, redoDays, today);
  const dueBy = new Map<ID, number>();
  for (const m of due) dueBy.set(m.subjectId, (dueBy.get(m.subjectId) ?? 0) + 1);
  const name = (id: ID) => courseTitle(subjects.find((s) => s.id === id)?.name ?? '');

  // Tests in the next week, closest first.
  subjects
    .filter((s) => s.nextTestDate && daysBetween(today, s.nextTestDate) >= 0 && daysBetween(today, s.nextTestDate) <= 7)
    .sort((a, b) => (a.nextTestDate! < b.nextTestDate! ? -1 : 1))
    .forEach((s) => {
      const d = daysBetween(today, s.nextTestDate!);
      const open = data.mistakes.filter((m) => m.subjectId === s.id && !m.cleared).length;
      items.push({
        id: `test-${s.id}`,
        title: `${courseTitle(s.name)} test ${d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`}`,
        detail: open ? `${open} open ${open === 1 ? 'mistake' : 'mistakes'}` : 'No open mistakes',
        done: false,
        urgent: d <= 3,
        hue: 'rose',
        icon: 'test',
        action: open ? { kind: 'nav', to: `/redo?subject=${s.id}` } : { kind: 'nav', to: `/subjects/${s.id}` },
      });
    });

  const cards = cardsByDay(data).get(today) ?? 0;
  items.push({
    id: 'cards',
    title: cards ? `Flashcards · ${cards} cards` : 'Flashcards',
    detail: `Streak ${flashStreak(data, today)} ${flashStreak(data, today) === 1 ? 'day' : 'days'}`,
    done: cards > 0,
    hue: 'lavender',
    icon: 'cards',
    action: { kind: 'flash' },
  });

  const top = [...dueBy.entries()].sort((a, b) => b[1] - a[1]);
  items.push({
    id: 'redo',
    title: due.length ? `Redo ${due.length} ${due.length === 1 ? 'mistake' : 'mistakes'}` : 'Redo queue',
    detail: due.length ? top.slice(0, 3).map(([id, n]) => `${name(id)} ${n}`).join(' · ') : 'Clear',
    done: due.length === 0,
    hue: 'clay',
    icon: 'redo',
    action: { kind: 'nav', to: `/redo?subject=${top[0]?.[0] ?? lastSubjectId ?? ''}` },
  });

  const mins = minutesByDay(data).get(today) ?? 0;
  const study = subjects.find((s) => s.id === lastSubjectId) ?? subjects[0];
  items.push({
    id: 'study',
    title: 'Study session',
    detail: mins ? `${fmtHours(mins)} today` : courseTitle(study.name),
    done: mins > 0,
    hue: 'sand',
    icon: 'study',
    action: { kind: 'study', subjectId: study.id },
  });

  const weekStart = weekStartKey(today);
  const timed = data.papers.filter((p) => p.timed && inWeek(p.date, weekStart));
  const dow = parseDay(today).getDay(); // 0 Sun … 6 Sat
  if (timed.length || dow === 0 || dow >= 5) {
    items.push({
      id: 'timed',
      title: 'Timed practice exam',
      detail: timed.length ? `${name(timed[0].subjectId)} · ${Math.round((timed[0].score / timed[0].maxScore) * 100)}%` : 'Full screen, no pause',
      done: timed.length > 0,
      hue: 'mist',
      icon: 'timed',
      action: { kind: 'nav', to: '/timer?sprint=1' },
    });
  }

  const checkin = data.checkins.find((c) => c.weekStart === weekStart);
  if (isSunday(today) || isCheckinDone(checkin)) {
    items.push({
      id: 'review',
      title: 'Weekly review',
      detail: isCheckinDone(checkin) ? 'Saved' : 'Stats are filled in',
      done: isCheckinDone(checkin),
      hue: 'sage',
      icon: 'review',
      action: { kind: 'nav', to: '/checkin' },
    });
  }

  const open = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);
  return [...open.filter((i) => i.urgent), ...open.filter((i) => !i.urgent), ...done];
}
