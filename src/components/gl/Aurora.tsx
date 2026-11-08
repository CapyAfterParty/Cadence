import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion, useShader } from './shader';
import './gl.css';

// Domain-warped noise, mapped onto the Cadence spectrum. Brightest at the top,
// sinking into ink below, so content always sits on a calm base.
const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform float uIntensity;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = uv * vec2(uRes.x / uRes.y, 1.0);
  float t = uTime * 0.045;
  p += uMouse * 0.06;

  vec2 q = vec2(fbm(p * 1.3 + vec2(0.0, t)), fbm(p * 1.3 + vec2(5.2, -t)));
  vec2 r = vec2(fbm(p * 1.6 + 2.2 * q + vec2(1.7, 9.2) + t * 1.4), fbm(p * 1.6 + 2.2 * q + vec2(8.3, 2.8) - t));
  float f = fbm(p * 1.1 + 2.6 * r);

  vec3 ember  = vec3(1.00, 0.45, 0.20);
  vec3 rose   = vec3(1.00, 0.22, 0.45);
  vec3 orchid = vec3(0.58, 0.32, 1.00);
  vec3 lagoon = vec3(0.10, 0.55, 1.00);
  vec3 ink    = vec3(0.027, 0.027, 0.043);

  vec3 col = mix(lagoon, orchid, smoothstep(0.25, 0.65, q.x));
  col = mix(col, rose, smoothstep(0.35, 0.8, r.y));
  col = mix(col, ember, smoothstep(0.5, 0.95, f + 0.15 * q.y));

  float glow = smoothstep(0.2, 0.95, f * 1.15);
  float top = smoothstep(-0.05, 1.0, uv.y);
  top = top * top;
  float ribbon = smoothstep(0.35, 0.0, abs(uv.y - 0.72 - 0.08 * sin(uv.x * 3.0 + t * 6.0) - 0.1 * (q.x - 0.5)));

  // Deep, saturated light: colour comes through, but never washes out text.
  vec3 c = ink + col * col * glow * (0.06 + 0.72 * top + 0.22 * ribbon) * uIntensity;
  float vig = smoothstep(1.25, 0.35, length((uv - vec2(0.5, 0.65)) * vec2(1.0, 1.25)));
  c *= mix(0.55, 1.0, vig);
  c = pow(c, vec3(0.95));
  gl_FragColor = vec4(c, 1.0);
}`;

/** The living background. Intensity eases between screens. */
export function Aurora({ intensity }: { intensity: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const target = useRef(intensity);
  const current = useRef(intensity);
  const mouse = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  target.current = intensity;

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      mouse.current.tx = (e.clientX / innerWidth - 0.5) * 2;
      mouse.current.ty = (0.5 - e.clientY / innerHeight) * 2;
    };
    addEventListener('pointermove', onMove, { passive: true });
    return () => removeEventListener('pointermove', onMove);
  }, []);

  useShader(
    ref,
    FRAG,
    {
      scale: 0.22,
      fps: 30,
      still: prefersReducedMotion(),
      uniforms: (gl, loc) => {
        current.current += (target.current - current.current) * 0.05;
        const m = mouse.current;
        m.x += (m.tx - m.x) * 0.03;
        m.y += (m.ty - m.y) * 0.03;
        gl.uniform1f(loc('uIntensity'), current.current);
        gl.uniform2f(loc('uMouse'), m.x, m.y);
      },
    },
    () => setFailed(true),
  );

  return (
    <div className="aurora" aria-hidden="true">
      {failed ? <div className="aurora-fallback" style={{ opacity: Math.min(1, intensity) }} /> : <canvas ref={ref} />}
      <div className="aurora-grain" />
    </div>
  );
}
