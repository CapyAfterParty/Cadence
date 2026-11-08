import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, CalendarCheck, Check, Eye, EyeOff, Layers, Lock, Plus, RotateCcw, Upload, Zap } from 'lucide-react';
import { db, newRow } from '../db/db';
import type { Subject } from '../db/types';
import { Enso, Logo } from '../components/Logo';
import { Button, IconTile, cx } from '../components/ui';
import { SUBJECT_COLOURS } from '../components/SubjectEditor';
import { greeting } from '../lib/dates';
import { settings, toast } from '../lib/state';
import { importBackup } from '../lib/backup';
import {
  attemptUnlock,
  clearThrottle,
  enterApp,
  eraseEverything,
  getThrottle,
  lockState,
  passwordStrength,
  setPassword,
} from '../lib/security';
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
      <Logo size="1.9rem" />
      <div className="gate-clock">
        <span className="eyebrow">{now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        <span className="num">{now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </header>
  );
}

/* ---------- Lock screen ---------- */

export function LockScreen({ mode }: { mode: 'local' | 'site' }) {
  const name = settings.use().name.split(' ')[0];
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
        // The site password becomes this browser's password.
        await setPassword(pw);
        setTimeout(() => lockState.set({ phase: 'onboarding', siteCleared: true }), 650);
      } else setTimeout(enterApp, 650);
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
        <Enso size="clamp(6rem, 13vh, 9rem)" />
        <h1 className="lock-title">
          {mode === 'site' ? (
            <>
              This space is <span className="serif">private.</span>
            </>
          ) : (
            <>
              {greeting()}
              {name ? ', ' : ''}
              {name && <span className="serif">{name}.</span>}
            </>
          )}
        </h1>
        <p className="lock-sub">{mode === 'site' ? 'Enter the access password to continue.' : 'Enter your password to unlock Cadence.'}</p>
        <form
          className={cx('pw-capsule', state === 'wrong' && 'shake', state === 'ok' && 'ok')}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Lock size={18} strokeWidth={1.6} className="pw-lock" />
          <input
            ref={input}
            autoFocus
            type={show ? 'text' : 'password'}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder={waiting ? `Try again in ${Math.ceil((waitUntil - now) / 1000)}s` : 'Password'}
            disabled={waiting}
            aria-label="Password"
            autoComplete="current-password"
          />
          <button type="button" className="pw-eye" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
            {show ? <EyeOff size={17} strokeWidth={1.6} /> : <Eye size={17} strokeWidth={1.6} />}
          </button>
          <button type="submit" className="pw-go" disabled={!pw || waiting} aria-label="Unlock">
            {state === 'ok' ? <Check size={20} strokeWidth={2.2} /> : state === 'checking' ? <span className="spinner" /> : <ArrowRight size={20} strokeWidth={2} />}
          </button>
        </form>
        <p className={cx('lock-hint', state === 'wrong' && 'bad')} aria-live="polite">
          {state === 'wrong' ? 'That password is not right.' : fails > 0 && fails < 5 ? `${5 - fails} tries before a short wait.` : ' '}
        </p>
      </main>
      {mode === 'local' && (
        <footer className="gate-foot">
          {erasing ? (
            <div className="erase">
              <span>
                There is no recovery: the data is only on this device. Type <strong>ERASE</strong> to delete everything and start fresh.
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
              Forgot your password?
            </button>
          )}
        </footer>
      )}
    </div>
  );
}

/* ---------- Onboarding ---------- */

const SUGGESTED = ['Maths', 'Physics', 'Chemistry', 'Biology', 'English', 'History', 'Geography', 'Economics', 'Computer Science', 'Psychology', 'French', 'Spanish'];

