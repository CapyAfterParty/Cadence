import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Eye, EyeOff } from 'lucide-react';
import { Enso, Logo } from '../components/Logo';
import { Button, cx } from '../components/ui';
import { greeting } from '../lib/dates';
import { toast } from '../lib/state';
import { importBackup } from '../lib/backup';
import { attemptUnlock, clearThrottle, enterApp, eraseEverything, getThrottle, lockState, passwordStrength, setPassword } from '../lib/security';
import { OWNER } from '../owner';
import './gate.css';

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function TopBar() {
  const now = useClock();
  return (
    <header className="gate-top">
      <Logo size="1.6rem" />
      <div className="gate-clock">
        <span className="eyebrow">{now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        <span className="num">{now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </header>
  );
}

function PasswordField({
  value,
  onChange,
  placeholder,
  autoFocus,
  label,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  label: string;
  autoComplete: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="pw-field">
      <input className="input" type={show ? 'text' : 'password'} autoFocus={autoFocus} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} aria-label={label} />
      <button type="button" className="pw-eye" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff size={16} strokeWidth={1.7} /> : <Eye size={16} strokeWidth={1.7} />}
      </button>
    </div>
  );
}

/* ---------- Lock screen ---------- */

export function LockScreen({ mode }: { mode: 'local' | 'site' }) {
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [state, setState] = useState<'idle' | 'checking' | 'wrong' | 'ok'>('idle');
  const [waitUntil, setWaitUntil] = useState(getThrottle().until);
  const [erasing, setErasing] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const now = useClock().getTime();
  const waiting = waitUntil > now;

  const submit = async () => {
    if (!pw || state === 'checking' || waiting) return;
    setState('checking');
    const res = await attemptUnlock(pw, mode);
    if (res === 'ok') {
      setState('ok');
      if (mode === 'site') {
        await setPassword(pw);
        setTimeout(enterApp, 600);
      } else setTimeout(enterApp, 600);
      return;
    }
    setWaitUntil(getThrottle().until);
    setState('wrong');
    setPw('');
    setTimeout(() => setState('idle'), 600);
    input.current?.focus();
  };

  const fails = getThrottle().fails;

  return (
    <div className={cx('gate', state === 'ok' && 'leaving')}>
      <TopBar />
      <main className="lock-center">
        <Enso size="clamp(6rem, 13vh, 8.5rem)" />
        <h1 className="lock-title">
          {greeting()}, <span className="serif">{OWNER.name}.</span>
        </h1>
        <form
          className={cx('pw-capsule', state === 'wrong' && 'shake', state === 'ok' && 'ok')}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            ref={input}
            autoFocus
            type={show ? 'text' : 'password'}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder={waiting ? `Wait ${Math.ceil((waitUntil - now) / 1000)}s` : 'Password'}
            disabled={waiting}
            aria-label="Password"
            autoComplete="current-password"
          />
          <button type="button" className="pw-eye" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
            {show ? <EyeOff size={16} strokeWidth={1.7} /> : <Eye size={16} strokeWidth={1.7} />}
          </button>
          <button type="submit" className="pw-go" disabled={!pw || waiting} aria-label="Unlock">
            {state === 'ok' ? <Check size={18} strokeWidth={2.4} /> : state === 'checking' ? <span className="spinner" /> : <ArrowRight size={18} strokeWidth={2.2} />}
          </button>
        </form>
        <p className={cx('lock-hint', state === 'wrong' && 'bad')} aria-live="polite">
          {state === 'wrong' ? 'Not quite.' : fails > 0 && fails < 5 ? `${5 - fails} more tries, then a short wait.` : ' '}
        </p>
      </main>
      {mode === 'local' && (
        <footer className="gate-foot">
          {erasing ? (
            <div className="erase">
              <span>
                No recovery: everything is only on this device. Type <strong>ERASE</strong> to wipe it and start again.
              </span>
              <input className="input sm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="ERASE" aria-label="Type ERASE" />
              <Button size="sm" variant="ghost" onClick={() => setErasing(false)}>
                Cancel
              </Button>
              <Button size="sm" className="danger" disabled={confirmText !== 'ERASE'} onClick={eraseEverything}>
                Erase everything
              </Button>
            </div>
          ) : (
            <button type="button" className="link" onClick={() => setErasing(true)}>
              Forgot it?
            </button>
          )}
        </footer>
      )}
    </div>
  );
}

/* ---------- First run: just a password ---------- */

export function Onboarding() {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [leaving, setLeaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const strength = passwordStrength(pw);
  const ok = pw.length >= 6 && pw === pw2;
  void lockState;

  const finish = async () => {
    if (!ok) return;
    await setPassword(pw);
    clearThrottle();
    setLeaving(true);
    setTimeout(enterApp, 650);
  };

  return (
    <div className={cx('gate', leaving && 'leaving')}>
      <TopBar />
      <main className="lock-center">
        <Enso size="clamp(6rem, 13vh, 8.5rem)" />
        <h1 className="lock-title">
          Hi <span className="serif">{OWNER.name}.</span>
        </h1>
        <p className="lock-sub">Set the password that opens Summit OS.</p>
        <form
          className="first-form"
          onSubmit={(e) => {
            e.preventDefault();
            finish();
          }}
        >
          <PasswordField value={pw} onChange={setPw} placeholder="Password" autoFocus label="New password" autoComplete="new-password" />
          <div className="strength" data-score={strength.score}>
            {[1, 2, 3, 4].map((i) => (
              <span key={i} className={i <= strength.score ? 'on' : ''} />
            ))}
            <em>{pw ? strength.label : '6 characters or more'}</em>
          </div>
          <PasswordField value={pw2} onChange={setPw2} placeholder="Once more" label="Confirm password" autoComplete="new-password" />
          <p className="match">{pw2 && (pw === pw2 ? <span className="ok">Matches</span> : <span className="bad">Doesn't match yet</span>)}</p>
          <Button type="submit" variant="primary" size="lg" disabled={!ok}>
            Open Summit OS <ArrowRight size={17} strokeWidth={2.2} />
          </Button>
        </form>
      </main>
      <footer className="gate-foot">
        <button type="button" className="link" onClick={() => fileRef.current?.click()}>
          Moving from another device? Restore a backup first
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              await importBackup(f);
              toast('Backup restored. Now set your password.');
            } catch (err) {
              toast(err instanceof Error ? err.message : 'Could not read that file');
            }
          }}
        />
      </footer>
    </div>
  );
}
