// Hand-built, minimal charts. No gridlines, rounded bars, smooth lines.
// The current value takes the accent colour.
import { useId } from 'react';
import './charts.css';

export function Bars({
  values,
  labels,
  height = 72,
  highlight = values.length - 1,
  format = (v: number) => String(v),
}: {
  values: number[];
  labels?: string[];
  height?: number;
  highlight?: number;
  format?: (v: number) => string;
}) {
  const max = Math.max(1, ...values);
  return (
    <div className="bars">
      <div className="bars-plot" style={{ height }}>
        {values.map((v, i) => (
          <div key={i} className="bar-col" title={`${labels?.[i] ?? ''} ${format(v)}`.trim()}>
            <span
              className={i === highlight ? 'bar on' : 'bar'}
              style={{ height: v > 0 ? `max(6px, ${(v / max) * 100}%)` : 4 }}
            />
          </div>
        ))}
      </div>
      {labels && (
        <div className="bars-labels">
          {labels.map((l, i) => (
            <span key={i} className={i === highlight ? 'on' : undefined}>
              {l}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Catmull-Rom spline through the points, as cubic beziers. */
function smoothPath(pts: [number, number][]) {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

export function Line({
  values,
  height = 64,
  min,
  max,
  labels,
  target,
  colour = 'var(--accent)',
}: {
  values: (number | null)[];
  height?: number;
  min?: number;
  max?: number;
  labels?: string[];
  /** Draws a faint horizontal line, e.g. a target score. */
  target?: number;
  colour?: string;
}) {
  const gid = useId().replace(/:/g, '');
  const real = values.map((v, i) => [i, v] as const).filter(([, v]) => v != null) as [number, number][];
  if (real.length === 0) return <div className="line-empty" style={{ height }} />;
  const lo = min ?? Math.min(...real.map(([, v]) => v), target ?? Infinity);
  const hi = max ?? Math.max(...real.map(([, v]) => v), target ?? -Infinity);
  const span = hi - lo || 1;
  const W = 100;
  const H = 40;
  const pad = 4;
  const x = (i: number) => (values.length === 1 ? W / 2 : (i / (values.length - 1)) * W);
  const y = (v: number) => pad + (1 - (v - lo) / span) * (H - pad * 2);
  const pts = real.map(([i, v]) => [x(i), y(v)] as [number, number]);
  const d = smoothPath(pts);
  const last = pts[pts.length - 1];
  return (
    <div className="line">
      <div className="line-plot" style={{ height }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={colour} stopOpacity="0.28" />
              <stop offset="1" stopColor={colour} stopOpacity="0" />
            </linearGradient>
          </defs>
          {target != null && (
            <line x1="0" x2={W} y1={y(target)} y2={y(target)} className="line-target" vectorEffect="non-scaling-stroke" />
          )}
          {pts.length > 1 && <path d={`${d} L${last[0]},${H} L${pts[0][0]},${H} Z`} fill={`url(#${gid})`} />}
          {pts.length > 1 && (
            <path d={d} fill="none" stroke={colour} strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        <span className="line-dot" style={{ left: `${last[0]}%`, top: `${(last[1] / H) * 100}%`, background: colour }} />
      </div>
      {labels && (
        <div className="line-labels">
          {labels.map((l, i) => (
            <span key={i} className={i === labels.length - 1 ? 'on' : undefined} style={{ left: `${x(i)}%` }}>
              {l}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Tick gauge: average against target, both in percent. */
export function Gauge({ value, target, ticks = 48 }: { value: number | null; target?: number; ticks?: number }) {
  const startDeg = -210;
  const sweep = 240;
  const cx = 100;
  const cy = 100;
  const items = Array.from({ length: ticks + 1 }, (_, i) => {
    const t = i / ticks;
    const a = ((startDeg + t * sweep) * Math.PI) / 180;
    const isTarget = target != null && Math.abs(t * 100 - target) < 100 / ticks / 2 + 0.001;
    const r1 = isTarget ? 66 : 72;
    const r2 = 88;
    const on = value != null && t * 100 <= value;
    return { x1: cx + r1 * Math.cos(a), y1: cy + r1 * Math.sin(a), x2: cx + r2 * Math.cos(a), y2: cy + r2 * Math.sin(a), on, isTarget };
  });
  return (
    <svg viewBox="0 0 200 168" className="gauge" role="img" aria-label={`Average ${value == null ? 'none' : Math.round(value) + '%'}, target ${target ?? '–'}%`}>
      {items.map((t, i) => (
        <line
          key={i}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          strokeLinecap="round"
          strokeWidth={t.isTarget ? 3 : 2.2}
          stroke={t.isTarget ? '#fff' : t.on ? 'var(--accent)' : 'rgba(255,255,255,0.16)'}
        />
      ))}
    </svg>
  );
}

/** Calendar heatmap: one column per week, one coloured box per day. */
export function Heatmap({
  days,
  value,
  title,
}: {
  days: string[]; // oldest first, starting on a Monday
  value: (day: string) => number; // minutes
  title: (day: string) => string;
}) {
  const level = (m: number) => (m <= 0 ? 0 : m < 30 ? 1 : m < 90 ? 2 : m < 180 ? 3 : 4);
  const weeks: string[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return (
    <div className="heatmap" role="img" aria-label="Study hours per day">
      {weeks.map((w, i) => (
        <div key={i} className="heat-col">
          {w.map((d) => (
            <span key={d} className={`heat l${level(value(d))}`} title={title(d)} />
          ))}
        </div>
      ))}
    </div>
  );
}
