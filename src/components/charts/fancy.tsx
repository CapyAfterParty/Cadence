// Summit OS instruments: thin, exact, softly lit. No chunky shapes.
// SVGs are drawn at their measured pixel size so hairlines stay crisp.
import { useId, useLayoutEffect, useRef, useState } from 'react';
import './fancy.css';

export type Hue = 'clay' | 'sage' | 'mist' | 'lavender' | 'sand' | 'rose';

export const HUES: Record<Hue, [string, string]> = {
  clay: ['#ffb3d1', '#ff4f97'],
  sage: ['#d9ffb0', '#8fe36b'],
  mist: ['#b9ccff', '#4d7cff'],
  lavender: ['#d9ccff', '#8a6cff'],
  sand: ['#ffe0a8', '#ff9a3d'],
  rose: ['#ffc2d2', '#ff5c7a'],
};

export function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setSize({ w: r.width, h: r.height });
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size.w, size.h] as const;
}

const useGid = () => useId().replace(/:/g, '');

function Glow({ id, std = 2.5 }: { id: string; std?: number }) {
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

function smooth(pts: [number, number][]) {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/* ---------- Tick ruler: a fine scale with marker dots (min, value, max) ---------- */

export function TickRuler({ value, min, max, labels, ticks = 34 }: { value: number; min: number; max: number; labels?: [string, string, string]; ticks?: number }) {
  const span = max - min || 1;
  const at = Math.round(((Math.max(min, Math.min(max, value)) - min) / span) * (ticks - 1));
  return (
    <div className="ruler">
      <div className="ruler-marks">
        <i className="mark lo" style={{ left: '0%' }} />
        <i className="mark val" style={{ left: `${(at / (ticks - 1)) * 100}%` }} />
        <i className="mark hi" style={{ left: '100%' }} />
      </div>
      <div className="ruler-ticks">
        {Array.from({ length: ticks }, (_, i) => (
          <span key={i} className={i % 6 === 0 ? 'major' : i === at ? 'on' : undefined} />
        ))}
      </div>
      {labels && (
        <div className="ruler-labels">
          <span>{labels[0]}</span>
          <span className="mid">{labels[1]}</span>
          <span>{labels[2]}</span>
        </div>
      )}
    </div>
  );
}

/* ---------- Waveform: thin bars, the current one lit ---------- */

export function Bars({
  values,
  labels,
  highlight = values.length - 1,
  hue = 'sage',
  format = (v: number) => String(v),
}: {
  values: number[];
  labels: string[];
  highlight?: number;
  hue?: Hue;
  format?: (v: number) => string;
}) {
  const max = Math.max(1, ...values);
  const [a] = HUES[hue];
  const fillers = 3;
  return (
    <div className="wave" style={{ ['--hw' as string]: a }}>
      <div className="wave-plot">
        {values.map((v, i) => (
          <div key={i} className="wave-group" title={`${labels[i]}: ${format(v)}`}>
            {Array.from({ length: fillers }, (_, k) => (
              <span key={`f${k}`} className="wt filler" style={{ height: `${12 + ((i * 7 + k * 5) % 14)}%` }} />
            ))}
            <span className={i === highlight ? 'wt bar on' : 'wt bar'} style={{ height: v > 0 ? `max(14%, ${(v / max) * 100}%)` : '8%' }} />
            {Array.from({ length: fillers }, (_, k) => (
              <span key={`g${k}`} className="wt filler" style={{ height: `${10 + ((i * 3 + k * 9) % 16)}%` }} />
            ))}
          </div>
        ))}
      </div>
      <div className="wave-labels">
        {labels.map((l, i) => (
          <span key={i} className={i === highlight ? 'on' : undefined}>
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- Range line: gradient track with a triangle marker ---------- */

export function RangeLine({ value, target, from = '#7ee2a8', to = '#ff5c7a' }: { value: number | null; target?: number; from?: string; to?: string }) {
  const v = value == null ? null : Math.max(0, Math.min(100, value));
  return (
    <div className="range">
      <div className="range-track" style={{ background: `linear-gradient(90deg, ${to}, #ffd36b 55%, ${from})` }} />
      {target != null && <i className="range-target" style={{ left: `${target}%` }} />}
      {v != null && <i className="range-marker" style={{ left: `${v}%` }} />}
    </div>
  );
}

/* ---------- Dot row: one dot per day, done days lit ---------- */

export function DotRow({ values, labels, current }: { values: boolean[]; labels?: string[]; current?: number }) {
  return (
    <div className="dotrow">
      <div className="dr-dots">
        {values.map((on, i) => (
          <span key={i} className={['dr', on && 'on', i === current && 'now'].filter(Boolean).join(' ')} />
        ))}
      </div>
      {labels && (
        <div className="dr-labels">
          {labels.map((l, i) => (
            <span key={i} className={i === current ? 'on' : undefined}>
              {l}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Ring: a hairline circle around a number, with a lit arc ---------- */

export function Ring({ value, label, size = '5.5rem' }: { value: number; label: string; size?: string }) {
  const id = useGid();
  const r = 44;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="ring-num" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <Glow id={`rg${id}`} std={1.8} />
        </defs>
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} transform="rotate(-90 50 50)" filter={`url(#rg${id})`} />
      </svg>
      <span>{label}</span>
    </div>
  );
}

/* ---------- Loop ring: four thin arcs, one per beat ---------- */

export function LoopRing({ parts, children }: { parts: { value: number; label: string; hue: Hue }[]; children?: React.ReactNode }) {
  const [ref, w] = useSize<HTMLDivElement>();
  const id = useGid();
  const S = w;
  const stroke = Math.max(2.5, S * 0.018);
  const r = S / 2 - stroke * 3;
  const c = S / 2;
  const n = parts.length;
  const gap = 0.04;
  const len = 1 / n - gap;
  return (
    <div ref={ref} className="loop-ring">
      {S > 40 && (
        <svg width={S} height={S}>
          <defs>
            <Glow id={`lr${id}`} std={S * 0.012} />
          </defs>
          <g transform={`rotate(-90 ${c} ${c})`}>
            {parts.map((p, i) => {
              const s = i / n + gap / 2;
              const v = Math.max(0, Math.min(1, p.value));
              return (
                <g key={i}>
                  <circle cx={c} cy={c} r={r} pathLength={1} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={1} strokeDasharray={`${len} 1`} strokeDashoffset={-s} />
                  {v > 0.001 && (
                    <circle cx={c} cy={c} r={r} pathLength={1} fill="none" stroke={HUES[p.hue][0]} strokeWidth={stroke} strokeLinecap="round" filter={`url(#lr${id})`} style={{ strokeDasharray: `${len * v} 1`, strokeDashoffset: -s }} />
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      )}
      <div className="loop-ring-center">{children}</div>
    </div>
  );
}

/* ---------- Spark: a hairline curve with a faint fill ---------- */

export function Spark({ values, compare, labels, hue = 'lavender' }: { values: number[]; compare?: number[]; labels: string[]; hue?: Hue }) {
  const [ref, w, h] = useSize<HTMLDivElement>();
  const id = useGid();
  const n = values.length;
  const hi = Math.max(1, ...values, ...(compare ?? [])) * 1.15;
  const pad = 8;
  const top = 10;
  const bottom = h - 24;
  const x = (i: number) => pad + (n === 1 ? (w - pad * 2) / 2 : (i / (n - 1)) * (w - pad * 2));
  const y = (v: number) => top + (1 - v / hi) * (bottom - top);
  const pts = values.map((v, i) => [x(i), y(v)] as [number, number]);
  const d = smooth(pts);
  const last = pts[pts.length - 1];
  const [a] = HUES[hue];
  return (
    <div ref={ref} className="spark">
      {w > 0 && h > 0 && (
        <svg width={w} height={h}>
          <defs>
            <Glow id={`sg${id}`} />
            <linearGradient id={`sf${id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={a} stopOpacity="0.22" />
              <stop offset="1" stopColor={a} stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`sm${id}`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.25" stopColor="#fff" stopOpacity="1" />
            </linearGradient>
            <mask id={`sk${id}`}>
              <rect width={w} height={h} fill={`url(#sm${id})`} />
            </mask>
          </defs>
          {compare && <path d={smooth(compare.map((v, i) => [x(i), y(v)] as [number, number]))} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth={1} strokeDasharray="2 4" />}
          <path d={`${d} L${last[0]},${bottom} L${pts[0][0]},${bottom} Z`} fill={`url(#sf${id})`} mask={`url(#sk${id})`} />
          <path d={d} fill="none" stroke={a} strokeWidth={1.6} strokeLinecap="round" filter={`url(#sg${id})`} />
          <circle cx={last[0]} cy={last[1]} r={3.2} fill="#fff" filter={`url(#sg${id})`} />
          {labels.map((l, i) => (
            <text key={i} x={x(i)} y={h - 4} textAnchor="middle" className={i === n - 1 ? 'axis-text on' : 'axis-text'}>
              {l}
            </text>
          ))}
        </svg>
      )}
    </div>
  );
}

/* ---------- Multi-series: the focused course in light, others whispered ---------- */

export function MultiLine({
  series,
  labels,
  target,
  focus,
  hue = 'mist',
}: {
  series: { id: string; colour: string; values: (number | null)[] }[];
  labels: string[];
  target?: number;
  focus?: string;
  hue?: Hue;
}) {
  const [ref, w, h] = useSize<HTMLDivElement>();
  const id = useGid();
  const n = labels.length;
  const pad = 8;
  const top = 16;
  const bottom = h - 24;
  const all = series.flatMap((s) => s.values.filter((v): v is number => v != null));
  const ranged = (focus ? series.filter((s) => s.id === focus) : series).flatMap((s) => s.values.filter((v): v is number => v != null));
  const base = ranged.length ? ranged : all;
  const lo = Math.max(0, Math.min(...base, target ?? 100) - 8);
  const hi = Math.min(100, Math.max(...base, target ?? 0) + 6);
  const x = (i: number) => pad + (n === 1 ? (w - pad * 2) / 2 : (i / (n - 1)) * (w - pad * 2));
  const y = (v: number) => top + (1 - (v - lo) / (hi - lo || 1)) * (bottom - top);
  const ordered = [...series].sort((a, b) => (a.id === focus ? 1 : b.id === focus ? -1 : 0));
  const [a] = HUES[hue];
  return (
    <div ref={ref} className="mline">
      {w > 0 && h > 0 && all.length > 0 && (
        <svg width={w} height={h}>
          <defs>
            <Glow id={`mg${id}`} />
            <linearGradient id={`mf${id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={a} stopOpacity="0.2" />
              <stop offset="1" stopColor={a} stopOpacity="0" />
            </linearGradient>
          </defs>
          {target != null && (
            <>
              <line x1={pad} x2={w - pad} y1={y(target)} y2={y(target)} stroke="rgba(255,255,255,0.3)" strokeDasharray="2 5" />
              <text x={w - pad} y={y(target) - 8} textAnchor="end" className="axis-text">
                target {target}%
              </text>
            </>
          )}
          {ordered.map((s) => {
            const pts = s.values.map((v, i) => (v == null ? null : ([x(i), y(v)] as [number, number]))).filter(Boolean) as [number, number][];
            if (!pts.length) return null;
            const on = !focus || s.id === focus;
            const d = smooth(pts);
            const last = pts[pts.length - 1];
            return (
              <g key={s.id} opacity={on ? 1 : 0.18}>
                {on && pts.length > 1 && <path d={`${d} L${last[0]},${bottom} L${pts[0][0]},${bottom} Z`} fill={`url(#mf${id})`} />}
                <path d={d} fill="none" stroke={on ? a : 'rgba(255,255,255,0.6)'} strokeWidth={on ? 1.6 : 1} strokeLinecap="round" filter={on ? `url(#mg${id})` : undefined} />
                {on && <circle cx={last[0]} cy={last[1]} r={3.2} fill="#fff" filter={`url(#mg${id})`} />}
              </g>
            );
          })}
          {labels.map((l, i) =>
            n <= 6 || i % 2 === (n - 1) % 2 ? (
              <text key={i} x={x(i)} y={h - 4} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} className={i === n - 1 ? 'axis-text on' : 'axis-text'}>
                {l}
              </text>
            ) : null,
          )}
        </svg>
      )}
    </div>
  );
}

/* ---------- Arc: a half circle of fine ticks, average against target ---------- */

export function Arc({ value, target, hue = 'sage' }: { value: number | null; target?: number; hue?: Hue }) {
  const ticks = 60;
  const cx = 100;
  const cy = 100;
  const v = value == null ? -1 : Math.round((Math.min(100, value) / 100) * ticks);
  const t = target == null ? -1 : Math.round((Math.min(100, target) / 100) * ticks);
  const [a] = HUES[hue];
  return (
    <svg viewBox="-6 -6 212 112" className="arc" role="img" aria-label={`Average ${value == null ? 'none' : Math.round(value) + '%'}${target != null ? `, target ${target}%` : ''}`}>
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const ang = Math.PI + (i / ticks) * Math.PI;
        const isT = i === t;
        const r1 = isT ? 70 : i % 10 === 0 ? 76 : 80;
        const r2 = isT ? 98 : 90;
        const on = i <= v;
        return (
          <line
            key={i}
            x1={cx + r1 * Math.cos(ang)}
            y1={cy + r1 * Math.sin(ang)}
            x2={cx + r2 * Math.cos(ang)}
            y2={cy + r2 * Math.sin(ang)}
            stroke={isT ? '#fff' : on ? a : 'rgba(255,255,255,0.18)'}
            strokeWidth={isT ? 1.8 : 1.1}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}