function Steps({ step, total }: { step: number; total: number }) {
  return (
    <div className="steps" aria-label={`Step ${step + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cx('step-dot', i === step && 'on', i < step && 'done')} />
      ))}
    </div>
  );
}

function Panel({ children, k }: { children: ReactNode; k: number }) {
  return (
    <div key={k} className="ob-panel">
      {children}
    </div>
  );
}

export function Onboarding() {
  const st = settings.use();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(st.name);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [custom, setCustom] = useState('');
  const [existing, setExisting] = useState<Subject[]>([]);
  const [leaving, setLeaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const siteCleared = lockState.use().siteCleared;
  const [havePw, setHavePw] = useState(false);

  useEffect(() => {
    db.subjects.toArray().then((s) => setExisting(s.filter((x) => !x.archived)));
    db.meta.get('lock').then((r) => setHavePw(!!r));
  }, [step]);

  // If the site password already became this browser's password, skip that step.
  const skipPassword = siteCleared && havePw;
  const order = ['welcome', 'name', ...(skipPassword ? [] : ['password']), 'subjects', 'loop'] as const;
  const id = order[Math.min(step, order.length - 1)];
  const next = () => setStep((s) => Math.min(order.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const strength = passwordStrength(pw);
  const pwOk = pw.length >= 6 && pw === pw2;

  const finish = async () => {
    if (!skipPassword) await setPassword(pw);
    settings.set((s) => ({ ...s, name: name.trim() }));
    const have = new Set(existing.map((s) => s.name.toLowerCase()));
    const rows = picked
      .filter((n) => !have.has(n.toLowerCase()))
      .map((n, i) => newRow<Subject>({ name: n, colour: SUBJECT_COLOURS[(existing.length + i) % SUBJECT_COLOURS.length], archived: false, targetPct: 70 }));
    if (rows.length) await db.subjects.bulkAdd(rows);
    if (rows[0]) settings.set((s) => ({ ...s, lastSubjectId: s.lastSubjectId ?? rows[0].id }));
    clearThrottle();
    setLeaving(true);
    setTimeout(enterApp, 700);
  };

  const toggle = (n: string) => setPicked((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]));

  return (
    <div className={cx('gate', 'onboarding', leaving && 'leaving')}>
      <TopBar />
      <main className="ob-center">
        {id === 'welcome' && (
          <Panel k={0}>
            <Enso size="clamp(7rem, 16vh, 11rem)" />
            <h1 className="ob-hero">
              Study in <span className="serif">rhythm.</span>
            </h1>
            <p className="ob-lede">A private home for your papers, mistakes and weekly loop. Everything stays on this device.</p>
            <div className="ob-actions">
              <Button variant="primary" size="lg" onClick={next}>
                Get started <ArrowRight size={18} strokeWidth={2} />
              </Button>
              <Button size="lg" variant="ghost" onClick={() => fileRef.current?.click()}>
                <Upload size={16} strokeWidth={1.8} /> Restore a backup
              </Button>
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
                    setName(settings.get().name);
                    toast('Backup restored. Now lock it with a password.');
                    setStep(1);
                  } catch (err) {
                    toast(err instanceof Error ? err.message : 'Could not read that file');
                  }
                }}
              />
            </div>
          </Panel>
        )}

        {id === 'name' && (
          <Panel k={1}>
            <span className="eyebrow">Let’s set you up</span>
            <h1 className="ob-title">
              What should we <span className="serif">call you?</span>
            </h1>
            <form
              className="ob-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (name.trim()) next();
              }}
            >
              <input className="ob-big-input" autoFocus placeholder="Your first name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Your name" />
              <Nav onBack={back} canNext={!!name.trim()} />
            </form>
          </Panel>
        )}

        {id === 'password' && (
          <Panel k={2}>
            <IconTile tone="ember" size="3.25rem">
              <Lock size={22} strokeWidth={1.8} />
            </IconTile>
            <h1 className="ob-title">
              Lock it with a <span className="serif">password.</span>
            </h1>
            <p className="ob-lede small-lede">Anyone who opens Cadence will need it. It never leaves this device, and there is no recovery, so pick one you will remember.</p>
            <form
              className="ob-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (pwOk) next();
              }}
            >
              <div className="pw-field">
                <input className="input" type={show ? 'text' : 'password'} autoFocus placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" aria-label="New password" />
                <button type="button" className="pw-eye" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
                  {show ? <EyeOff size={17} strokeWidth={1.6} /> : <Eye size={17} strokeWidth={1.6} />}
                </button>
              </div>
              <div className="strength" data-score={strength.score}>
                {[1, 2, 3, 4].map((i) => (
                  <span key={i} className={i <= strength.score ? 'on' : ''} />
                ))}
                <em>{pw ? strength.label : 'At least 6 characters'}</em>
              </div>
              <input className="input" type={show ? 'text' : 'password'} placeholder="Type it again" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" aria-label="Confirm password" />
              <p className="match">{pw2 && (pw === pw2 ? <span className="ok">Passwords match</span> : <span className="bad">Passwords do not match yet</span>)}</p>
              <Nav onBack={back} canNext={pwOk} />
            </form>
          </Panel>
        )}

        {id === 'subjects' && (
          <Panel k={3}>
            <span className="eyebrow">Your subjects</span>
            <h1 className="ob-title">
              What are you <span className="serif">studying?</span>
            </h1>
            {existing.length > 0 && (
              <div className="ob-existing">
                {existing.map((s) => (
                  <span key={s.id} className="chip active" style={{ cursor: 'default' }}>
                    <span className="dot" style={{ background: s.colour, color: s.colour }} /> {s.name}
                  </span>
                ))}
              </div>
            )}
            <div className="ob-chips">
              {SUGGESTED.filter((n) => !existing.some((e) => e.name.toLowerCase() === n.toLowerCase())).map((n, i) => {
                const on = picked.includes(n);
                const colour = SUBJECT_COLOURS[(existing.length + picked.indexOf(n)) % SUBJECT_COLOURS.length];
                return (
                  <button key={n} type="button" className={cx('ob-chip', on && 'on')} style={{ ['--c' as string]: colour, ['--i' as string]: i }} onClick={() => toggle(n)} aria-pressed={on}>
                    {on ? <Check size={14} strokeWidth={2.4} /> : <Plus size={14} strokeWidth={2} />} {n}
                  </button>
                );
              })}
              {picked
                .filter((n) => !SUGGESTED.includes(n))
                .map((n) => (
                  <button key={n} type="button" className="ob-chip on" style={{ ['--c' as string]: SUBJECT_COLOURS[(existing.length + picked.indexOf(n)) % SUBJECT_COLOURS.length] }} onClick={() => toggle(n)}>
                    <Check size={14} strokeWidth={2.4} /> {n}
                  </button>
                ))}
            </div>
            <form
              className="ob-add"
              onSubmit={(e) => {
                e.preventDefault();
                const n = custom.trim();
                if (n && !picked.includes(n)) setPicked((p) => [...p, n]);
                setCustom('');
              }}
            >
              <input className="input" placeholder="Something else? Type and press Enter" value={custom} onChange={(e) => setCustom(e.target.value)} aria-label="Add a subject" />
            </form>
            <Nav onBack={back} onNext={next} canNext label={picked.length || existing.length ? 'Continue' : 'Skip for now'} />
          </Panel>
        )}

        {id === 'loop' && (
          <Panel k={4}>
            <span className="eyebrow">How Cadence works</span>
            <h1 className="ob-title">
              Your week, in <span className="serif">four beats.</span>
            </h1>
            <div className="beats">
              {[
                { tone: 'orchid' as const, icon: <Layers size={20} strokeWidth={1.8} />, t: 'Flashcards, daily', d: 'A few minutes every single day. Log the count, keep the streak.' },
                { tone: 'lagoon' as const, icon: <Zap size={20} strokeWidth={1.8} />, t: 'One timed paper', d: 'Every weekend, under exam conditions. Full screen, no pause.' },
                { tone: 'coral' as const, icon: <RotateCcw size={20} strokeWidth={1.8} />, t: 'Redo mistakes', d: 'Every mistake is logged and redone until it is fixed.' },
                { tone: 'gold' as const, icon: <CalendarCheck size={20} strokeWidth={1.8} />, t: 'Sunday check-in', d: 'Your week, pre-filled. Reflect, set three goals, go again.' },
              ].map((b, i) => (
                <div key={b.t} className="beat" style={{ ['--i' as string]: i }}>
                  <span className="beat-n">{i + 1}</span>
                  <div>
                    <strong>{b.t}</strong>
                    <p>{b.d}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="ob-actions">
              <Button variant="ghost" onClick={back}>
                <ArrowLeft size={16} strokeWidth={1.8} /> Back
              </Button>
              <Button variant="primary" size="lg" autoFocus onClick={finish}>
                Enter Cadence <ArrowRight size={18} strokeWidth={2} />
              </Button>
            </div>
          </Panel>
        )}
      </main>
      <footer className="gate-foot">
        <Steps step={Math.min(step, order.length - 1)} total={order.length} />
      </footer>
    </div>
  );
}

function Nav({ onBack, onNext, canNext, label = 'Continue' }: { onBack: () => void; onNext?: () => void; canNext: boolean; label?: string }) {
  return (
    <div className="ob-actions">
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeft size={16} strokeWidth={1.8} /> Back
      </Button>
      <Button variant="primary" size="lg" type={onNext ? 'button' : 'submit'} onClick={onNext} disabled={!canNext}>
        {label} <ArrowRight size={18} strokeWidth={2} />
      </Button>
    </div>
  );
}
