import { useEffect, useRef } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { Check, Undo2 } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { Button } from './components/ui';
import { Palette } from './features/Search';
import { BulkMistakes, QuickAddMistake } from './features/MistakeForms';
import { FlashLog, LogPaper } from './features/LogForms';
import { TimerController } from './features/TimerController';
import { LockScreen, Onboarding } from './features/Gate';
import { anyModalOpen, dismissToast, openUI, settings, timer, toasts, ui } from './lib/state';
import { boot, lockNow, lockState, markActive, security } from './lib/security';
import Today from './pages/Today';
import Progress from './pages/Progress';
import Subjects from './pages/Subjects';
import SubjectHub from './pages/SubjectHub';
import NotePage from './pages/NotePage';
import Mistakes from './pages/Mistakes';
import Redo from './pages/Redo';
import Papers from './pages/Papers';
import TimerPage from './pages/TimerPage';
import Checkin from './pages/Checkin';
import SettingsPage from './pages/Settings';

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

function useGlobalKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ui.set((s) => ({ ...s, palette: !s.palette }));
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        lockNow();
        return;
      }
      if (e.key.toLowerCase() === 'n' && !mod && !e.altKey && !isTyping(e.target) && !anyModalOpen()) {
        e.preventDefault();
        openUI({ quickAdd: { preset: { subjectId: settings.get().lastSubjectId } } });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Locks after the chosen idle time. Never during a timed sprint (exam mode). */
function useAutoLock() {
  const last = useRef(Date.now());
  useEffect(() => {
    let lastMark = 0;
    const bump = () => {
      last.current = Date.now();
      if (last.current - lastMark > 10_000) {
        lastMark = last.current;
        markActive();
      }
    };
    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const;
    events.forEach((ev) => addEventListener(ev, bump, { passive: true }));
    const id = setInterval(() => {
      const mins = security.get().autoLockMin;
      if (mins > 0 && timer.get()?.kind !== 'sprint' && Date.now() - last.current > mins * 60_000) lockNow();
    }, 15_000);
    return () => {
      events.forEach((ev) => removeEventListener(ev, bump));
      clearInterval(id);
    };
  }, []);
}

function Overlays() {
  const s = ui.use();
  return (
    <>
      {s.palette && <Palette />}
      {s.quickAdd && <QuickAddMistake preset={s.quickAdd.preset} />}
      {s.bulk && <BulkMistakes subjectId={s.bulk.subjectId} paperId={s.bulk.paperId} />}
      {s.logPaper && <LogPaper preset={s.logPaper.preset} />}
      {s.flashLog && <FlashLog />}
    </>
  );
}

function Toasts() {
  const list = toasts.use();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className="toast">
          <span className="t-icon">{t.undo ? <Undo2 size={15} strokeWidth={2} /> : <Check size={16} strokeWidth={2.4} />}</span>
          <span style={{ paddingRight: t.undo ? 0 : '0.9rem' }}>{t.message}</span>
          {t.undo && (
            <Button
              size="sm"
              variant="white"
              onClick={async () => {
                dismissToast(t.id);
                await t.undo?.();
              }}
            >
              Undo
            </Button>
          )}
          <span className="t-bar" style={{ animationDuration: t.undo ? '6s' : '3s' }} />
        </div>
      ))}
    </div>
  );
}

function AppShell() {
  useAutoLock();
  return (
    <>
      <div className="shell">
        <Sidebar />
        <main className="main">
          <Routes>
            <Route path="/" element={<Today />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/subjects" element={<Subjects />} />
            <Route path="/subjects/:id" element={<SubjectHub />} />
            <Route path="/notes/:id" element={<NotePage />} />
            <Route path="/mistakes" element={<Mistakes />} />
            <Route path="/redo" element={<Redo />} />
            <Route path="/papers" element={<Papers />} />
            <Route path="/timer" element={<TimerPage />} />
            <Route path="/checkin" element={<Checkin />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Today />} />
          </Routes>
        </main>
      </div>
      <Overlays />
      <TimerController />
    </>
  );
}

export default function App() {
  useGlobalKeys();
  const { phase } = lockState.use();
  useEffect(() => {
    boot();
  }, []);
  return (
    <HashRouter>
      {phase === 'unlocked' ? (
        <AppShell />
      ) : (
        <>
          <div className="calm-bg" />
          {phase === 'locked' && <LockScreen mode="local" />}
          {phase === 'site' && <LockScreen mode="site" />}
          {phase === 'onboarding' && <Onboarding />}
        </>
      )}
      <Toasts />
    </HashRouter>
  );
}
