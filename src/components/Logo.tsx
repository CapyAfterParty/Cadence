import { useId, useMemo } from 'react';

/**
 * The Cadence mark: an ensō, the single brushstroke circle of Zen.
 * Open, imperfect, and it is the weekly loop.
 * The shape is generated as a tapered stroke so it reads like ink.
 */
function ensoPath(R = 24, base = 7.2) {
  const n = 96;
  const start = (-58 * Math.PI) / 180; // begins upper right
  const sweep = (322 * Math.PI) / 180; // and travels round, leaving a gap
  const outer: [number, number][] = [];
  const inner: [number, number][] = [];
  const centre: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // Pressure: lands soft, swells through the stroke, lifts away thin.
    const w = base * (0.42 + 0.75 * Math.sin(Math.PI * Math.min(1, t * 1.08)) ** 0.8) * (1 - 0.7 * t ** 3);
    const wob = 0.6 * Math.sin(t * 9.0) + 0.35 * Math.sin(t * 23.0);
    const a = start - t * sweep; // counter-clockwise on screen
    const r = R + wob * 0.35;
    const c = Math.cos(a);
    const s = Math.sin(a);
    outer.push([32 + (r + w / 2) * c, 32 + (r + w / 2) * s]);
    inner.push([32 + (r - w / 2 + wob * 0.15) * c, 32 + (r - w / 2 + wob * 0.15) * s]);
    centre.push([32 + r * c, 32 + r * s]);
  }
  const f = (p: [number, number]) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`;
  const shape = `M${f(outer[0])} ` + outer.slice(1).map((p) => `L${f(p)}`).join(' ') + ' ' + inner.reverse().map((p) => `L${f(p)}`).join(' ') + ' Z';
  const spine = `M${f(centre[0])} ` + centre.slice(1).map((p) => `L${f(p)}`).join(' ');
  return { shape, spine };
}

export function LogoMark({ size = '2rem', draw }: { size?: string; draw?: boolean }) {
  const id = useId().replace(/:/g, '');
  const { shape, spine } = useMemo(() => ensoPath(), []);
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={draw ? 'logo-mark draw-in' : 'logo-mark'} aria-hidden="true">
      {draw && (
        <defs>
          <linearGradient id={`ink${id}`} x1="0.1" y1="0" x2="0.9" y2="1">
            <stop offset="0" stopColor="#f2e2b8" />
            <stop offset="0.45" stopColor="#e7a37c" />
            <stop offset="1" stopColor="#e3a4b1" />
          </linearGradient>
          <mask id={`m${id}`}>
            <path d={spine} fill="none" stroke="#fff" strokeWidth="12" strokeLinecap="round" pathLength={1} className="enso-reveal" />
          </mask>
        </defs>
      )}
      <path d={shape} fill={draw ? `url(#ink${id})` : 'currentColor'} mask={draw ? `url(#m${id})` : undefined} />
    </svg>
  );
}

/** Large, slowly breathing ensō for the lock screen and onboarding. */
export function Enso({ size = '9rem' }: { size?: string }) {
  return (
    <div className="enso" style={{ width: size, height: size }} aria-hidden="true">
      <LogoMark size="100%" draw />
    </div>
  );
}

export function Wordmark({ size = '1.1rem' }: { size?: string }) {
  return (
    <span className="wordmark" style={{ fontSize: size }}>
      cadence
    </span>
  );
}

export function Logo({ size = '1.6rem' }: { size?: string }) {
  return (
    <span className="logo">
      <LogoMark size={size} />
      <Wordmark />
    </span>
  );
}
