import { useRef, useState } from 'react';
import { prefersReducedMotion, useShader } from './shader';
import { LogoMark } from '../Logo';
import './gl.css';

// The Cadence emblem: an iridescent loop, with a white-hot "beat" travelling
// around it. Raymarched, lit, with fresnel and a soft halo.
const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uTilt;

mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float sdTorus(vec3 p, vec2 t){ vec2 q = vec2(length(p.xz) - t.x, p.y); return length(q) - t.y; }

vec3 beatPos(){
  float a = uTime * 0.9;
  return vec3(cos(a) * 0.62, 0.0, sin(a) * 0.62);
}

vec3 toLocal(vec3 p){
  p.yz *= rot(1.15 + uTilt.y * 0.25 + 0.12 * sin(uTime * 0.35));
  p.xy *= rot(0.25 + uTilt.x * 0.25);
  p.xz *= rot(uTime * 0.22);
  return p;
}

vec2 map(vec3 p){
  vec3 q = toLocal(p);
  float d = sdTorus(q, vec2(0.62, 0.2));
  vec3 b = beatPos();
  vec3 n = normalize(vec3(b.x, 0.0, b.z));
  float s = length(q - (b + vec3(0.0, 0.31, 0.0))) - 0.085;
  return s < d ? vec2(s, 2.0) : vec2(d, 1.0);
}

vec3 normal(vec3 p){
  vec2 e = vec2(0.0015, 0.0);
  return normalize(vec3(map(p + e.xyy).x - map(p - e.xyy).x, map(p + e.yxy).x - map(p - e.yxy).x, map(p + e.yyx).x - map(p - e.yyx).x));
}

vec3 spectrum(float t){
  t = fract(t);
  vec3 a = vec3(1.0, 0.55, 0.25);
  vec3 b = vec3(1.0, 0.25, 0.5);
  vec3 c = vec3(0.65, 0.4, 1.0);
  vec3 d = vec3(0.25, 0.65, 1.0);
  if (t < 0.25) return mix(a, b, t / 0.25);
  if (t < 0.5) return mix(b, c, (t - 0.25) / 0.25);
  if (t < 0.75) return mix(c, d, (t - 0.5) / 0.25);
  return mix(d, a, (t - 0.75) / 0.25);
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec3 ro = vec3(0.0, 0.0, 3.3);
  vec3 rd = normalize(vec3(uv, -1.55));
  float t = 0.0;
  vec2 h = vec2(1.0, 0.0);
  float minBeat = 10.0;
  for (int i = 0; i < 80; i++) {
    vec3 p = ro + rd * t;
    h = map(p);
    vec3 q = toLocal(p);
    minBeat = min(minBeat, length(q - (beatPos() + vec3(0.0, 0.31, 0.0))));
    if (h.x < 0.001 || t > 5.0) break;
    t += h.x * 0.9;
  }
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  if (h.x < 0.002) {
    vec3 p = ro + rd * t;
    vec3 n = normal(p);
    vec3 L = normalize(vec3(-0.5, 0.8, 0.6));
    float ndv = clamp(dot(n, -rd), 0.0, 1.0);
    float fres = pow(1.0 - ndv, 3.0);
    if (h.y > 1.5) {
      col = vec3(1.0, 0.96, 0.92) * (1.2 + fres);
    } else {
      vec3 q = toLocal(p);
      float ang = atan(q.z, q.x) / 6.2831;
      vec3 base = spectrum(ang + ndv * 0.35 + n.y * 0.15 + uTime * 0.02);
      float dif = 0.5 + 0.6 * max(dot(n, L), 0.0);
      float spec = pow(max(dot(reflect(rd, n), L), 0.0), 60.0);
      float spec2 = pow(max(dot(reflect(rd, n), normalize(vec3(0.7, -0.2, 0.7))), 0.0), 18.0);
      vec3 b = beatPos();
      float near = exp(-6.0 * length(q - b));
      col = base * dif * 0.95 + vec3(1.0) * spec * 1.1 + spectrum(ang + 0.5) * spec2 * 0.35 + fres * mix(vec3(1.0, 0.85, 0.95), base, 0.4) * 0.8;
      col += vec3(1.0, 0.85, 0.7) * near * 0.6;
    }
    alpha = 1.0;
  }
  float halo = exp(-minBeat * 14.0) * 0.9;
  col += vec3(1.0, 0.8, 0.65) * halo * (1.0 - alpha);
  alpha = max(alpha, halo);
  col = col / (1.0 + col * 0.25);
  gl_FragColor = vec4(col * alpha, alpha);
}`;

export function Emblem({ size = '14rem' }: { size?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const tilt = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  useShader(
    ref,
    FRAG,
    {
      scale: Math.min(2, window.devicePixelRatio || 1),
      fps: 50,
      still: prefersReducedMotion(),
      uniforms: (gl, loc) => {
        const m = tilt.current;
        m.x += (m.tx - m.x) * 0.06;
        m.y += (m.ty - m.y) * 0.06;
        gl.uniform2f(loc('uTilt'), m.x, m.y);
      },
    },
    () => setFailed(true),
  );
  return (
    <div
      className="emblem"
      style={{ width: size, height: size }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        tilt.current.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
        tilt.current.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      }}
      onPointerLeave={() => {
        tilt.current.tx = 0;
        tilt.current.ty = 0;
      }}
      aria-hidden="true"
    >
      <div className="emblem-glow" />
      {failed ? <LogoMark size="70%" /> : <canvas ref={ref} />}
    </div>
  );
}
