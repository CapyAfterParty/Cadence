import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useScans } from './Scans';
import './backdrop.css';

/** The user's own homepage photo, laid over the aurora and melted into it. */
export function HeroPhoto() {
  const { pathname } = useLocation();
  const photos = useScans('hero', 'hero');
  const photo = pathname === '/' ? photos?.[0] : undefined;
  const url = useMemo(() => (photo ? URL.createObjectURL(photo.blob) : null), [photo]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  if (!url) return null;
  return (
    <div className="hero-photo" aria-hidden="true">
      <img src={url} alt="" />
    </div>
  );
}
