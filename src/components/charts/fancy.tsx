// Cadence charts. Every SVG is drawn at its real pixel size (measured), so
// strokes, glows and draw-in animations stay crisp at any screen size.
import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
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

const css = (o: Record<string, string | number>) => o as CSSProperties;
const uid = () => Math.random().toString(36).slice(2, 8);

function Glow({ id, std = 3 }: { id: string; std?: number }) {
  return (
    <filter id={id} x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation={std} result="b" />
      <feMerge>
        <feMergeNode in="b" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  );
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

/* ---------- Loop ring: four coloured beats around one circle ---------- */

export interface RingPart {
  value: number; // 0..1
  from: string;
  to: string;
  label: string;
}

export function LoopRing({ parts, children }: { parts: RingPart[]; children?: React.ReactNode }) {
  const [ref, w] = useSize<HTMLDivElement>();
  const id = useId().replace(/:/g, '');
  const S = w;
  const stroke = S * 0.085;
  const r = S / 2 - stroke / 2 - S * 0.04;
  const c = S / 2;
  const n = parts.length;
  const gap = 0.035;
  const len = 1 / n - gap;
  const at = (f: number) => {
    const a = -Math.PI / 2 + f * Math.PI * 2;
    return [c + r * Math.cos(a), c + r * Math.sin(a)] as const;
  };
  return (
    <div ref={ref} className="loop-ring">
      {S > 0 && (
        <svg width={S} height={S}>
          <defs>
            <Glow id={`lg${id}`} std={S * 0.018} />
            {parts.map((p, i) => {
              const s = i / n + gap / 2;
              const [x1, y1] = at(s);
              const [x2, y2] = at(s + len);
              return (
                <linearGradient key={i} id={`seg${id}${i}`} gradientUnits="userSpaceOnUse" x1={x1} y1={y1} x2={x2} y2={y2}>
                  <stop offset="0" stopColor={p.from} />
                  <stop offset="1" stopColor={p.to} />
                </linearGradient>
              );
            })}
          </defs>
          {/* Dotted inner dial for texture */}
          {Array.from({ length: 72 }, (_, i) => {
            const a = (i / 72) * Math.PI * 2;
            const rr = r - stroke * 1.15;
            return <circle key={i} cx={c + rr * Math.cos(a)} cy={c + rr * Math.sin(a)} r={i % 6 === 0 ? S * 0.0055 : S * 0.003} fill="rgba(255,255,255,0.22)" />;
          })}
          <g transform={`rotate(-90 ${c} ${c})`}>
            {parts.map((_, i) => {
              const s = i / n + gap / 2;
              return (
                <circle
                  key={`t${i}`}
                  cx={c}
                  cy={c}
                  r={r}
                  pathLength={1}
                  fill="none"
                  stroke="rgba(255,255,255,0.07)"
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  strokeDasharray={`${len} 1`}
                  strokeDashoffset={-s}
                />
              );
            })}
            {parts.map((p, i) => {
              const s = i / n + gap / 2;
              const v = Math.max(0, Math.min(1, p.value));
              if (v <= 0.001) return null;
              return (
                <g key={`f${i}`} filter={`url(#lg${id})`}>
                  <circle
                    cx={c}
                    cy={c}
                    r={r}
                    pathLength={1}
                    fill="none"
                    stroke={`url(#seg${id}${i})`}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    className="ring-fill"
                    style={css({ strokeDasharray: `${len * v} 1`, strokeDashoffset: -s, animationDelay: `${250 + i * 160}ms` })}
                  />
                </g>
              );
            })}
          </g>
          {parts.map((p, i) => {
            const v = Math.max(0, Math.min(1, p.value));
            if (v <= 0.001) return null;
            const [x, y] = at(i / n + gap / 2 + len * v);
            return <circle key={`d${i}`} cx={x} cy={y} r={stroke * 0.2} fill="#fff" className="ring-cap" style={{ animationDelay: `${900 + i * 160}ms` }} />;
          })}
        </svg>
      )}
      <div className="loop-ring-center">{children}</div>
    </div>
  );
}

/* ---------- Concentric activity rings ---------- */

export function Rings({ rings }: { rings: { value: number; from: string; to: string; label: string }[] }) {
  const [ref, w] = useSize<HTMLDivElement>();
  const id = useId().replace(/:/g, '');
  const S = w;
  const stroke = S * 0.105;
  const step = stroke * 1.22;
  const c = S / 2;
  return (
    <div ref={ref} className="rings">
      {S > 40 && (
        <svg width={S} height={S}>
          <defs>
            <Glow id={`rg${id}`} std={S * 0.014} />
            {rings.map((g, i) => (
              <linearGradient key={i} id={`rgr${id}${i}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor={g.from} />
                <stop offset="1" stopColor={g.to} />
              </linearGradient>
            ))}
          </defs>
          <g transform={`rotate(-90 ${c} ${c})`}>
            {rings.map((g, i) => {
              const r = c - stroke / 2 - i * step - 2;
              const v = Math.max(0, Math.min(1, g.value));
              if (r <= 0) return null;
              return (
                <g key={i}>
                  <circle cx={c} cy={c} r={r} fill="none" stroke={g.to} strokeOpacity={0.14} strokeWidth={stroke} />
                  {v > 0.001 && (
                    <circle
                      cx={c}
                      cy={c}
                      r={r}
                      pathLength={1}
                      fill="none"
                      stroke={`url(#rgr${id}${i})`}
                      strokeWidth={stroke}
                      strokeLinecap="round"
                      filter={`url(#rg${id})`}
                      className="ring-fill"
                      style={css({ strokeDasharray: `${v >= 1 ? 1 : v} 1`, animationDelay: `${200 + i * 180}ms` })}
                    />
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      )}
    </div>
  );
}

/* ---------- Stacked glossy bars with a floor reflection ---------- */

export function StackBars({
  labels,
  series,
  highlight = labels.length - 1,
  format = (v: number) => String(v),
}: {
  labels: string[];
  series: { name: string; colour: string; values: number[] }[];
  highlight?: number;
  format?: (v: number) => string;
}) {
  const totals = labels.map((_, i) => series.reduce((a, s) => a + (s.values[i] ?? 0), 0));
  const max = Math.max(1, ...totals);
  return (
    <div className="sbars">
      <div className="sbars-plot">
        {labels.map((l, i) => (
          <div key={i} className={i === highlight ? 'sbar-col on' : 'sbar-col'} title={`${l}: ${format(totals[i])}`}>
            {i === highlight && totals[i] > 0 && <span className="sbar-value num">{format(totals[i])}</span>}
            <div className="sbar" style={{ height: totals[i] > 0 ? `max(0.5rem, ${(totals[i] / max) * 100}%)` : '0.3rem', animationDelay: `${120 + i * 60}ms` }}>
              {totals[i] > 0 ? (
                series.map((s) =>
                  (s.values[i] ?? 0) > 0 ? (
                    <span
                      key={s.name}
                      className="sbar-seg"
                      style={{ flexGrow: s.values[i], background: `linear-gradient(180deg, color-mix(in srgb, ${s.colour} 70%, white), ${s.colour} 55%, color-mix(in srgb, ${s.colour} 80%, black))` }}
                    />
                  ) : null,
                )
              ) : (
                <span className="sbar-seg empty" />
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="sbars-labels">
        {labels.map((l, i) => (
          <span key={i} className={i === highlight ? 'on' : undefined}>
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- Smooth glowing area ---------- */

export function SmoothArea({
  values,
  compare,
  labels,
  from = '#c58bff',
  to = '#ff6bd5',
}: {
  values: number[];
  compare?: number[];
  labels: string[];
  from?: string;
  to?: string;
}) {
  const [ref, w, h] = useSize<HTMLDivElement>();
  const id = useId().replace(/:/g, '');
  const n = values.length;
  const hi = Math.max(1, ...values, ...(compare ?? [])) * 1.15;
  const padX = w * 0.04;
  const top = 10;
  const bottom = h - 22;
  const x = (i: number) => padX + (n === 1 ? (w - padX * 2) / 2 : (i / (n - 1)) * (w - padX * 2));
  const y = (v: number) => top + (1 - v / hi) * (bottom - top);
  const pts = values.map((v, i) => [x(i), y(v)] as [number, number]);
  const d = smooth(pts);
  const cmp = compare ? smooth(compare.map((v, i) => [x(i), y(v)] as [number, number])) : '';
  const last = pts[pts.length - 1];
  return (
    <div ref={ref} className="sarea">
      {w > 0 && h > 0 && (
        <svg width={w} height={h}>
          <defs>
            <Glow id={`ag${id}`} std={4} />
            <linearGradient id={`af${id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={from} stopOpacity="0.45" />
              <stop offset="1" stopColor={to} stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`as${id}`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor={from} />
              <stop offset="1" stopColor={to} />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={padX} x2={w - padX} y1={top + f * (bottom - top)} y2={top + f * (bottom - top)} className="grid-line" />
          ))}
          {cmp && <path d={cmp} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.4} strokeDasharray="3 5" />}
          <path d={`${d} L${last[0]},${bottom} L${pts[0][0]},${bottom} Z`} fill={`url(#af${id})`} className="area-fade" />
          <path d={d} fill="none" stroke={`url(#as${id})`} strokeWidth={3} strokeLinecap="round" filter={`url(#ag${id})`} pathLength={1} className="draw" />
          {pts.slice(0, -1).map(([px, py], i) => (
            <circle key={i} cx={px} cy={py} r={2.5} fill="#fff" opacity={0.55} className="pop" style={{ animationDelay: `${700 + i * 50}ms` }} />
          ))}
          <circle cx={last[0]} cy={last[1]} r={10} fill={to} opacity={0.25} className="pulse-ring" />
          <circle cx={last[0]} cy={last[1]} r={5} fill="#fff" stroke={to} strokeWidth={2.5} className="pop" style={{ animationDelay: '1000ms' }} />
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

/* ---------- Multi-series smooth lines ---------- */

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
  const id = useId().replace(/:/g, '');
  const n = labels.length;
  const padX = 8;
  const top = 12;
  const bottom = h - 22;
  const all = series.flatMap((s) => s.values.filter((v): v is number => v != null));
  const lo = Math.max(0, Math.min(...all, target ?? 100) - 10);
  const hi = Math.min(100, Math.max(...all, target ?? 0) + 8);
  const x = (i: number) => padX + (n === 1 ? (w - padX * 2) / 2 : (i / (n - 1)) * (w - padX * 2));
  const y = (v: number) => top + (1 - (v - lo) / (hi - lo || 1)) * (bottom - top);
  const ordered = [...series].sort((a, b) => (a.id === focus ? 1 : b.id === focus ? -1 : 0));
  return (
    <div ref={ref} className="mline">
      {w > 0 && h > 0 && all.length > 0 && (
        <svg width={w} height={h}>
          <defs>
            <Glow id={`mg${id}`} std={3.5} />
          </defs>
          {target != null && (
            <>
              <line x1={padX} x2={w - padX} y1={y(target)} y2={y(target)} className="target-line" />
              <text x={w - padX} y={y(target) - 6} textAnchor="end" className="axis-text on">
                Target {target}%
              </text>
            </>
          )}
          {ordered.map((s, si) => {
            const pts = s.values.map((v, i) => (v == null ? null : ([x(i), y(v)] as [number, number]))).filter(Boolean) as [number, number][];
            if (!pts.length) return null;
            const on = !focus || s.id === focus;
            const last = pts[pts.length - 1];
            return (
              <g key={s.id} opacity={on ? 1 : 0.28} filter={on ? `url(#mg${id})` : undefined}>
                <path d={smooth(pts)} fill="none" stroke={s.colour} strokeWidth={on ? 3 : 1.8} strokeLinecap="round" pathLength={1} className="draw" style={{ animationDelay: `${si * 120}ms` }} />
                <circle cx={last[0]} cy={last[1]} r={on ? 5 : 3} fill="#fff" stroke={s.colour} strokeWidth={2.5} className="pop" />
              </g>
            );
          })}
          {labels.map((l, i) =>
            n <= 6 || (i % 2 === (n - 1) % 2) ? (
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

/* ---------- Spectrum arc gauge ---------- */

const SPECTRUM = ['#ffb06b', '#ff6a4d', '#ff4f8b', '#c06bff', '#6b8bff', '#3dd9ff'];

function spectrumAt(t: number) {
  const f = Math.max(0, Math.min(0.9999, t)) * (SPECTRUM.length - 1);
  const i = Math.floor(f);
  const k = f - i;
  const a = SPECTRUM[i];
  const b = SPECTRUM[i + 1];
  const mix = (p: number) => Math.round(parseInt(a.slice(p, p + 2), 16) * (1 - k) + parseInt(b.slice(p, p + 2), 16) * k);
  return `rgb(${mix(1)},${mix(3)},${mix(5)})`;
}

export function ArcGauge({ value, target, ticks = 52, label = 'Target' }: { value: number | null; target?: number; ticks?: number; label?: string }) {
  const cx = 130;
  const cy = 130;
  const r1 = 94;
  const r2 = 118;
  const valueTick = value == null ? -1 : Math.round((Math.min(100, value) / 100) * ticks);
  const items = Array.from({ length: ticks + 1 }, (_, i) => {
    const a = Math.PI + (i / ticks) * Math.PI;
    const isV = i === valueTick;
    const inner = isV ? r1 - 10 : i % 13 === 0 ? r1 - 4 : r1;
    return { x1: cx + inner * Math.cos(a), y1: cy + inner * Math.sin(a), x2: cx + (isV ? r2 + 4 : r2) * Math.cos(a), y2: cy + (isV ? r2 + 4 : r2) * Math.sin(a), on: i <= valueTick, isV, colour: spectrumAt(i / ticks) };
  });
  const ta = target != null ? Math.PI + (Math.min(100, target) / 100) * Math.PI : 0;
  const tip = (r: number) => [cx + r * Math.cos(ta), cy + r * Math.sin(ta)];
  const [mx, my] = tip(r2 + 8);
  const perp = ta + Math.PI / 2;
  const [bx, by] = tip(r2 + 19);
  return (
    <svg viewBox="-6 -6 272 146" className="arc-gauge" role="img" aria-label={`Average ${value == null ? 'none' : Math.round(value) + '%'}${target != null ? `, target ${target}%` : ''}`}>
      {items.map((t, i) => (
        <line
          key={i}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          strokeLinecap="round"
          strokeWidth={t.isV ? 5 : 3.2}
          stroke={t.isV ? '#fff' : t.on ? t.colour : 'rgba(255,255,255,0.16)'}
          className="tick"
          style={{ animationDelay: `${200 + i * 12}ms`, filter: t.isV ? 'drop-shadow(0 0 6px rgba(255,255,255,0.9))' : t.on ? `drop-shadow(0 0 3px ${t.colour})` : undefined }}
        />
      ))}
      {target != null && (
        <>
          <polygon points={`${mx},${my} ${bx + 6 * Math.cos(perp)},${by + 6 * Math.sin(perp)} ${bx - 6 * Math.cos(perp)},${by - 6 * Math.sin(perp)}`} fill="#fff" />
          <text x={tip(r2 + 31)[0]} y={tip(r2 + 31)[1] + 3} textAnchor="middle" className="gauge-label">
            {label}
          </text>
        </>
      )}
    </svg>
  );
}

/* ---------- Dusk scene, drawn (no photos) ---------- */

export function Scene() {
  const [id] = useState(uid);
  const stars = useRef(Array.from({ length: 34 }, (_, i) => ({ x: (i * 97) % 400, y: ((i * 53) % 260) + 8, r: 0.6 + ((i * 7) % 5) * 0.25, d: (i % 7) * 0.6 }))).current;
  return (
    <div className="scene" aria-hidden="true">
      <svg viewBox="0 0 400 640" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={`sky${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#0a0a1c" />
            <stop offset="0.3" stopColor="#1d1640" />
            <stop offset="0.5" stopColor="#4a2272" />
            <stop offset="0.63" stopColor="#a8336f" />
            <stop offset="0.71" stopColor="#ff6a5a" />
            <stop offset="0.75" stopColor="#ffb07a" />
          </linearGradient>
          <radialGradient id={`sun${id}`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#fff4e0" />
            <stop offset="0.1" stopColor="#ffd2a0" />
            <stop offset="0.4" stopColor="#ff7a6b" stopOpacity="0.45" />
            <stop offset="1" stopColor="#ff4f8b" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="400" height="640" fill={`url(#sky${id})`} />
        {stars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" className="star" style={{ animationDelay: `${s.d}s` }} />
        ))}
        <g className="scene-clouds">
          <ellipse cx="110" cy="330" rx="170" ry="9" fill="#ff9ab0" opacity="0.28" />
          <ellipse cx="300" cy="372" rx="150" ry="7" fill="#ffb38a" opacity="0.35" />
          <ellipse cx="200" cy="410" rx="190" ry="10" fill="#ffc9a0" opacity="0.3" />
        </g>
        <circle cx="205" cy="470" r="200" fill={`url(#sun${id})`} className="scene-sun" />
        <path d="M0 470 C 50 440 90 452 130 436 S 210 420 250 440 S 340 430 400 446 V640 H0Z" fill="#5b2a6e" opacity="0.9" />
        <path d="M0 500 C 60 470 110 486 160 470 S 260 462 300 484 S 370 470 400 478 V640 H0Z" fill="#2c1846" />
        <path d="M0 540 C 80 516 140 530 200 520 S 330 510 400 528 V640 H0Z" fill="#160d28" />
        <path d="M0 580 C 100 566 200 576 260 568 S 360 560 400 570 V640 H0Z" fill="#08060f" />
      </svg>
    </div>
  );
}
