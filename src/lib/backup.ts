import { db, TABLES } from '../db/db';
import { settings } from './state';
import { downloadText } from './download';
import { todayKey } from './dates';

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(b);
  });

const dataUrlToBlob = async (u: string) => (await fetch(u)).blob();

export async function exportBackup() {
  const tables: Record<string, unknown[]> = {};
  for (const name of TABLES) {
    const rows = await db.table(name).toArray();
    tables[name] =
      name === 'scans'
        ? await Promise.all(rows.map(async (r) => ({ ...r, blob: await blobToDataUrl(r.blob) })))
        : rows;
  }
  const { lastBackupAt: _ignored, ...rest } = settings.get();
  const payload = { app: 'summit', version: 1, exportedAt: new Date().toISOString(), settings: rest, tables };
  downloadText(`summit-backup-${todayKey()}.json`, JSON.stringify(payload), 'application/json');
  settings.set((s) => ({ ...s, lastBackupAt: Date.now() }));
}

/** Replaces everything with the backup's contents. */
export async function importBackup(file: File) {
  const payload = JSON.parse(await file.text());
  if (!['cadence', 'summit'].includes(payload?.app) || typeof payload.tables !== 'object') {
    throw new Error('This file is not a Summit OS backup.');
  }
  const prepared: Record<string, unknown[]> = {};
  for (const name of TABLES) {
    const rows = Array.isArray(payload.tables[name]) ? payload.tables[name] : [];
    prepared[name] =
      name === 'scans'
        ? await Promise.all(rows.map(async (r: any) => ({ ...r, blob: await dataUrlToBlob(r.blob) })))
        : rows;
  }
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const name of TABLES) {
      await db.table(name).clear();
      await db.table(name).bulkAdd(prepared[name]);
    }
  });
  if (payload.settings && typeof payload.settings === 'object') {
    settings.set((s) => ({ ...s, ...payload.settings }));
  }
}
