// Illustrative, animated charts for the homepage. Every SVG is drawn at its
// real pixel size (measured), so strokes, glows and draw-in animations stay crisp.
import { Fragment, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import './fancy.css';

export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

const css = (o: Record<string, string | number>) => o as CSSProperties;

function Glow({ id, std = 3 }: { id: string; std?: number }) {
  return (
    <filter id={id} x="-20%" y="-50%" width="140%" height="200%">
      <feGaussianBlur stdDeviation={std} result="b" />
      <feMerge>
        <feMergeNode in="b" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  );
}

/* ---------- Pill matrix: rows of pills on a day grid ---------- */

export function PillMatrix({ rows, columns, highlight = columns.length - 1 }: { rows: { label: string; values: number[] }[]; columns: string[]; highlight?: number }) {
  const max = Math.max(1, ...rows.flatMap((r) => r.values));
  return (
    <div className="pm" style={{ gridTemplateColumns: `auto repeat(${columns.length}, minmax(0, 1fr))` }}>
      {rows.map((r, ri) => (
        <Fragment key={r.label + ri}>
          <span className="pm-label">{r.label}</span>
          {r.values.map((v, ci) => (
            <span key={ci} className="pm-cell">
              <span className="pm-track" />
              {v > 0 && (
                <span
                  className={ci === highlight ? 'pm-pill on' : 'pm-pill'}
                  title={`${columns[ci]} · ${Math.round(v)} min`}
                  style={{ width: `${Math.max(30, (v / max) * 100)}%`, animationDelay: `${120 + (ri * columns.length + ci) * 22}ms` }}
                />
              )}
            </span>
          ))}
        </Fragment>
      ))}
      <span />
      {columns.map((c, i) => (
        <span key={i} className={i === highlight ? 'pm-axis on' : 'pm-axis'}>
          {c}
        </span>
      ))}
    </div>
  );
}

/* ---------- Dual smooth-step lines ---------- */

export function DualLine({
  series,
  labels,
  height = 104,
}: {
  series: { values: number[]; colour: string; faint?: boolean }[];
  labels: string[];
  height?: number;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const id = useId().replace(/:/g, '');
  const raw = Math.max(1, ...series.flatMap((s) => s.values));
  const step = raw <= 4 ? 1 : Math.pow(10, Math.floor(Math.log10(raw / 2)));
  const hi = Math.ceil(raw / 2 / step) * step * 2;
  const padL = 26;
  const padR = 8;
  const padT = 8;
  const plotH = height - 26;
  const n = labels.length;
  const x = (i: number) => padL + (n === 1 ? (w - padL - padR) / 2 : (i / (n - 1)) * (w - padL - padR));
  const y = (v: number) => padT + (1 - v / hi) * (plotH - padT);
  const path = (vals: number[]) =>
    vals.reduce((d, v, i) => {
      if (i === 0) return `M${x(0)},${y(v)}`;
      const mx = (x(i - 1) + x(i)) / 2;
      return `${d} C${mx},${y(vals[i - 1])} ${mx},${y(v)} ${x(i)},${y(v)}`;
    }, '');
  return (
    <div ref={ref} className="fancy-plot" style={{ height }}>
      {w > 0 && (
        <svg width={w} height={height}>
          <defs>
            <Glow id={`g${id}`} std={3.5} />
          </defs>
          {[0, hi / 2, hi].map((t) => (
            <text key={t} x={0} y={y(t) + 4} className="axis-text">
              {t >= 1000 ? `${t / 1000}k` : t}
            </text>
          ))}
          {series.map((s, si) => (
            <g key={si} filter={s.faint ? undefined : `url(#g${id})`} opacity={s.faint ? 0.55 : 1}>
              <path
                d={path(s.values)}
                pathLength={1}
                className="draw"
                style={{ animationDelay: `${150 + si * 180}ms` }}
                fill="none"
                stroke={s.colour}
                strokeWidth={s.faint ? 1.5 : 2.5}
                strokeLinecap="round"
                strokeDasharray={s.faint ? undefined : undefined}
              />
            </g>
          ))}
          {series[0] && (
            <circle cx={x(n - 1)} cy={y(series[0].values[n - 1] ?? 0)} r={4.5} fill={series[0].colour} className="pop" filter={`url(#g${id})`} />
          )}
          {labels.map((l, i) => (
            <text key={i} x={x(i)} y={height - 4} textAnchor="middle" className={i === n - 1 ? 'axis-text on' : 'axis-text'}>
              {l}
            </text>
          ))}
        </svg>
      )}
    </div>
  );
}

/* ---------- Capsules: glossy tracks with stacked fills ---------- */

export function Capsules({ items, labels, highlight = labels.length - 1, height = 104 }: { items: { a: number; b: number }[]; labels: string[]; highlight?: number; height?: number }) {
  const max = Math.max(1, ...items.map((i) => i.a + i.b));
  return (
    <div className="caps" style={{ height }}>
      {items.map((it, i) => {
        const ah = (it.a / max) * 72;
        const bh = (it.b / max) * 72;
        return (
          <div key={i} className="cap-col" title={`${labels[i]}: ${it.a} cleared, ${it.b} logged`}>
            <div className={i === highlight ? 'cap on' : 'cap'}>
              <div className="cap-fill" style={{ animationDelay: `${120 + i * 50}ms` }}>
                {it.b > 0 && <span className="seg b" style={{ height: `${Math.max(8, bh)}%` }} />}
                {it.a > 0 && <span className="seg a" style={{ height: `${Math.max(8, ah)}%` }} />}
              </div>
            </div>
            <span className={i === highlight ? 'cap-label on' : 'cap-label'}>{labels[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Waves: flowing sine ribbons ---------- */

export interface WaveLine {
  amp: number; // px
  cycles: number; // whole cycles across the width, so the loop is seamless
  colour: string;
  speed: number; // seconds per loop
  phase?: number;
  width?: number;
  opacity?: number;
}

export function Waves({ lines, height = 72 }: { lines: WaveLine[]; height?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const id = useId().replace(/:/g, '');
  const mid = height / 2;
  const build = (l: WaveLine) => {
    let d = '';
    for (let px = 0; px <= w * 2; px += 4) {
      const a = (px / w) * Math.PI * 2 * l.cycles + (l.phase ?? 0);
      const yy = mid + l.amp * (Math.sin(a) * 0.75 + Math.sin(a * 2 + (l.phase ?? 0) * 1.7) * 0.25);
      d += `${px === 0 ? 'M' : 'L'}${px},${yy.toFixed(1)}`;
    }
    return d;
  };
  return (
    <div ref={ref} className="waves" style={{ height }}>
      {w > 0 && (
        <svg width={w} height={height}>
          <defs>
            <Glow id={`w${id}`} std={2.5} />
          </defs>
          <g filter={`url(#w${id})`}>
            {lines.map((l, i) => (
              <path
                key={i}
                d={build(l)}
                fill="none"
                stroke={l.colour}
                strokeWidth={l.width ?? 1.6}
                opacity={l.opacity ?? 1}
                className="wave-path"
                style={css({ '--w': `${w}px`, '--dur': `${l.speed}s` })}
              />
            ))}
          </g>
        </svg>
      )}
    </div>
  );
}

/* ---------- Barcode: one thin line per day ---------- */

export function Barcode({ build, height = 92 }: { build: (count: number) => { values: (number | null)[]; highlight: number }; height?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const count = Math.max(10, Math.floor(w / 6));
  const { values, highlight } = w > 0 ? build(count) : { values: [], highlight: -1 };
  return (
    <div ref={ref} className="barcode" style={{ height }}>
      {values.map((v, i) => {
        const near = Math.abs(i - highlight);
        const cls = i === highlight ? 'bc on' : near <= 2 && highlight >= 0 ? 'bc near' : v == null ? 'bc idle' : 'bc';
        const h = v == null ? 16 + ((i * 37) % 11) : 30 + (v / 100) * 70;
        return <span key={i} className={cls} style={{ height: `${Math.min(100, h)}%`, animationDelay: `${Math.min(600, i * 8)}ms` }} title={v == null ? undefined : `${Math.round(v)}%`} />;
      })}
      {highlight >= 0 && <span className="bc-glow" style={{ left: `calc(${((highlight + 0.5) / values.length) * 100}%)` }} />}
    </div>
  );
}

/* ---------- Arc gauge: ticks over the top half ---------- */

export function ArcGauge({ value, target, ticks = 46, label = 'Target' }: { value: number | null; target?: number; ticks?: number; label?: string }) {
  const cx = 130;
  const cy = 128;
  const r1 = 92;
  const r2 = 116;
  const valueTick = value == null ? -1 : Math.round((Math.min(100, value) / 100) * ticks);
  const items = Array.from({ length: ticks + 1 }, (_, i) => {
    const a = Math.PI + (i / ticks) * Math.PI;
    const isV = i === valueTick;
    const inner = isV ? r1 - 8 : r1;
    return { x1: cx + inner * Math.cos(a), y1: cy + inner * Math.sin(a), x2: cx + r2 * Math.cos(a), y2: cy + r2 * Math.sin(a), on: i <= valueTick, isV };
  });
  const ta = target != null ? Math.PI + (Math.min(100, target) / 100) * Math.PI : 0;
  const tip = (r: number) => [cx + r * Math.cos(ta), cy + r * Math.sin(ta)];
  const [mx, my] = tip(r2 + 8);
  const side = 6;
  const perp = ta + Math.PI / 2;
  const [bx, by] = tip(r2 + 18);
  return (
    <svg viewBox="0 0 260 140" className="arc-gauge" role="img" aria-label={`Average ${value == null ? 'none' : Math.round(value) + '%'}${target != null ? `, target ${target}%` : ''}`}>
      {items.map((t, i) => (
        <line
          key={i}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          strokeLinecap="round"
          strokeWidth={t.isV ? 4.5 : 3.4}
          stroke={t.isV ? 'var(--accent)' : t.on ? '#fff' : 'rgba(255,255,255,0.22)'}
          className="tick"
          style={{ animationDelay: `${200 + i * 14}ms`, filter: t.isV ? 'drop-shadow(0 0 6px rgba(255,106,43,0.9))' : undefined }}
        />
      ))}
      {target != null && (
        <>
          <polygon
            points={`${mx},${my} ${bx + side * Math.cos(perp)},${by + side * Math.sin(perp)} ${bx - side * Math.cos(perp)},${by - side * Math.sin(perp)}`}
            fill="#fff"
          />
          <text x={tip(r2 + 30)[0]} y={tip(r2 + 30)[1] + 3} textAnchor="middle" className="gauge-label">
            {label}
          </text>
        </>
      )}
    </svg>
  );
}

/* ---------- Sunset scene, drawn (no photos) ---------- */

export function Scene() {
  const id = useId().replace(/:/g, '');
  return (
    <div className="scene" aria-hidden="true">
      <svg viewBox="0 0 400 640" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={`sky${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#1b1216" />
            <stop offset="0.25" stopColor="#3a1f1a" />
            <stop offset="0.45" stopColor="#6e3220" />
            <stop offset="0.6" stopColor="#a8471f" />
            <stop offset="0.7" stopColor="#d9692e" />
            <stop offset="0.74" stopColor="#f6a45e" />
          </linearGradient>
          <radialGradient id={`sun${id}`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#fff1d6" stopOpacity="1" />
            <stop offset="0.12" stopColor="#ffc07a" stopOpacity="0.95" />
            <stop offset="0.45" stopColor="#ff7a33" stopOpacity="0.35" />
            <stop offset="1" stopColor="#ff6a2b" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`haze${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#f08a4b" stopOpacity="0.55" />
            <stop offset="1" stopColor="#1a0f0b" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="400" height="640" fill={`url(#sky${id})`} />
        <g opacity="0.5" className="scene-clouds">
          <ellipse cx="120" cy="250" rx="160" ry="10" fill="#ffb38a" opacity="0.35" />
          <ellipse cx="300" cy="300" rx="140" ry="8" fill="#ff9a6a" opacity="0.4" />
          <ellipse cx="180" cy="350" rx="190" ry="12" fill="#ffc9a0" opacity="0.3" />
          <ellipse cx="320" cy="180" rx="110" ry="6" fill="#ff8fa3" opacity="0.3" />
        </g>
        <circle cx="210" cy="468" r="210" fill={`url(#sun${id})`} className="scene-sun" />
        <path d="M0 470 C 50 440 90 452 130 436 S 210 420 250 440 S 340 430 400 446 V640 H0Z" fill="#5a2c18" opacity="0.85" />
        <rect x="0" y="440" width="400" height="60" fill={`url(#haze${id})`} />
        <path d="M0 500 C 60 470 110 486 160 470 S 260 462 300 484 S 370 470 400 478 V640 H0Z" fill="#2a1710" />
        <path d="M0 540 C 80 516 140 530 200 520 S 330 510 400 528 V640 H0Z" fill="#120b08" />
        <path d="M0 580 C 100 566 200 576 260 568 S 360 560 400 570 V640 H0Z" fill="#070505" />
      </svg>
    </div>
  );
}
