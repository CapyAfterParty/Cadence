import type { ReactNode } from 'react';
import { SearchTrigger } from '../features/Search';
import { RunningPill } from '../features/TimerController';

/** Page title, page actions, and the always-visible search box. */
export function Topbar({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <header className="topbar">
      <h1>{title}</h1>
      <RunningPill />
      {children}
      <SearchTrigger />
    </header>
  );
}
