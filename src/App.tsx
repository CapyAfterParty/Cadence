import { useEffect } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Button } from './components/ui';
import { Palette } from './features/Search';
import { BulkMistakes, QuickAddMistake } from './features/MistakeForms';
import { FlashLog, LogPaper } from './features/LogForms';
import { TimerController } from './features/TimerController';
import { anyModalOpen, dismissToast, openUI, settings, toasts, ui } from './lib/state';
import Dashboard from './pages/Dashboard';
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
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ui.set((s) => ({ ...s, palette: !s.palette }));
        return;
      }
      if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping(e.target) && !anyModalOpen()) {
        e.preventDefault();
        openUI({ quickAdd: { preset: { subjectId: settings.get().lastSubjectId } } });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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
          <span>{t.message}</span>
          {t.undo ? (
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
          ) : (
            <span style={{ width: 4 }} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  useGlobalKeys();
  return (
    <HashRouter>
      <div className="shell">
        <Sidebar />
        <main className="main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/subjects" element={<Subjects />} />
            <Route path="/subjects/:id" element={<SubjectHub />} />
            <Route path="/notes/:id" element={<NotePage />} />
            <Route path="/mistakes" element={<Mistakes />} />
            <Route path="/redo" element={<Redo />} />
            <Route path="/papers" element={<Papers />} />
            <Route path="/timer" element={<TimerPage />} />
            <Route path="/checkin" element={<Checkin />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </main>
      </div>
      <Overlays />
      <TimerController />
      <Toasts />
    </HashRouter>
  );
}
