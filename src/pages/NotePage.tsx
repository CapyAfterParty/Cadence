import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { db, useData } from '../db/db';
import type { Note } from '../db/types';
import { deleteNote } from '../db/ops';
import { renderMarkdown } from '../lib/markdown';
import { AutoInput, AutoTextarea } from '../components/auto';
import { Button, Card, Empty, PageSkeleton, Segmented } from '../components/ui';
import { SubjectSelect } from '../components/pickers';
import { SearchTrigger } from '../features/Search';

const save = (id: string, patch: Partial<Note>) => db.notes.update(id, { ...patch, updatedAt: Date.now() });

export default function NotePage() {
  const { id } = useParams();
  const data = useData();
  const nav = useNavigate();
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  if (!data) return <PageSkeleton />;
  const note = data.notes.find((n) => n.id === id);
  if (!note)
    return (
      <div className="page">
        <Card>
          <Empty text="This note does not exist any more." action={<Link className="btn sm" to="/subjects">Back to subjects</Link>} />
        </Card>
      </div>
    );
  const subject = data.subjects.find((s) => s.id === note.subjectId);
  return (
    <div className="page" style={{ maxWidth: 880 }}>
      <header className="topbar">
        <Link to={subject ? `/subjects/${subject.id}` : '/subjects'} className="btn ghost sm">
          <ArrowLeft size={16} strokeWidth={1.5} /> {subject?.name ?? 'Subjects'}
        </Link>
        <span style={{ marginRight: 'auto' }} />
        <SearchTrigger />
      </header>
      <Card>
        <div className="stack">
          <AutoInput className="title-input" placeholder="Untitled note" value={note.title} onSave={(title) => save(note.id, { title })} autoFocus={!note.title} aria-label="Title" />
          <div className="row-between">
            <div style={{ width: 200 }}>
              <SubjectSelect data={data} value={note.subjectId} size="sm" onChange={(subjectId) => save(note.id, { subjectId })} />
            </div>
            <div className="row">
              <span className="tiny muted">Saved automatically · markdown</span>
              <Segmented
                label="Mode"
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'edit', label: 'Write' },
                  { value: 'preview', label: 'Preview' },
                ]}
              />
              <Button
                icon
                variant="ghost"
                aria-label="Delete note"
                onClick={async () => {
                  await deleteNote(note.id);
                  nav(subject ? `/subjects/${subject.id}` : '/subjects');
                }}
              >
                <Trash2 size={16} strokeWidth={1.5} />
              </Button>
            </div>
          </div>
          {mode === 'edit' ? (
            <AutoTextarea className="textarea note-editor" placeholder="Write in plain markdown…" value={note.body} onSave={(body) => save(note.id, { body })} />
          ) : note.body.trim() ? (
            <div className="markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(note.body) }} />
          ) : (
            <Empty text="Nothing written yet." action={<Button size="sm" onClick={() => setMode('edit')}>Start writing</Button>} />
          )}
        </div>
      </Card>
    </div>
  );
}
