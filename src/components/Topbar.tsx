import type { ReactNode } from 'react';
import { RunningPill } from '../features/TimerController';

/** Page title (with an optional eyebrow), page actions, (search lives in the top bar). */
export function Topbar({ title, eyebrow, children }: { title: ReactNode; eyebrow?: ReactNode; children?: ReactNode }) {
  return (
    <header className="topbar">
      <div className="titles">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
      </div>
      <RunningPill />
      {children}
    </header>
  );
}
