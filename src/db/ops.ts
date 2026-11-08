import type { Table } from 'dexie';
import { db, newRow } from './db';
import type { FlashcardLog, ID, Mistake, MistakeAttempt, Row } from './types';
import { toast } from '../lib/state';
import { todayKey } from '../lib/dates';

type Snapshot = { table: Table<Row, string>; rows: Row[] };

async function take(table: Table<any, string>, ids: ID[]): Promise<Snapshot> {
  const rows = (await table.bulkGet(ids)).filter(Boolean) as Row[];
  return { table, rows };
}

/** Delete rows across tables, then offer a few seconds to undo. */
async function removeWithUndo(label: string, snapshots: Snapshot[]) {
  await db.transaction('rw', snapshots.map((s) => s.table), async () => {
    for (const s of snapshots) await s.table.bulkDelete(s.rows.map((r) => r.id));
  });
  toast(label, async () => {
    await db.transaction('rw', snapshots.map((s) => s.table), async () => {
      for (const s of snapshots) await s.table.bulkPut(s.rows);
    });
  });
}

const scanIds = (ownerType: string, ownerIds: ID[]) =>
  db.scans.where('[ownerType+ownerId]').anyOf(ownerIds.map((id) => [ownerType, id])).primaryKeys();

export async function deleteMistakes(ids: ID[]) {
  const attemptIds = await db.mistakeAttempts.where('mistakeId').anyOf(ids).primaryKeys();
  await removeWithUndo(ids.length === 1 ? 'Mistake deleted' : `${ids.length} mistakes deleted`, [
    await take(db.mistakes, ids),
    await take(db.mistakeAttempts, attemptIds),
    await take(db.scans, await scanIds('mistake', ids)),
  ]);
}

export async function deletePaper(id: ID) {
  await removeWithUndo('Paper deleted', [await take(db.papers, [id]), await take(db.scans, await scanIds('paper', [id]))]);
}

export async function deleteNote(id: ID) {
  await removeWithUndo('Note deleted', [await take(db.notes, [id])]);
}

export async function deleteScan(id: ID) {
  await removeWithUndo('Scan deleted', [await take(db.scans, [id])]);
}

export async function deleteSession(id: ID) {
  await removeWithUndo('Session deleted', [await take(db.studySessions, [id])]);
}

export async function deleteFlashLog(id: ID) {
  await removeWithUndo('Flashcard log deleted', [await take(db.flashcardLogs, [id])]);
}

export async function deleteTopic(id: ID) {
  await removeWithUndo('Topic deleted', [await take(db.topics, [id])]);
}

export async function deleteCheckin(id: ID) {
  await removeWithUndo('Check-in deleted', [await take(db.checkins, [id])]);
}

/** Deletes a subject and everything in it. Archiving is the gentler option. */
export async function deleteSubject(id: ID) {
  const papers = await db.papers.where('subjectId').equals(id).primaryKeys();
  const mistakes = await db.mistakes.where('subjectId').equals(id).primaryKeys();
  const attempts = await db.mistakeAttempts.where('mistakeId').anyOf(mistakes).primaryKeys();
  const scans = [
    ...(await scanIds('subject', [id])),
    ...(await scanIds('paper', papers)),
    ...(await scanIds('mistake', mistakes)),
  ];
  await removeWithUndo('Subject deleted', [
    await take(db.subjects, [id]),
    await take(db.topics, await db.topics.where('subjectId').equals(id).primaryKeys()),
    await take(db.notes, await db.notes.where('subjectId').equals(id).primaryKeys()),
    await take(db.papers, papers),
    await take(db.mistakes, mistakes),
    await take(db.mistakeAttempts, attempts),
    await take(db.studySessions, await db.studySessions.where('subjectId').equals(id).primaryKeys()),
    await take(db.scans, scans),
  ]);
}

/** Record a redo attempt. Right clears the mistake; wrong keeps it in the queue. */
export async function recordAttempt(mistake: Mistake, correct: boolean) {
  await db.transaction('rw', db.mistakes, db.mistakeAttempts, async () => {
    await db.mistakeAttempts.add(newRow<MistakeAttempt>({ mistakeId: mistake.id, date: todayKey(), correct }));
    await db.mistakes.update(mistake.id, { cleared: correct });
  });
}

/** One flashcard log per day: logging again for the same day replaces it. */
export async function saveFlashLog(data: Omit<FlashcardLog, 'id' | 'createdAt'>) {
  const existing = await db.flashcardLogs.where('date').equals(data.date).first();
  if (existing) await db.flashcardLogs.update(existing.id, data);
  else await db.flashcardLogs.add(newRow<FlashcardLog>(data));
}

export async function createTopic(subjectId: ID, name: string): Promise<ID> {
  const clean = name.trim();
  const existing = (await db.topics.where('subjectId').equals(subjectId).toArray()).find(
    (t) => t.name.toLowerCase() === clean.toLowerCase(),
  );
  if (existing) return existing.id;
  const row = newRow({ subjectId, name: clean });
  await db.topics.add(row as any);
  return row.id;
}

export async function addScans(ownerType: 'subject' | 'paper' | 'mistake' | 'hero', ownerId: ID, files: FileList | File[]) {
  const rows = Array.from(files).map((f) => newRow({ ownerType, ownerId, name: f.name, blob: f }));
  await db.scans.bulkAdd(rows as any);
  if (rows.length) toast(rows.length === 1 ? 'Scan added' : `${rows.length} scans added`);
}
