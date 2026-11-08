// Password lock. The password itself is never stored: only a PBKDF2-SHA256
// verifier (salt + hash). The verifier lives in IndexedDB next to the data,
// so clearing localStorage alone cannot bypass the lock.
//
// Optional site password: set VITE_SITE_KEY at build time (see
// scripts/hash-password.mjs). Then a fresh browser that has never been set up
// must enter that password before it can even start onboarding.
import { db } from '../db/db';
import { createStore } from './store';

export interface Verifier {
  salt: string; // base64
  hash: string; // base64
  iterations: number;
}

const ITERATIONS = 310_000;
const META_KEY = 'lock';
const ACTIVITY_KEY = 'cadence.activity';
const THROTTLE_KEY = 'cadence.throttle';

const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, 256);
  return new Uint8Array(bits);
}

/** Constant-time comparison. */
function same(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function makeVerifier(password: string): Promise<Verifier> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: b64(salt), hash: b64(await derive(password, salt, ITERATIONS)), iterations: ITERATIONS };
}

export async function checkPassword(password: string, v: Verifier) {
  return same(await derive(password, unb64(v.salt), v.iterations), unb64(v.hash));
}

/** "salt:hash:iterations" baked in at build time, or null. */
export function siteKey(): Verifier | null {
  const raw = (import.meta.env.VITE_SITE_KEY as string | undefined)?.trim();
  if (!raw) return null;
  const [salt, hash, it] = raw.split(':');
  if (!salt || !hash) return null;
  return { salt, hash, iterations: Number(it) || ITERATIONS };
}

export async function getVerifier(): Promise<Verifier | null> {
  const row = await db.meta.get(META_KEY);
  return (row?.value as Verifier | undefined) ?? null;
}

export async function setPassword(password: string) {
  await db.meta.put({ key: META_KEY, value: await makeVerifier(password) });
}

/* ---------- Lock state ---------- */

export type LockPhase = 'loading' | 'site' | 'onboarding' | 'locked' | 'unlocked';

export const lockState = createStore<{ phase: LockPhase; siteCleared: boolean }>({ phase: 'loading', siteCleared: false });

export const security = createStore<{ autoLockMin: number }>({ autoLockMin: 15 }, 'cadence.security');

function recentlyActive() {
  try {
    const last = Number(sessionStorage.getItem(ACTIVITY_KEY) || 0);
    return last > 0 && Date.now() - last < security.get().autoLockMin * 60_000;
  } catch {
    return false;
  }
}

export function markActive() {
  try {
    sessionStorage.setItem(ACTIVITY_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/** Works out where the app should start: site gate, onboarding, lock, or straight in. */
export async function boot() {
  const v = await getVerifier();
  if (!v) {
    lockState.set({ phase: siteKey() ? 'site' : 'onboarding', siteCleared: false });
    return;
  }
  lockState.set({ phase: recentlyActive() ? 'unlocked' : 'locked', siteCleared: true });
}

export function lockNow() {
  try {
    sessionStorage.removeItem(ACTIVITY_KEY);
  } catch {
    /* ignore */
  }
  if (lockState.get().phase === 'unlocked') lockState.set((s) => ({ ...s, phase: 'locked' }));
}

export function enterApp() {
  markActive();
  lockState.set((s) => ({ ...s, phase: 'unlocked' }));
}

/* ---------- Throttling wrong attempts ---------- */

interface Throttle {
  fails: number;
  until: number;
}

export function getThrottle(): Throttle {
  try {
    return { fails: 0, until: 0, ...JSON.parse(localStorage.getItem(THROTTLE_KEY) || '{}') };
  } catch {
    return { fails: 0, until: 0 };
  }
}

function saveThrottle(t: Throttle) {
  try {
    localStorage.setItem(THROTTLE_KEY, JSON.stringify(t));
  } catch {
    /* ignore */
  }
}

/** After 5 wrong tries: wait 30s, then double each time (max 15 min). */
export function registerFail() {
  const t = getThrottle();
  t.fails += 1;
  if (t.fails >= 5) t.until = Date.now() + Math.min(15 * 60_000, 30_000 * 2 ** (t.fails - 5));
  saveThrottle(t);
  return t;
}

export const clearThrottle = () => saveThrottle({ fails: 0, until: 0 });

/** Tries the password against the local verifier (or the site key on a fresh browser). */
export async function attemptUnlock(password: string, against: 'local' | 'site'): Promise<'ok' | 'wrong' | 'wait'> {
  if (getThrottle().until > Date.now()) return 'wait';
  const v = against === 'site' ? siteKey() : await getVerifier();
  if (v && (await checkPassword(password, v))) {
    clearThrottle();
    return 'ok';
  }
  registerFail();
  return 'wrong';
}

export async function eraseEverything() {
  await db.delete();
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
  location.reload();
}

export function passwordStrength(p: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p) && /[^\w]/.test(p)) s++;
  if (p.length < 6) s = 0;
  const score = Math.min(4, s) as 0 | 1 | 2 | 3 | 4;
  return { score, label: ['Too short', 'Weak', 'Fair', 'Strong', 'Excellent'][score] };
}
