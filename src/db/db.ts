import Dexie, { type EntityTable } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import type {
  Checkin,
  FlashcardLog,
  Mistake,
  MistakeAttempt,
  Note,
  Paper,
  Row,
  Scan,
  StudySession,
  Subject,
  Topic,
} from './types';

export const db = new Dexie('cadence') as Dexie & {
  subjects: EntityTable<Subject, 'id'>;
  topics: EntityTable<Topic, 'id'>;
  notes: EntityTable<Note, 'id'>;
  papers: EntityTable<Paper, 'id'>;
  mistakes: EntityTable<Mistake, 'id'>;
  mistakeAttempts: EntityTable<MistakeAttempt, 'id'>;
  studySessions: EntityTable<StudySession, 'id'>;
  flashcardLogs: EntityTable<FlashcardLog, 'id'>;
  checkins: EntityTable<Checkin, 'id'>;
  scans: EntityTable<Scan, 'id'>;
};

db.version(1).stores({
  subjects: 'id',
  topics: 'id, subjectId',
  notes: 'id, subjectId',
  papers: 'id, subjectId, date',
  mistakes: 'id, subjectId, paperId',
  mistakeAttempts: 'id, mistakeId',
  studySessions: 'id, subjectId, date',
  flashcardLogs: 'id, &date',
  checkins: 'id, &weekStart',
  scans: 'id, [ownerType+ownerId]',
});

export const TABLES = [
  'subjects',
  'topics',
  'notes',
  'papers',
  'mistakes',
  'mistakeAttempts',
  'studySessions',
  'flashcardLogs',
  'checkins',
  'scans',
] as const;
export type TableName = (typeof TABLES)[number];

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function newRow<T extends Row>(data: Omit<T, 'id' | 'createdAt'>): T {
  return { id: uid(), createdAt: Date.now(), ...data } as T;
}

/** Everything except scan blobs. The data set is small, so screens read it whole. */
export interface AllData {
  subjects: Subject[];
  topics: Topic[];
  notes: Note[];
  papers: Paper[];
  mistakes: Mistake[];
  attempts: MistakeAttempt[];
  sessions: StudySession[];
  flashLogs: FlashcardLog[];
  checkins: Checkin[];
}

export function useData(): AllData | undefined {
  return useLiveQuery(async () => {
    const [subjects, topics, notes, papers, mistakes, attempts, sessions, flashLogs, checkins] =
      await Promise.all([
        db.subjects.toArray(),
        db.topics.toArray(),
        db.notes.toArray(),
        db.papers.toArray(),
        db.mistakes.toArray(),
        db.mistakeAttempts.toArray(),
        db.studySessions.toArray(),
        db.flashcardLogs.toArray(),
        db.checkins.toArray(),
      ]);
    subjects.sort((a, b) => a.createdAt - b.createdAt);
    topics.sort((a, b) => a.name.localeCompare(b.name));
    return { subjects, topics, notes, papers, mistakes, attempts, sessions, flashLogs, checkins };
  });
}
