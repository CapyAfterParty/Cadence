const pad = (n: number) => String(n).padStart(2, '0');

export function dayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const todayKey = () => dayKey(new Date());

export function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, n: number): string {
  const d = parseDay(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86_400_000);
}

/** Monday of the week containing key. Weeks run Monday to Sunday. */
export function weekStartKey(key: string = todayKey()): string {
  const d = parseDay(key);
  const offset = (d.getDay() + 6) % 7;
  return addDays(key, -offset);
}

export function inWeek(key: string, weekStart: string): boolean {
  const diff = daysBetween(weekStart, key);
  return diff >= 0 && diff < 7;
}

/** The last n day keys, oldest first, ending at end. */
export function lastNDays(n: number, end: string = todayKey()): string[] {
  return Array.from({ length: n }, (_, i) => addDays(end, i - (n - 1)));
}

export function fmtDay(key: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) {
  return parseDay(key).toLocaleDateString(undefined, opts);
}

export function fmtLongDate(d: Date = new Date()) {
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

export function weekdayLetter(key: string) {
  return parseDay(key).toLocaleDateString(undefined, { weekday: 'narrow' });
}

export function isSunday(key: string = todayKey()) {
  return parseDay(key).getDay() === 0;
}

export function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export function fmtHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function relDays(key: string, today: string = todayKey()): string {
  const d = daysBetween(today, key);
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  if (d === -1) return 'yesterday';
  return d > 0 ? `in ${d} days` : `${-d} days ago`;
}

export function greeting(d: Date = new Date()) {
  const h = d.getHours();
  if (h < 5) return 'Good evening';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
