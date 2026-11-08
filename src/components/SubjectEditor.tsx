import { useState } from 'react';
import { Plus } from 'lucide-react';
import { db, newRow } from '../db/db';
import type { Subject } from '../db/types';
import { rememberSubject, toast } from '../lib/state';
import { AutoInput } from './auto';
import { Button, Field } from './ui';

export const SUBJECT_COLOURS = ['#D9926A', '#A99BC9', '#86AFC4', '#8FB996', '#C98FA3', '#D6B37A', '#8C9AD0', '#C98A84'];

const update = (id: string, patch: Partial<Subject>) => db.subjects.update(id, patch);

/** Name, colour, target and test date. Every change saves itself. */
export function SubjectEditor({ subject }: { subject: Subject }) {
  return (
    <div className="form-grid">
      <Field label="Name">
        <AutoInput value={subject.name} onSave={(name) => name.trim() && update(subject.id, { name: name.trim() })} />
      </Field>
      <div className="field">
        <span className="field-label">Colour</span>
        <div className="colour-row" style={{ minHeight: 44, alignItems: 'center' }}>
          {SUBJECT_COLOURS.map((c) => (
            <button
              key={c}
              type="button"
              className="colour-swatch"
              style={{ background: c }}
              aria-label={`Colour ${c}`}
              aria-pressed={subject.colour.toLowerCase() === c.toLowerCase()}
              onClick={() => update(subject.id, { colour: c })}
            />
          ))}
        </div>
      </div>
      <Field label="Target score %">
        <AutoInput
          className="input num"
          inputMode="numeric"
          value={String(subject.targetPct)}
          onSave={(v) => {
            const n = Number(v);
            if (v.trim() && n >= 0 && n <= 100) update(subject.id, { targetPct: n });
          }}
        />
      </Field>
      <Field label="Next test date">
        <input
          type="date"
          className="input"
          value={subject.nextTestDate ?? ''}
          onChange={(e) => update(subject.id, { nextTestDate: e.target.value || undefined })}
        />
      </Field>
    </div>
  );
}

export function AddSubject({ count }: { count: number }) {
  const [name, setName] = useState('');
  const add = async () => {
    if (!name.trim()) return;
    const row = newRow<Subject>({
      name: name.trim(),
      colour: SUBJECT_COLOURS[count % SUBJECT_COLOURS.length],
      archived: false,
      targetPct: 70,
    });
    await db.subjects.add(row);
    rememberSubject(row.id);
    toast(`${row.name} added`);
    setName('');
  };
  return (
    <form
      className="row"
      style={{ flexWrap: 'nowrap' }}
      onSubmit={(e) => {
        e.preventDefault();
        add();
      }}
    >
      <input className="input" placeholder="New subject, e.g. Chemistry" value={name} onChange={(e) => setName(e.target.value)} aria-label="New subject name" />
      <Button type="submit" variant="primary" disabled={!name.trim()}>
        <Plus size={16} strokeWidth={1.5} /> Add
      </Button>
    </form>
  );
}
