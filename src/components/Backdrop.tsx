import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useScans } from './Scans';
import './backdrop.css';

/**
 * The lit, atmospheric layer the glass cards float over.
 * Drawn ribbons of warm light (no stock photos), or the user's own photo on Home.
 */
export function Backdrop() {
  const { pathname } = useLocation();
  const home = pathname === '/';
  const photos = useScans('hero', 'hero');
  const photo = home ? photos?.[0] : undefined;
  const url = useMemo(() => (photo ? URL.createObjectURL(photo.blob) : null), [photo]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);

  return (
    <div className={home ? 'backdrop home' : 'backdrop'} aria-hidden="true">
      {url ? (
        <img className="bd-photo" src={url} alt="" />
      ) : (
        <>
          <div className="bd-spot" />
          <div className="bd-beam b1" />
          <div className="bd-beam b2" />
          <svg className="bd-layer glow" viewBox="0 0 1440 820" preserveAspectRatio="xMidYMid slice">
            <defs>
              <linearGradient id="rg1" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="#ff3d1a" stopOpacity="0" />
                <stop offset="0.25" stopColor="#ff5a1f" />
                <stop offset="0.55" stopColor="#ff9a4a" />
                <stop offset="0.8" stopColor="#ff4f6d" />
                <stop offset="1" stopColor="#ff4f6d" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M-200,560 C 200,320 520,720 900,440 S 1500,260 1700,380" stroke="url(#rg1)" strokeWidth="190" fill="none" strokeLinecap="round" />
          </svg>
          <svg className="bd-layer mid" viewBox="0 0 1440 820" preserveAspectRatio="xMidYMid slice">
            <defs>
              <linearGradient id="rg2" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="#b8300f" stopOpacity="0" />
                <stop offset="0.3" stopColor="#ff6a2b" />
                <stop offset="0.6" stopColor="#ffc38a" />
                <stop offset="1" stopColor="#ff6a2b" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M-200,620 C 260,440 600,760 980,500 S 1460,390 1700,470" stroke="url(#rg2)" strokeWidth="64" fill="none" strokeLinecap="round" />
            <path d="M-200,470 C 240,300 620,600 1000,380 S 1480,300 1700,250" stroke="url(#rg2)" strokeWidth="26" fill="none" strokeLinecap="round" opacity="0.7" />
          </svg>
          <svg className="bd-layer silk" viewBox="0 0 1440 820" preserveAspectRatio="xMidYMid slice">
            <defs>
              <linearGradient id="rg3" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="#fff" stopOpacity="0" />
                <stop offset="0.4" stopColor="#ffe2cc" stopOpacity="0.9" />
                <stop offset="0.75" stopColor="#ffd0b0" stopOpacity="0.5" />
                <stop offset="1" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 12, 24, 38].map((o, i) => (
              <path
                key={o}
                d={`M-200,${592 + o} C 260,${412 + o} 600,${732 + o} 980,${472 + o} S 1460,${362 + o} 1700,${442 + o}`}
                stroke="url(#rg3)"
                strokeWidth={i === 0 ? 1.6 : 0.8}
                fill="none"
                opacity={1 - i * 0.2}
              />
            ))}
          </svg>
        </>
      )}
      <div className="bd-grain" />
      <div className="bd-fade" />
    </div>
  );
}
