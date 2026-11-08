import { useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';
import { Sparkles, X } from 'lucide-react';
import type { ErrorType, Weakness } from '../db/types';
import { errorLabel } from '../db/types';

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ');

export type Tone = 'ember' | 'orchid' | 'lagoon' | 'coral' | 'meadow' | 'gold';

export const TONE_COLOUR: Record<Tone, string> = {
  ember: '#ff6a4d',
  orchid: '#b06bff',
  lagoon: '#3daeff',
  coral: '#ff6b7a',
  meadow: '#34e0a1',
  gold: '#ffc04d',
};

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/* ---------- Card ---------- */

export function Card({
  children,
  className,
  index = 0,
  style,
  hoverable,
  tilt,
  tint,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  index?: number;
  style?: CSSProperties;
  hoverable?: boolean;
  /** Leans toward the cursor in 3D. */
  tilt?: boolean;
  /** A colour that glows in from the corner. */
  tint?: Tone | string;
} & React.HTMLAttributes<HTMLElement>) {
  const tintColour = tint ? TONE_COLOUR[tint as Tone] ?? tint : undefined;
  return (
    <section
      className={cx('card', hoverable && 'hoverable', tilt && 'tilt', className)}
      style={{ ['--i' as string]: index, ...(tintColour ? { ['--tint' as string]: tintColour } : {}), ...style }}
      onMouseMove={(e) => {
        const el = e.currentTarget;
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left;
        const y = e.clientY - r.top;
        el.style.setProperty('--mx', `${x}px`);
        el.style.setProperty('--my', `${y}px`);
        if (tilt && !reduceMotion()) {
          el.style.setProperty('--ry', `${((x / r.width) - 0.5) * 4}deg`);
          el.style.setProperty('--rx', `${(0.5 - y / r.height) * 4}deg`);
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.setProperty('--rx', '0deg');
        e.currentTarget.style.setProperty('--ry', '0deg');
      }}
      {...rest}
    >
      {children}
    </section>
  );
}

export function CardHead({
  icon,
  title,
  aside,
  accent,
  tone,
}: {
  icon?: ReactNode;
  title: ReactNode;
  aside?: ReactNode;
  accent?: boolean;
  tone?: Tone | 'dark';
}) {
  const t = accent ? 'ember' : tone && tone !== 'dark' ? tone : undefined;
  return (
    <div className="card-head">
      {icon && <span className={cx('card-icon', t && `tone-${t}`)}>{icon}</span>}
      <h2>{title}</h2>
      {aside != null && <span className="aside">{aside}</span>}
    </div>
  );
}

export function IconTile({ tone, children, size }: { tone?: Tone; children: ReactNode; size?: string }) {
  return (
    <span className={cx('card-icon', tone && `tone-${tone}`)} style={size ? { width: size, height: size } : undefined}>
      {children}
    </span>
  );
}

/* ---------- Numbers ---------- */

/** Counts up with an expo ease, from wherever it was. */
export function CountUp({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [shown, setShown] = useState(reduceMotion() ? value : 0);
  const from = useRef(reduceMotion() ? value : 0);
  useEffect(() => {
    if (reduceMotion()) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 900);
      const eased = k === 1 ? 1 : 1 - Math.pow(2, -10 * k);
      const v = a + (value - a) * eased;
      setShown(v);
      from.current = v;
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{shown.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</>;
}

export function Stat({
  value,
  unit,
  label,
  size,
  accent,
  decimals,
}: {
  value: number | string | null;
  unit?: string;
  label?: ReactNode;
  size?: 'md';
  accent?: boolean;
  decimals?: number;
}) {
  return (
    <div className="stat">
      <div className={cx('stat-value', size, accent && 'accent')}>
        {value == null ? '–' : typeof value === 'number' ? <CountUp value={value} decimals={decimals} /> : value}
        {unit && value != null && <span className="stat-unit">{unit}</span>}
      </div>
      {label && <div className="stat-label">{label}</div>}
    </div>
  );
}

/* ---------- Buttons and chips ---------- */

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'white' | 'ghost' | 'danger';
  size?: 'sm' | 'lg';
  icon?: boolean;
};

export function Button({ variant, size, icon, className, type = 'button', ...rest }: BtnProps) {
  return <button type={type} className={cx('btn', variant, size, icon && 'icon', className)} {...rest} />;
}

export function Chip({
  active,
  dot,
  className,
  children,
  style,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; dot?: string }) {
  return (
    <button type="button" className={cx('chip', active && 'active', className)} aria-pressed={active} style={style} {...rest}>
      {dot && <span className="dot" style={{ background: dot, color: dot }} />}
      {children}
    </button>
  );
}

const weakText: Record<Weakness, string> = { high: 'High', medium: 'Medium', low: 'Low' };

export function WeaknessPill({ value, onClick }: { value: Weakness; onClick?: () => void }) {
  if (onClick)
    return (
      <button type="button" className={cx('pill', value)} onClick={onClick} title="Click to change weakness">
        {weakText[value]}
      </button>
    );
  return <span className={cx('pill', value)}>{weakText[value]}</span>;
}

export const nextWeakness = (w: Weakness): Weakness => (w === 'high' ? 'medium' : w === 'medium' ? 'low' : 'high');

export function ErrorPill({ value }: { value: ErrorType }) {
  return <span className="pill">{errorLabel(value)}</span>;
}

/** Segmented control. The white thumb slides to the chosen option. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const btn = ref.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
      if (btn) setThumb({ left: btn.offsetLeft, width: btn.offsetWidth });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [value, options.length]);
  return (
    <div className="segmented" role="group" aria-label={label} ref={ref}>
      {thumb && <span className="thumb" style={{ left: thumb.left, width: thumb.width }} />}
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Form ---------- */

export function Field({ label, error, children, className }: { label: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('field', className)}>
      <span className="field-label">{label}</span>
      {children}
      {error && <span className="error">{error}</span>}
    </label>
  );
}

/* ---------- States ---------- */

export function Empty({ text, action, icon }: { text: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="empty">
      <span className="e-art">{icon ?? <Sparkles size={20} strokeWidth={1.5} />}</span>
      <p>{text}</p>
      {action}
    </div>
  );
}

export function Skeleton({ height = 160, style }: { height?: number | string; style?: CSSProperties }) {
  return <div className="skeleton" style={{ height, ...style }} />;
}

export function PageSkeleton() {
  return (
    <div className="page">
      <Skeleton height="3.5rem" style={{ maxWidth: '20rem' }} />
      <div className="grid-3">
        <Skeleton height="10rem" />
        <Skeleton height="10rem" />
        <Skeleton height="10rem" />
      </div>
      <Skeleton height="20rem" />
    </div>
  );
}

/* ---------- Modal ---------- */

export function Modal({
  title,
  onClose,
  children,
  wide,
  className,
}: {
  title?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    // Respect React's autoFocus (it runs first); otherwise focus the first field.
    if (!ref.current?.contains(document.activeElement)) {
      ref.current?.querySelector<HTMLElement>('input, select, textarea, button:not(.close)')?.focus();
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={cx('modal', wide && 'wide', className)} role="dialog" aria-modal="true">
        {title && (
          <div className="modal-head">
            <h2>{title}</h2>
            <Button icon variant="ghost" className="close" aria-label="Close" onClick={onClose}>
              <X size={18} strokeWidth={1.6} />
            </Button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function Progress({ value, target, color }: { value: number; target?: number; color?: string }) {
  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
      {target != null && <i className="target" style={{ left: `calc(${Math.min(100, target)}% - 1px)` }} />}
    </div>
  );
}

export { cx };
