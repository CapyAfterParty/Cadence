import { useId } from 'react';

/**
 * The Cadence mark: an open loop (the weekly cycle) with a bright beat at
 * its opening, where each new week begins.
 */
export function LogoMark({ size = '2rem', animated }: { size?: string; animated?: boolean }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={animated ? 'logo-mark animated' : 'logo-mark'} aria-hidden="true">
      <defs>
        <linearGradient id={`lg${id}`} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#ffb06b" />
          <stop offset="0.35" stopColor="#ff4f7b" />
          <stop offset="0.7" stopColor="#a96bff" />
          <stop offset="1" stopColor="#4d9bff" />
        </linearGradient>
        <linearGradient id={`hl${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`dot${id}`}>
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.6" stopColor="#ffe9dc" />
          <stop offset="1" stopColor="#ffb38a" />
        </radialGradient>
        <filter id={`gl${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
      </defs>
      <path className="lm-ring" d="M48.38 20.53 A20 20 0 1 0 48.38 43.47" fill="none" stroke={`url(#lg${id})`} strokeWidth="9" strokeLinecap="round" />
      <path d="M40.5 15.2 A18.5 18.5 0 0 0 14.2 26" fill="none" stroke={`url(#hl${id})`} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      <circle cx="53" cy="32" r="6" fill="#ffc9a8" filter={`url(#gl${id})`} className="lm-glow" />
      <circle cx="53" cy="32" r="4.4" fill={`url(#dot${id})`} className="lm-dot" />
    </svg>
  );
}

export function Wordmark({ size = '1.15rem' }: { size?: string }) {
  return (
    <span className="wordmark" style={{ fontSize: size }}>
      cadence
    </span>
  );
}

export function Logo({ size = '2rem' }: { size?: string }) {
  return (
    <span className="logo">
      <LogoMark size={size} />
      <Wordmark />
    </span>
  );
}
