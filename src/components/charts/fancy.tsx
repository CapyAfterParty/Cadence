// Cadence charts: thin lines, hairline tracks, one accent for "now".
// SVGs are drawn at their measured pixel size so strokes stay exact.
import { useLayoutEffect, useRef, useState } from 'react';
import './fancy.css';

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

/* ---------- Loop ring: four quiet arcs, one per beat of the week ---------- */

export function LoopRing({ parts, children }: { parts: { value: number; label: string }[]; children?: React.ReactNode }) {
  const [ref, w] = useSize<HTMLDivElement>();
  const S = w;
  const stroke = Math.max(2, S * 0.022);
  const r = S / 2 - stroke * 2;
  const c = S / 2;
  const n = parts.length;
  const gap = 0.03;
  const len = 1 / n - gap;
  return (
    <div ref={ref} className="loop-ring">
      {S > 40 && (
        <svg width={S} height={S}>
          <g transform={`rotate(-90 ${c} ${c})`}>
            {parts.map((p, i) => {
              const s = i / n + gap / 2;
              const v = Math.max(0, Math.min(1, p.value));
              return (
                <g key={i}>
                  <circle cx={c} cy={c} r={r} pathLength={1} fill="none" stroke="var(--line-strong)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${len} 1`} strokeDashoffset={-s} />
                  {v > 0.001 && (
                    <circle
                      cx={c}
                      cy={c}
                      r={r}
                      pathLength={1}
                      fill="none"
                      stroke={v >= 1 ? 'var(--text)' : 'var(--accent)'}
                      strokeWidth={stroke}
                      strokeLinecap="round"
                      className="ring-fill"
                      style={{ strokeDasharray: `${len * v} 1`, strokeDashoffset: -s, animationDelay: `${200 + i * 140}ms` }}
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

/* ---------- Bars: thin columns, today in the accent ---------- */

export function Bars({ values, labels, highlight = values.length - 1, format = (v: number) => String(v) }: { values: number[]; labels: string[]; highlight?: number; format?: (v: number) => string }) {
  const max = Math.max(1, ...values);
  return (
    <div className="zbars">
      <div className="zbars-plot">
        {values.map((v, i) => (
          <div key={i} className="zbar-col" title={`${labels[i]}: ${format(v)}`}>
            <span className={i === highlight ? 'zbar on' : 'zbar'} style={{ height: v > 0 ? `max(3px, ${(v / max) * 100}%)` : '2px', animationDelay: `${100 + i * 50}ms` }} />
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

/* ---------- Spark: one thin line, the last point marked ---------- */

export function Spark({ values, compare, labels }: { values: number[]; compare?: number[]; labels: string[] }) {
  const [ref, w, h] = useSize<HTMLDivElement>();
  const n = values.length;
  const hi = Math.max(1, ...values, ...(compare ?? [])) * 1.1;
  const pad = 6;
  const top = 8;
  const bottom = h - 22;
  const x = (i: number) => pad + (n === 1 ? (w - pad * 2) / 2 : (i / (n - 1)) * (w - pad * 2));
  const y = (v: number) => top + (1 - v / hi) * (bottom - top);
  const pts = values.map((v, i) => [x(i), y(v)] as [number, number]);
  const last = pts[pts.length - 1];
  return (
    <div ref={ref} className="spark">
      {w > 0 && h > 0 && (
        <svg width={w} height={h}>
          <line x1={pad} x2={w - pad} y1={bottom} y2={bottom} stroke="var(--line)" />
          {compare && <path d={smooth(compare.map((v, i) => [x(i), y(v)] as [number, number]))} fill="none" stroke="var(--text-3)" strokeWidth={1} strokeDasharray="2 4" />}
          <path d={smooth(pts)} fill="none" stroke="var(--text-2)" strokeWidth={1.5} strokeLinecap="round" pathLength={1} className="draw" />
          <circle cx={last[0]} cy={last[1]} r={3.5} fill="var(--accent)" className="pop" />
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

/* ---------- Multi-series lines: the focused subject in full, others whispered ---------- */

export function MultiLine({
  series,
  labels,
  target,
  focus,
}: {
  series: { id: string; colour: string; values: (number | null)[] }[];
  labels: string[];
  target?: number;
  focus?: string;
}) {
  const [ref, w, h] = useSize<HTMLDivElement>();
  const n = labels.length;
  const pad = 6;
  const top = 14;
  const bottom = h - 22;
  const all = series.flatMap((s) => s.values.filter((v): v is number => v != null));
  // Scale to the focused series, so its shape is legible.
  const ranged = (focus ? series.filter((s) => s.id === focus) : series).flatMap((s) => s.values.filter((v): v is number => v != null));
  const base = ranged.length ? ranged : all;
  const lo = Math.max(0, Math.min(...base, target ?? 100) - 8);
  const hi = Math.min(100, Math.max(...base, target ?? 0) + 6);
  const x = (i: number) => pad + (n === 1 ? (w - pad * 2) / 2 : (i / (n - 1)) * (w - pad * 2));
  const y = (v: number) => top + (1 - (v - lo) / (hi - lo || 1)) * (bottom - top);
  const ordered = [...series].sort((a, b) => (a.id === focus ? 1 : b.id === focus ? -1 : 0));
  return (
    <div ref={ref} className="mline">
      {w > 0 && h > 0 && all.length > 0 && (
        <svg width={w} height={h}>
          {target != null && (
            <>
              <line x1={pad} x2={w - pad} y1={y(target)} y2={y(target)} stroke="var(--text-3)" strokeDasharray="2 5" />
              <text x={w - pad} y={y(target) - 6} textAnchor="end" className="axis-text">
                target {target}%
              </text>
            </>
          )}
          {ordered.map((s) => {
            const pts = s.values.map((v, i) => (v == null ? null : ([x(i), y(v)] as [number, number]))).filter(Boolean) as [number, number][];
            if (!pts.length) return null;
            const on = !focus || s.id === focus;
            const last = pts[pts.length - 1];
            return (
              <g key={s.id} opacity={on ? 1 : 0.18}>
                <path d={smooth(pts)} fill="none" stroke={on ? 'var(--text)' : 'var(--text-2)'} strokeWidth={on ? 1.5 : 1} strokeLinecap="round" pathLength={1} className="draw" />
                {on && <circle cx={last[0]} cy={last[1]} r={3.5} fill="var(--accent)" className="pop" />}
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

/* ---------- Arc: a half circle, average against target ---------- */

export function Arc({ value, target }: { value: number | null; target?: number }) {
  const cx = 100;
  const cy = 100;
  const r = 86;
  const pt = (pct: number, rr = r) => {
    const a = Math.PI + (Math.min(100, Math.max(0, pct)) / 100) * Math.PI;
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
  };
  const arc = (pct: number) => {
    const [x, y] = pt(pct);
    return `M${cx - r},${cy} A${r},${r} 0 0 1 ${x},${y}`;
  };
  const [t1x, t1y] = pt(target ?? 0, r - 9);
  const [t2x, t2y] = pt(target ?? 0, r + 9);
  return (
    <svg viewBox="0 0 200 108" className="arc" role="img" aria-label={`Average ${value == null ? 'none' : Math.round(value) + '%'}${target != null ? `, target ${target}%` : ''}`}>
      <path d={arc(100)} fill="none" stroke="var(--line-strong)" strokeWidth={2} strokeLinecap="round" />
      {value != null && value > 0 && <path d={arc(value)} fill="none" stroke="var(--text)" strokeWidth={2} strokeLinecap="round" pathLength={1} className="draw" />}
      {target != null && <line x1={t1x} y1={t1y} x2={t2x} y2={t2y} stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" />}
    </svg>
  );
}
