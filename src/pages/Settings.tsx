import { useEffect, useRef, useState } from 'react';
import { Archive, ArchiveRestore, Download, ImagePlus, Trash2, Upload } from 'lucide-react';
import { db, useData, type AllData } from '../db/db';
import { addScans, deleteSubject } from '../db/ops';
import { exportBackup, importBackup } from '../lib/backup';
import { settings, toast } from '../lib/state';
import { Button, Card, CardHead, Field, PageSkeleton } from '../components/ui';
import { AutoInput } from '../components/auto';
import { Topbar } from '../components/Topbar';
import { AddSubject, SubjectEditor } from '../components/SubjectEditor';
import { useScans } from '../components/Scans';

const SW = 1.5;

export default function SettingsPage() {
  const data = useData();
  if (!data) return <PageSkeleton />;
  return (
    <div className="page" style={{ maxWidth: 960 }}>
      <Topbar title="Settings" />
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <ProfileCard />
        <BackupCard />
      </div>
      <SubjectsCard data={data} />
    </div>
  );
}

function ProfileCard() {
  const st = settings.use();
  const photos = useScans('hero', 'hero');
  const input = useRef<HTMLInputElement>(null);
  return (
    <Card index={0}>
      <CardHead title="You" />
      <div className="stack">
        <Field label="Name (for the greeting)">
          <AutoInput value={st.name} onSave={(name) => settings.set((s) => ({ ...s, name: name.trim() }))} placeholder="Your name" />
        </Field>
        <Field label="Mistakes are due for redo after (days)">
          <AutoInput
            className="input num"
            inputMode="numeric"
            value={String(st.redoDays)}
            onSave={(v) => {
              const n = Number(v);
              if (n >= 1 && n <= 90) settings.set((s) => ({ ...s, redoDays: Math.round(n) }));
            }}
          />
        </Field>
        <div className="field">
          <span className="field-label">Homepage background</span>
          <div className="row">
            <Button size="sm" onClick={() => input.current?.click()}>
              <ImagePlus size={14} strokeWidth={SW} /> {photos?.length ? 'Replace photo' : 'Use my own photo'}
            </Button>
            {!!photos?.length && (
              <Button size="sm" variant="ghost" onClick={() => db.scans.bulkDelete(photos.map((p) => p.id))}>
                Back to gradient
              </Button>
            )}
          </div>
          <input
            ref={input}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              if (photos?.length) await db.scans.bulkDelete(photos.map((p) => p.id));
              await addScans('hero', 'hero', [f]);
            }}
          />
        </div>
      </div>
    </Card>
  );
}

function BackupCard() {
  const st = settings.use();
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);
  return (
    <Card index={1}>
      <CardHead title="Backup" />
      <div className="stack">
        <p className="small muted">
          All data lives in this browser. Export a JSON file now and then; import it to restore everything (including scans).
        </p>
        <div className="small">
          Last backup:{' '}
          <strong>{st.lastBackupAt ? new Date(st.lastBackupAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'never'}</strong>
        </div>
        <div className="small">
          Persistent storage: <strong>{persisted == null ? 'unknown' : persisted ? 'granted' : 'not granted'}</strong>
          {persisted === false && (
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => setPersisted((await navigator.storage?.persist?.()) ?? false)}
            >
              Ask again
            </Button>
          )}
        </div>
        <div className="row">
          <Button variant="primary" onClick={exportBackup}>
            <Download size={16} strokeWidth={SW} /> Export JSON
          </Button>
          <Button onClick={() => input.current?.click()}>
            <Upload size={16} strokeWidth={SW} /> Import JSON
          </Button>
        </div>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            if (!confirm('Importing replaces everything in the app with the contents of this backup. Continue?')) return;
            try {
              await importBackup(f);
              toast('Backup restored');
            } catch (err) {
              toast(err instanceof Error ? err.message : 'Import failed');
            }
          }}
        />
      </div>
    </Card>
  );
}

function SubjectsCard({ data }: { data: AllData }) {
  const active = data.subjects.filter((s) => !s.archived);
  const archived = data.subjects.filter((s) => s.archived);
  return (
    <Card index={2}>
      <CardHead title="Subjects" aside="Changes save as you type" />
      <div className="stack" style={{ gap: 24 }}>
        <AddSubject count={data.subjects.length} />
        {active.map((s) => (
          <div key={s.id} className="stack" style={{ gap: 12, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
            <SubjectEditor subject={s} />
            <div className="row">
              <Button size="sm" onClick={() => db.subjects.update(s.id, { archived: true })}>
                <Archive size={14} strokeWidth={SW} /> Archive
              </Button>
            </div>
          </div>
        ))}
        {archived.length > 0 && (
          <div className="stack" style={{ gap: 8, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
            <span className="field-label">Archived</span>
            {archived.map((s) => (
              <div key={s.id} className="list-item">
                <span className="subject-dot" style={{ background: s.colour }} />
                <span className="grow">{s.name}</span>
                <Button size="sm" onClick={() => db.subjects.update(s.id, { archived: false })}>
                  <ArchiveRestore size={14} strokeWidth={SW} /> Restore
                </Button>
                <Button size="sm" variant="danger" onClick={() => deleteSubject(s.id)}>
                  <Trash2 size={14} strokeWidth={SW} /> Delete
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
