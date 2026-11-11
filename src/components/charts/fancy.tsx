// Summit OS charts: soft, rounded and calm. Thick round-capped strokes,
// gentle gradient fills, one halo for "now". Drawn at measured pixel size.
import { useId, useLayoutEffect, useRef, useState } from 'react';
import './fancy.css';

export type Hue = 'clay' | 'sage' | 'mist' | 'lavender' | 'sand' | 'rose';

/** Light and deep ends of each hue, for gradients. */
export const HUES: Record<Hue, [string, string]> = {
  clay: ['#f2c09f', '#d88a64'],
  sage: ['#c3e2c9', '#7fb08b'],
  mist: ['#c4d8ee', '#7f9fc6'],
  lavender: ['#d6caf2', '#9d89cc'],
  sand: ['#f2e2b8', '#d4b571'],
  rose: ['#f2c6cf', '#cf8796'],
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

/** Catmull-Rom spline through points, as cubic beziers. */
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

/* ---------- Loop ring: four soft arcs, one hue per beat ---------- */

export function LoopRing({ parts, children }: { parts: { value: number; label: string; hue: Hue }[]; children?: React.ReactNode }) {
  const [ref, w] = useSize<HTMLDivElement>();
  const id = useGid();
  const S = w;
  const stroke = S * 0.075;
  const r = S / 2 - stroke / 2 - 2;
  const c = S / 2;
  const n = parts.length;
  const gap = 0.045;
  const len = 1 / n - gap;
  const at = (f: number) => {
    const a = -Math.PI / 2 + f * Math.PI * 2;
    return [c + r * Math.cos(a), c + r * Math.sin(a)];
  };
  return (
    <div ref={ref} className="loop-ring">
      {S > 40 && (
        <svg width={S} height={S}>
          <defs>
            {parts.map((p, i) => {
              const s = i / n + gap / 2;
              const [x1, y1] = at(s);
              const [x2, y2] = at(s + len);
              return (
                <linearGradient key={i} id={`lr${id}${i}`} gradientUnits="userSpaceOnUse" x1={x1} y1={y1} x2={x2} y2={y2}>
                  <stop offset="0" stopColor={HUES[p.hue][0]} />
                  <stop offset="1" stopColor={HUES[p.hue][1]} />
                </linearGradient>
              );
            })}
          </defs>
          <g transform={`rotate(-90 ${c} ${c})`}>
            {parts.map((p, i) => {
              const s = i / n + gap / 2;
              const v = Math.max(0, Math.min(1, p.value));
              return (
                <g key={i}>
                  <circle cx={c} cy={c} r={r} pathLength={1} fill="none" stroke={HUES[p.hue][1]} strokeOpacity={0.13} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${len} 1`} strokeDashoffset={-s} />
                  {v > 0.001 && (
                    <circle
                      cx={c}
                      cy={c}
                      r={r}
                      pathLength={1}
                      fill="none"
                      stroke={`url(#lr${id}${i})`}
                      strokeWidth={stroke}
                      strokeLinecap="round"
                      className="ring-fill"
                      style={{ strokeDasharray: `${len * v} 1`, strokeDashoffset: -s, animationDelay: `${200 + i * 160}ms` }}
                    />
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

/* ---------- Bars: plump pills, today glowing softly ---------- */

export function Bars({
  values,
  labels,
  highlight = values.length - 1,
  hue = 'sand',
  format = (v: number) => String(v),
}: {
  values: number[];
  labels: string[];
  highlight?: number;
  hue?: Hue;
  format?: (v: number) => string;
}) {
  const max = Math.max(1, ...values);
  const [a, b] = HUES[hue];
  return (
    <div className="zbars" style={{ ['--ha' as string]: a, ['--hb' as string]: b }}>
      <div className="zbars-plot">
        {values.map((v, i) => (
          <div key={i} className="zbar-col" title={`${labels[i]}: ${format(v)}`}>
            <span className="zbar-track">
              <span className={i === highlight ? 'zbar on' : 'zbar'} style={{ height: v > 0 ? `max(0.9rem, ${(v / max) * 100}%)` : 0, animationDelay: `${120 + i * 60}ms` }} />
            </span>
          </div>
        ))}
      </div>
      <div className="zbars-labels">
        {labels.map((l, i) => (
          <span key={i} className={i === highlight ? 'on' : undefined}>
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- Spark: a soft curve with a gentle fill ---------- */

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
  const [a, b] = HUES[hue];
  return (
    <div ref={ref} className="spark">
      {w > 0 && h > 0 && (
        <svg width={w} height={h}>
          <defs>
            <linearGradient id={`sf${id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={a} stopOpacity="0.28" />
              <stop offset="1" stopColor={b} stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`ss${id}`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor={b} />
              <stop offset="1" stopColor={a} />
            </linearGradient>
          </defs>
          {compare && <path d={smooth(compare.map((v, i) => [x(i), y(v)] as [number, number]))} fill="none" stroke="var(--text-3)" strokeWidth={1.5} strokeLinecap="round" strokeDasharray="1 6" />}
          <path d={`${d} L${last[0]},${bottom} L${pts[0][0]},${bottom} Z`} fill={`url(#sf${id})`} className="soft-fill" />
          <path d={d} fill="none" stroke={`url(#ss${id})`} strokeWidth={3} strokeLinecap="round" pathLength={1} className="draw" />
          <circle cx={last[0]} cy={last[1]} r={11} fill={a} opacity={0.18} className="halo" />
          <circle cx={last[0]} cy={last[1]} r={5} fill={a} stroke="var(--surface)" strokeWidth={2} className="pop" />
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

/* ---------- Multi-series: the focused subject drawn full and soft ---------- */

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
  const [ha, hb] = HUES[hue];
  return (
    <div ref={ref} className="mline">
      {w > 0 && h > 0 && all.length > 0 && (
        <svg width={w} height={h}>
          <defs>
            <linearGradient id={`mf${id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={ha} stopOpacity="0.25" />
              <stop offset="1" stopColor={hb} stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`ms${id}`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor={hb} />
              <stop offset="1" stopColor={ha} />
            </linearGradient>
          </defs>
          {target != null && (
            <>
              <line x1={pad} x2={w - pad} y1={y(target)} y2={y(target)} stroke="var(--text-3)" strokeWidth={1.5} strokeLinecap="round" strokeDasharray="1 6" />
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
              <g key={s.id} opacity={on ? 1 : 0.16}>
                {on && pts.length > 1 && <path d={`${d} L${last[0]},${bottom} L${pts[0][0]},${bottom} Z`} fill={`url(#mf${id})`} className="soft-fill" />}
                <path d={d} fill="none" stroke={on ? `url(#ms${id})` : 'var(--text-2)'} strokeWidth={on ? 3 : 1.5} strokeLinecap="round" pathLength={1} className="draw" />
                {on && (
                  <>
                    <circle cx={last[0]} cy={last[1]} r={11} fill={ha} opacity={0.18} className="halo" />
                    <circle cx={last[0]} cy={last[1]} r={5} fill={ha} stroke="var(--surface)" strokeWidth={2} className="pop" />
                  </>
                )}
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

/* ---------- Arc: a thick, soft half circle with a target pebble ---------- */

export function Arc({ value, target, hue = 'sage' }: { value: number | null; target?: number; hue?: Hue }) {
  const id = useGid();
  const cx = 100;
  const cy = 100;
  const r = 84;
  const pt = (pct: number, rr = r) => {
    const a = Math.PI + (Math.min(100, Math.max(0, pct)) / 100) * Math.PI;
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
  };
  const arc = (pct: number) => {
    const [x, y] = pt(pct);
    return `M${cx - r},${cy} A${r},${r} 0 0 1 ${x},${y}`;
  };
  const [tx, ty] = pt(target ?? 0);
  const [a, b] = HUES[hue];
  return (
    <svg viewBox="-4 -4 208 116" className="arc" role="img" aria-label={`Average ${value == null ? 'none' : Math.round(value) + '%'}${target != null ? `, target ${target}%` : ''}`}>
      <defs>
        <linearGradient id={`ag${id}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={b} />
          <stop offset="1" stopColor={a} />
        </linearGradient>
      </defs>
      <path d={arc(100)} fill="none" stroke={b} strokeOpacity={0.14} strokeWidth={13} strokeLinecap="round" />
      {value != null && value > 0 && <path d={arc(value)} fill="none" stroke={`url(#ag${id})`} strokeWidth={13} strokeLinecap="round" pathLength={1} className="draw" />}
      {target != null && <circle cx={tx} cy={ty} r={5.5} fill="var(--surface)" stroke="var(--text)" strokeWidth={2} className="pop" />}
    </svg>
  );
}
