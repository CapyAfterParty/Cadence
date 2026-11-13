import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { cx } from './ui';

export type GlassTone = 'pink' | 'blue' | 'violet' | 'orange' | 'green' | 'smoke' | 'course' | 'plain';

const TONE_CLASS: Record<GlassTone, string> = {
  pink: 'gel gel-pink',
  blue: 'gel gel-blue',
  violet: 'gel gel-c gel-violet',
  orange: 'gel gel-c gel-orange',
  green: 'gel gel-c gel-green',
  smoke: 'smoke',
  course: 'gel gel-c',
  plain: '',
};

/** Light course colours (lime, amber) get deepened so white text stays readable on the gel. */
export function gelColour(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.55 ? `color-mix(in oklab, ${hex} 62%, #14002e)` : hex;
}

/** A glass card. Gel tones glow in their colour; a soft light follows the cursor. */
export function Glass({
  tone,
  colour,
  index = 0,
  className,
  style,
  wide,
  children,
}: {
  tone: GlassTone;
  /** For tone "course": the course colour. */
  colour?: string;
  index?: number;
  className?: string;
  style?: CSSProperties;
  /** Landscape card: light along the edges instead of top and bottom. */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={cx('hc', TONE_CLASS[tone], wide && tone !== 'smoke' && 'gel-c wide-gel', className)}
      style={{
        ['--i' as string]: index,
        ...(colour ? { ['--c' as string]: gelColour(colour) } : {}),
        ...(wide && tone === 'pink' ? { ['--c' as string]: '#f0228a' } : {}),
        ...(wide && tone === 'blue' ? { ['--c' as string]: '#2f6cff' } : {}),
        ...style,
      }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
        e.currentTarget.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
      }}
    >
      {children}
    </section>
  );
}

export function GlassHead({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="hc-head">
      <span className="hc-title">{title}</span>
      {children}
    </div>
  );
}

export function CornerLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="hc-corner" aria-label={label} title={label}>
      <ArrowUpRight size={16} strokeWidth={2} />
    </Link>
  );
}

/** Dot-matrix numerals. Units render small and dimmed. */
export function DotNum({ children, big, className }: { children: ReactNode; big?: boolean; className?: string }) {
  return <div className={cx('dot-num', big && 'big', className)}>{children}</div>;
}

/** A row of dots: filled for done, ring for not, a halo on the current one. */
export function DotStrip({ values, current, title }: { values: boolean[]; current?: number; title?: (i: number) => string }) {
  return (
    <div className="dot-strip">
      {values.map((v, i) => (
        <span key={i} className={cx('mx', v && 'on', i === current && 'now')} style={{ ['--d' as string]: i }} title={title?.(i)} />
      ))}
    </div>
  );
}

/** Dark glass panel for the working parts of a screen. */
export function Panel({ title, aside, index = 0, className, children, style, id }: { title?: ReactNode; aside?: ReactNode; index?: number; className?: string; children: ReactNode; style?: CSSProperties; id?: string }) {
  return (
    <section id={id} className={cx('panel', className)} style={{ ['--i' as string]: index, ...style }}>
      {(title || aside) && (
        <div className="panel-head">
          {title && <h2>{title}</h2>}
          {aside != null && <span className="aside">{aside}</span>}
        </div>
      )}
      {children}
    </section>
  );
}
