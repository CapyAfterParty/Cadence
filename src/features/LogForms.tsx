import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { db, newRow, useData, type AllData } from '../db/db';
import type { Paper, PaperKind } from '../db/types';
import { saveFlashLog } from '../db/ops';
import { todayKey } from '../lib/dates';
import { openUI, rememberSubject, toast, ui, type PaperPreset } from '../lib/state';
import { Button, Field, Modal, Segmented } from '../components/ui';
import { SubjectSelect, TopicSelect } from '../components/pickers';
import { ScanGrid, ScanUploadButton } from '../components/Scans';
import { paperLabel } from './MistakeForms';

/* ---------- Log a paper or topic test ---------- */

export function LogPaper({ preset }: { preset?: PaperPreset }) {
  const data = useData();
  const close = () => ui.set((s) => ({ ...s, logPaper: null }));
  if (!data) return null;
  return <PaperForm data={data} preset={preset} close={close} />;
}

const numOrNaN = (s: string) => (s.trim() === '' ? NaN : Number(s));

function PaperForm({ data, preset, close }: { data: AllData; preset?: PaperPreset; close: () => void }) {
  const firstSubject = preset?.subjectId && data.subjects.some((s) => s.id === preset.subjectId) ? preset.subjectId : data.subjects.find((s) => !s.archived)?.id ?? '';
  const [f, setF] = useState({
    subjectId: firstSubject,
    kind: (preset?.kind ?? 'past_paper') as PaperKind,
    name: preset?.name ?? '',
    year: preset?.year ?? '',
    date: preset?.date ?? todayKey(),
    score: '',
    maxScore: '',
    minutes: preset?.minutesTaken != null ? String(preset.minutesTaken) : '',
    timed: preset?.timed ?? false,
    topicId: preset?.topicId,
  });
  const [tried, setTried] = useState(false);
  const [saved, setSaved] = useState<Paper | null>(null);
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));

  const score = numOrNaN(f.score);
  const max = numOrNaN(f.maxScore);
  const errors = {
    subject: f.subjectId ? '' : 'Pick a course',
    name: f.name.trim() ? '' : 'Give it a name',
    score: isNaN(score) || score < 0 ? 'Enter the score' : '',
    max: isNaN(max) || max <= 0 ? 'Enter the max score' : !isNaN(score) && score > max ? 'Score is above max' : '',
  };
  const valid = !Object.values(errors).some(Boolean);

  const save = async () => {
    setTried(true);
    if (!valid) return;
    const row = newRow<Paper>({
      subjectId: f.subjectId,
      kind: f.kind,
      name: f.name.trim(),
      year: f.year.trim() || undefined,
      date: f.date,
      score,
      maxScore: max,
      minutesTaken: f.minutes ? Number(f.minutes) : undefined,
      timed: f.timed,
      topicId: f.kind === 'topic_test' ? f.topicId : undefined,
    });
    await db.papers.add(row);
    rememberSubject(f.subjectId);
    setSaved(row);
  };

  if (saved)
    return (
      <Modal title="Saved" onClose={close}>
        <div className="stack">
          <div className="row" style={{ gap: 12 }}>
            <CheckCircle2 size={28} strokeWidth={1.5} color="var(--green)" />
            <div>
              <div style={{ fontSize: 'var(--fs-17)', fontWeight: 600 }}>{paperLabel(saved)}</div>
              <div className="muted small num">
                {saved.score}/{saved.maxScore} · {Math.round((saved.score / saved.maxScore) * 100)}%
              </div>
            </div>
          </div>
          <div className="banner">
            <span>
              <strong>Log the mistakes now,</strong> while it's fresh.
            </span>
          </div>
          <ScanGrid ownerType="paper" ownerId={saved.id} emptyText="Add scans of the marked paper." />
        </div>
        <div className="modal-foot">
          <ScanUploadButton ownerType="paper" ownerId={saved.id} label="Add scans" />
          <Button onClick={close}>Later</Button>
          <Button variant="primary" autoFocus onClick={() => openUI({ logPaper: null, bulk: { subjectId: saved.subjectId, paperId: saved.id } })}>
            Log mistakes
          </Button>
        </div>
      </Modal>
    );

  if (!firstSubject)
    return (
      <Modal title="Add a course first" onClose={close}>
        <p className="muted">Tests belong to a course. Add one in Courses first.</p>
      </Modal>
    );

  return (
    <Modal title={preset?.timed ? 'Time. Log the result' : 'Log a test'} onClose={close}>
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Course" error={tried ? errors.subject : ''}>
          <SubjectSelect data={data} value={f.subjectId} onChange={(subjectId) => set({ subjectId, topicId: undefined })} />
        </Field>
        <div className="field">
          <span className="field-label">Kind</span>
          <Segmented
            value={f.kind}
            onChange={(kind) => set({ kind })}
            options={[
              { value: 'past_paper', label: 'Practice exam' },
              { value: 'topic_test', label: 'Unit test' },
            ]}
          />
        </div>
        <Field label="Name" error={tried ? errors.name : ''}>
          <input autoFocus className="input" placeholder="Paper 2" value={f.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Year">
          <input className="input" placeholder="2024" value={f.year} onChange={(e) => set({ year: e.target.value })} />
        </Field>
        {f.kind === 'topic_test' && (
          <Field label="Topic" className="span-2">
            <TopicSelect data={data} subjectId={f.subjectId} value={f.topicId} onChange={(topicId) => set({ topicId })} />
          </Field>
        )}
        <Field label="Score" error={tried ? errors.score : ''}>
          <input className="input num" inputMode="decimal" value={f.score} onChange={(e) => set({ score: e.target.value })} />
        </Field>
        <Field label="Max score" error={tried ? errors.max : ''}>
          <input className="input num" inputMode="decimal" value={f.maxScore} onChange={(e) => set({ maxScore: e.target.value })} />
        </Field>
        <Field label="Date">
          <input type="date" className="input" value={f.date} onChange={(e) => set({ date: e.target.value || todayKey() })} />
        </Field>
        <Field label="Time taken (min)">
          <input className="input num" inputMode="numeric" value={f.minutes} onChange={(e) => set({ minutes: e.target.value.replace(/\D/g, '') })} />
        </Field>
        <label className="check-label span-2">
          <input type="checkbox" className="checkbox" checked={f.timed} onChange={(e) => set({ timed: e.target.checked })} />
          Timed, under exam conditions
        </label>
        <div className="modal-foot span-2" style={{ marginTop: 8 }}>
          <Button onClick={close}>Cancel</Button>
          <Button type="submit" variant="primary">
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------- Daily flashcard log ---------- */

export function FlashLog() {
  const data = useData();
  const close = () => ui.set((s) => ({ ...s, flashLog: false }));
  if (!data) return null;
  return <FlashForm data={data} close={close} />;
}

function FlashForm({ data, close }: { data: AllData; close: () => void }) {
  const today = todayKey();
  const existing = (d: string) => data.flashLogs.find((l) => l.date === d);
  const fromLog = (d: string) => {
    const l = existing(d);
    return { date: d, cards: l ? String(l.cardsDone) : '', acc: l?.accuracyPct != null ? String(l.accuracyPct) : '', minutes: l?.minutes != null ? String(l.minutes) : '' };
  };
  const [f, setF] = useState(fromLog(today));
  const [tried, setTried] = useState(false);
  const digits = (s: string) => s.replace(/\D/g, '');
  const cards = numOrNaN(f.cards);
  const acc = numOrNaN(f.acc);
  const errors = { cards: isNaN(cards) ? 'How many cards?' : '', acc: f.acc && (acc < 0 || acc > 100) ? '0 to 100' : '' };

  const save = async () => {
    setTried(true);
    if (errors.cards || errors.acc) return;
    await saveFlashLog({ date: f.date, cardsDone: cards, accuracyPct: f.acc ? acc : undefined, minutes: f.minutes ? Number(f.minutes) : undefined });
    toast(f.date === today ? `${cards} cards logged for today` : `${cards} cards logged`);
    close();
  };

  return (
    <Modal title="Log flashcards" onClose={close}>
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Cards done" error={tried ? errors.cards : ''}>
          <input autoFocus className="input num" inputMode="numeric" value={f.cards} onChange={(e) => setF({ ...f, cards: digits(e.target.value) })} />
        </Field>
        <Field label="Date">
          <input type="date" className="input" value={f.date} max={today} onChange={(e) => setF(fromLog(e.target.value || today))} />
        </Field>
        <Field label="Accuracy % (optional)" error={tried ? errors.acc : ''}>
          <input className="input num" inputMode="numeric" value={f.acc} onChange={(e) => setF({ ...f, acc: digits(e.target.value) })} />
        </Field>
        <Field label="Minutes (optional)">
          <input className="input num" inputMode="numeric" value={f.minutes} onChange={(e) => setF({ ...f, minutes: digits(e.target.value) })} />
        </Field>
        {existing(f.date) && <p className="tiny muted span-2">This replaces the log already saved for that day.</p>}
        <div className="modal-foot span-2" style={{ marginTop: 8 }}>
          <Button onClick={close}>Cancel</Button>
          <Button type="submit" variant="primary">
            Log
          </Button>
        </div>
      </form>
    </Modal>
  );
}
