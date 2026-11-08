import { createStore } from './store';
import type { ErrorType, ID, Mistake, MistakeOrigin, Paper, Weakness } from '../db/types';

/* ---------- Settings (persisted) ---------- */

export interface Settings {
  name: string;
  redoDays: number;
  sprintMinutes: number;
  lastSubjectId?: ID;
  lastErrorType: ErrorType;
  lastWeakness: Weakness;
  lastOrigin: MistakeOrigin;
  lastBackupAt?: number;
}

export const settings = createStore<Settings>(
  {
    name: '',
    redoDays: 7,
    sprintMinutes: 120,
    lastErrorType: 'didnt_know',
    lastWeakness: 'medium',
    lastOrigin: 'paper',
  },
  'cadence.settings',
);

export const rememberSubject = (subjectId: ID | undefined) => {
  if (subjectId && settings.get().lastSubjectId !== subjectId) settings.set((s) => ({ ...s, lastSubjectId: subjectId }));
};

/* ---------- Running timer (persisted so a refresh never loses it) ---------- */

export interface RunningTimer {
  kind: 'study' | 'sprint';
  subjectId: ID;
  startedAt: number;
  /** Sprint length in minutes. */
  durationMin?: number;
}

export const timer = createStore<RunningTimer | null>(null, 'cadence.timer');

/* ---------- Modals and overlays (not persisted) ---------- */

export type PaperPreset = Partial<Omit<Paper, 'id' | 'createdAt'>>;

export interface UIState {
  palette: boolean;
  quickAdd: null | { preset?: Partial<Mistake> };
  bulk: null | { subjectId?: ID; paperId?: ID };
  logPaper: null | { preset?: PaperPreset };
  flashLog: boolean;
}

export const ui = createStore<UIState>({
  palette: false,
  quickAdd: null,
  bulk: null,
  logPaper: null,
  flashLog: false,
});

export const openUI = (patch: Partial<UIState>) => ui.set((s) => ({ ...s, ...patch }));
export const anyModalOpen = () => {
  const s = ui.get();
  return s.palette || !!s.quickAdd || !!s.bulk || !!s.logPaper || s.flashLog;
};

/* ---------- Toasts with undo ---------- */

export interface Toast {
  id: number;
  message: string;
  undo?: () => unknown;
}

export const toasts = createStore<Toast[]>([]);
let toastId = 0;

export function toast(message: string, undo?: Toast['undo']) {
  const id = ++toastId;
  toasts.set((t) => [...t.slice(-2), { id, message, undo }]);
  setTimeout(() => dismissToast(id), undo ? 6000 : 3000);
}

export const dismissToast = (id: number) => toasts.set((t) => t.filter((x) => x.id !== id));
