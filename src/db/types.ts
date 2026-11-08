// Every row has an id and createdAt (ms since epoch).
// Calendar dates are stored as local "YYYY-MM-DD" strings.

export type ID = string;

export interface Row {
  id: ID;
  createdAt: number;
}

export type Weakness = 'high' | 'medium' | 'low';
export type ErrorType = 'didnt_know' | 'didnt_recognize' | 'silly';
export type PaperKind = 'past_paper' | 'topic_test';
export type MistakeOrigin = 'paper' | 'revision' | 'class_test';
export type ScanOwner = 'subject' | 'paper' | 'mistake' | 'hero';

export interface Subject extends Row {
  name: string;
  colour: string;
  archived: boolean;
  targetPct: number;
  nextTestDate?: string;
}

export interface Topic extends Row {
  subjectId: ID;
  name: string;
  /** Hand-set weakness. Empty means "work it out from the data". */
  weaknessOverride?: Weakness;
}

export interface Note extends Row {
  subjectId: ID;
  title: string;
  body: string;
  updatedAt: number;
}

export interface Paper extends Row {
  subjectId: ID;
  kind: PaperKind;
  name: string;
  year?: string;
  date: string;
  score: number;
  maxScore: number;
  minutesTaken?: number;
  timed: boolean;
  /** Topic tests can point at a topic so weak-topic stats include them. */
  topicId?: ID;
}

export interface Mistake extends Row {
  subjectId: ID;
  paperId?: ID;
  origin: MistakeOrigin;
  /** e.g. "2024 Paper 2, Q4" */
  source: string;
  topicId?: ID;
  errorType: ErrorType;
  fix: string;
  date: string;
  weakness: Weakness;
  cardMade: boolean;
  /** Link to the Anki card made from it (free text or tag). */
  cardRef?: string;
  cleared: boolean;
}

export interface MistakeAttempt extends Row {
  mistakeId: ID;
  date: string;
  correct: boolean;
}

export interface StudySession extends Row {
  subjectId: ID;
  date: string;
  minutes: number;
  note?: string;
}

export interface FlashcardLog extends Row {
  date: string;
  cardsDone: number;
  accuracyPct?: number;
  minutes?: number;
}

export interface WeekStats {
  studyMinutes: number;
  streak: number;
  papers: { name: string; subjectId: ID; pct: number; date: string }[];
  timedPaperDone: boolean;
  cardsDone: number;
  flashDays: number;
  flashAccuracy: number | null;
  mistakesLogged: number;
  mistakesCleared: number;
  subjects: { subjectId: ID; name: string; avg: number | null; target: number }[];
}

export interface Checkin extends Row {
  weekStart: string;
  didThisWeek: string;
  distractions: string;
  changes: string;
  goals: string[];
  stats: WeekStats;
  updatedAt: number;
}

export interface Scan extends Row {
  ownerType: ScanOwner;
  ownerId: ID;
  name: string;
  blob: Blob;
}

export const ERROR_TYPES: { value: ErrorType; label: string; short: string }[] = [
  { value: 'didnt_know', label: "Didn't know it", short: "Didn't know" },
  { value: 'didnt_recognize', label: "Knew it, didn't recognise the question", short: "Didn't recognise" },
  { value: 'silly', label: 'Silly mistake', short: 'Silly' },
];

export const WEAKNESSES: Weakness[] = ['high', 'medium', 'low'];

export const ORIGINS: { value: MistakeOrigin; label: string }[] = [
  { value: 'paper', label: 'Past paper' },
  { value: 'revision', label: 'Revision' },
  { value: 'class_test', label: 'Class test' },
];

export const errorLabel = (e: ErrorType) => ERROR_TYPES.find((x) => x.value === e)?.short ?? e;
