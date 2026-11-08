import { useSyncExternalStore } from 'react';

/** A tiny global store. Optionally persisted to localStorage. */
export function createStore<T>(initial: T, persistKey?: string) {
  let state = initial;
  if (persistKey) {
    try {
      const raw = localStorage.getItem(persistKey);
      if (raw != null) {
        const parsed = JSON.parse(raw);
        const isObj = (v: unknown) => v !== null && typeof v === 'object' && !Array.isArray(v);
        state = isObj(initial) && isObj(parsed) ? { ...initial, ...parsed } : parsed;
      }
    } catch {
      /* storage blocked or corrupt: keep defaults */
    }
  }
  const listeners = new Set<() => void>();
  const get = () => state;
  const set = (next: T | ((s: T) => T)) => {
    state = typeof next === 'function' ? (next as (s: T) => T)(state) : next;
    if (persistKey) {
      try {
        localStorage.setItem(persistKey, JSON.stringify(state));
      } catch {
        /* ignore */
      }
    }
    listeners.forEach((l) => l());
  };
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  };
  const use = () => useSyncExternalStore(subscribe, get);
  return { get, set, subscribe, use };
}
