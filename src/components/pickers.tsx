import { useState } from 'react';
import type { AllData } from '../db/db';
import type { ID } from '../db/types';
import { createTopic } from '../db/ops';
import { cx } from './ui';

export function SubjectSelect({
  data,
  value,
  onChange,
  includeAll,
  size,
  id,
}: {
  data: AllData;
  value: ID | '';
  onChange: (id: ID) => void;
  includeAll?: boolean;
  size?: 'sm';
  id?: string;
}) {
  const subjects = data.subjects.filter((s) => !s.archived || s.id === value);
  return (
    <select id={id} className={cx('select', size)} value={value} onChange={(e) => onChange(e.target.value)}>
      {includeAll && <option value="">All courses</option>}
      {!includeAll && !value && <option value="">Pick a course</option>}
      {subjects.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}

const NEW = '__new__';

/** Topics come from a per-subject list. New ones are created inline, never free-typed. */
export function TopicSelect({
  data,
  subjectId,
  value,
  onChange,
  size,
  allowAny,
}: {
  data: AllData;
  subjectId: ID | '';
  value: ID | '' | undefined;
  onChange: (id: ID | undefined) => void;
  size?: 'sm';
  allowAny?: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const topics = data.topics.filter((t) => t.subjectId === subjectId);

  const commit = async () => {
    if (name.trim() && subjectId) onChange(await createTopic(subjectId, name));
    setCreating(false);
    setName('');
  };

  if (creating)
    return (
      <input
        autoFocus
        className={cx('input', size)}
        placeholder="New topic name, then Enter"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          }
          if (e.key === 'Escape') {
            e.stopPropagation();
            setCreating(false);
          }
        }}
      />
    );

  return (
    <select
      className={cx('select', size)}
      value={value ?? ''}
      disabled={!subjectId}
      onChange={(e) => {
        if (e.target.value === NEW) setCreating(true);
        else onChange(e.target.value || undefined);
      }}
    >
      <option value="">{allowAny ? 'All topics' : 'No topic'}</option>
      {topics.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
      {!allowAny && <option value={NEW}>+ New topic…</option>}
    </select>
  );
}
