// Minimal WebGL runner for full-quad fragment shaders. No dependencies.
import { useEffect, useRef, type RefObject } from 'react';

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

export interface ShaderOptions {
  /** Render-buffer pixels per CSS pixel. Low for soft backgrounds. */
  scale: number;
  fps?: number;
  /** Called every frame to set extra uniforms. */
  uniforms?: (gl: WebGLRenderingContext, loc: (name: string) => WebGLUniformLocation | null, t: number) => void;
  /** Draw a single frame only (reduced motion). */
  still?: boolean;
}

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.warn(gl.getShaderInfoLog(s));
    return null;
  }
  return s;
}

/** Returns false (via onFail) if WebGL is unavailable, so callers can fall back to CSS. */
export function useShader(canvas: RefObject<HTMLCanvasElement | null>, frag: string, opts: ShaderOptions, onFail?: () => void) {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const gl = el.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false, powerPreference: 'low-power' });
    if (!gl || gl.isContextLost()) {
      onFail?.();
      return;
    }
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, frag);
    if (!vs || !fs) {
      onFail?.();
      return;
    }
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const ap = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(ap);
    gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 0, 0);
    const cache = new Map<string, WebGLUniformLocation | null>();
    const loc = (n: string) => {
      if (!cache.has(n)) cache.set(n, gl.getUniformLocation(prog, n));
      return cache.get(n)!;
    };

    const resize = () => {
      const r = el.getBoundingClientRect();
      const s = optsRef.current.scale;
      const w = Math.max(1, Math.round(r.width * s));
      const h = Math.max(1, Math.round(r.height * s));
      if (el.width !== w || el.height !== h) {
        el.width = w;
        el.height = h;
      }
      gl.viewport(0, 0, w, h);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    // Only render while on screen.
    let visible = true;
    const io = new IntersectionObserver(([e]) => {
      const was = visible;
      visible = e.isIntersecting;
      if (visible && !was && !raf) raf = requestAnimationFrame(draw);
    });
    io.observe(el);

    const start = performance.now() - Math.random() * 20000;
    let raf = 0;
    let last = 0;
    const draw = (now: number) => {
      const o = optsRef.current;
      if (!visible) {
        raf = 0;
        return;
      }
      raf = o.still ? 0 : requestAnimationFrame(draw);
      if (document.hidden) return;
      const minGap = 1000 / (o.fps ?? 30);
      if (now - last < minGap - 2) return;
      last = now;
      const t = (now - start) / 1000;
      gl.uniform2f(loc('uRes'), el.width, el.height);
      gl.uniform1f(loc('uTime'), t);
      o.uniforms?.(gl, loc, t);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      // Do not force-lose the context: React may remount on the same canvas.
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frag]);
}

export const prefersReducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
