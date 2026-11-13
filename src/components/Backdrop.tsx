import { useEffect, useMemo } from 'react';
import { useScans } from './Scans';

/** Pratham's own photo for the glass card on Today, or null for the built-in art. */
export function useHomePhoto(): string | null {
  const photos = useScans('hero', 'hero');
  const photo = photos?.[0];
  const url = useMemo(() => (photo ? URL.createObjectURL(photo.blob) : null), [photo]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  return url;
}

/** Built-in art for the glass card: a summit at dusk, in the app's colours. */
export const SUMMIT_ART =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 320" preserveAspectRatio="xMidYMid slice">
<defs>
<linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6f4f9"/><stop offset=".55" stop-color="#dcd6e6"/><stop offset="1" stop-color="#b9b1c9"/></linearGradient>
<radialGradient id="u" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ff86c0"/><stop offset=".6" stop-color="#ff3d9a"/><stop offset="1" stop-color="#ff3d9a" stop-opacity="0"/></radialGradient>
<linearGradient id="m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2433"/><stop offset="1" stop-color="#0c0a10"/></linearGradient>
<linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9a90ae"/><stop offset="1" stop-color="#c9c1d6"/></linearGradient>
</defs>
<rect width="400" height="320" fill="url(#s)"/>
<circle cx="262" cy="104" r="64" fill="url(#u)" opacity=".85"/>
<path d="M0 230 L70 180 L118 205 L178 150 L232 196 L290 160 L350 200 L400 182 L400 320 L0 320Z" fill="url(#b)" opacity=".8"/>
<path d="M60 320 L150 190 L178 212 L214 120 L248 168 L270 150 L352 320Z" fill="url(#m)"/>
<path d="M214 120 L232 146 L222 142 L214 152 L206 140 L198 148Z" fill="#f2eef7" opacity=".9"/>
</svg>`);
