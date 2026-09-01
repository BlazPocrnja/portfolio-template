/**
 * The hero's ground plane, drawn in SCREEN SPACE on the GPU.
 *
 * WHY THIS EXISTS, because it replaces something that looked simpler.
 *
 * The floor used to be what every other layer in the scene is: a div with a
 * CSS pattern on it, tilted into the box with `rotateX(82deg) translateZ()`
 * and left to the compositor. That works beautifully for the scenery — a
 * plate of artwork is a picture, and a picture is exactly what the
 * compositor stores. A GROUND PLANE is not a picture. It is unbounded, and
 * asking the compositor to hold one means asking it to hold a bitmap big
 * enough that its far edge falls outside the frame after perspective has
 * shrunk it. That bitmap was 9194x2873 CSS px — 26 megapixels, ~240MB of
 * texture at dpr 1.5, the largest single surface on the page by an order of
 * magnitude — and it still was not big enough: covering an ultrawide viewport
 * needs about 13000x4100, which is 53MP, and the plane's own side edges
 * walked into frame before that. The design got worse the wider the window
 * got, and so did the flickering, because every one of those tiles has to be
 * re-rasterised whenever the projection moves.
 *
 * On top of that it was resampled: a CSS 3D transform texture-maps a flat
 * raster with no mipmaps and no anisotropic filter, so every mark on the
 * plane was a bilinear guess whose sub-texel phase drifted whenever the
 * projection moved. (The cells themselves were never as small as they look —
 * measured against the REAL perspective-origin, which is the stage centre and
 * not the plane's own centre, the finest cell on screen inside the haze is
 * about 5px. An earlier note in this file claimed sub-pixel compression; that
 * was arithmetic done with the origin in the wrong place.)
 *
 * The size and the resampling are the same mistake — storing a picture of a
 * plane instead of drawing the plane — and both disappear the moment the
 * projection is inverted per pixel instead:
 *
 *   - Cost is the pixels on screen, not the pixels in the plane. One canvas
 *     the size of the hero, ~19MB at dpr 1.5, whatever the aspect ratio. An
 *     ultrawide costs ultrawide, not 53 megapixels.
 *   - The plane is genuinely infinite. There is no far edge to walk into
 *     frame, ever, at any window size.
 *   - Every pixel is computed at its own position, so nothing is resampled
 *     and nothing can drift. And because the mapping is analytic, each
 *     pixel's footprint on the plane is known in closed form: the checker is
 *     INTEGRATED over that footprint rather than point-sampled, which is
 *     exact anti-aliasing and stays exact however far the ground is pushed.
 *
 * This is the difference between a site that hangs a few pictures in a CSS
 * perspective and one that renders a world: not the amount of 3D, but
 * whether the pixels are stored or computed.
 *
 * THE MAPPING. The scene is a CSS perspective, so this has to invert CSS's
 * own projection exactly or the ground will not sit against the scenery.
 * With perspective P and perspective-origin O, CSS puts a point at depth z
 * on screen at `O + (layout - O) * P/(P - z)`. The plane's centre sits at
 * layout point C and depth Z, tilted by `tilt` about X, so a point `u` along
 * the plane from its centre (u positive toward the viewer) is at layout
 * `C.y + u*cos(tilt)` and depth `Z + u*sin(tilt)`. Solving that for u given a
 * screen row S (measured from the origin) gives everything else:
 *
 *     u = (S*B - P*dy) / (A + S*sin)      A = P*cos(tilt), B = P - Z, dy = C.y - O.y
 *     k = P / (B - u*sin)                 the row's scale
 *     du/dS = (B*A + P*dy*sin) / (A + S*sin)^2
 *
 * `A + S*sin == 0` is the vanishing line: above it there is no ground, which
 * is the one branch this shader discards.
 */

import { resolveColor } from './halftone';

export interface FloorCamera {
  /** perspective-origin, in the canvas's own CSS px */
  ox: number;
  oy: number;
  /** the plane centre's LAYOUT position (pre-projection), same space */
  cx: number;
  cy: number;
}

export interface FloorOptions {
  perspective: number;
  /** plane centre depth; negative is into the screen */
  z: number;
  tiltDeg: number;
  /** checker cell pitch on the plane, in layout px */
  tileW: number;
  tileD: number;
  /** The retired element's height. Nothing is this tall any more, but the
   *  distance haze was tuned as percentages of it, so it stays the unit
   *  those three numbers are expressed in and the fade is unchanged. */
  planeH: number;
}

const VERT = `attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `precision highp float;
uniform vec2 uOrigin;
uniform vec2 uCentre;
uniform float uP, uB, uA, uSin;
uniform float uDpr, uCanvasH;
uniform vec2 uTile;
uniform float uFlow, uHalfH;
uniform vec3 uLight, uInk;

/* Integral from 0 to x of a half-duty square wave of period T: the exact
   area of "dark" in [0, x]. Two of these differenced give the fraction of
   any interval that is dark, which is a box filter over the pattern — the
   whole anti-aliasing story in three lines. */
float wave(float x, float T) {
  float h = T * 0.5;
  float n = floor(x / T);
  return n * h + min(x - n * T, h);
}
/* Coverage over [p, p+w]. Once a pixel spans a whole period the answer is
   flat 0.5 by definition, which is also what keeps the far field out of the
   precision hole where u and the column coordinate both run away. */
float cov(float p, float w, float T) {
  if (w >= T) return 0.5;
  return (wave(p + w, T) - wave(p, T)) / w;
}

void main() {
  vec2 px = vec2(gl_FragCoord.x, uCanvasH - gl_FragCoord.y) / uDpr;
  float S = px.y - uOrigin.y;
  float den = uA + S * uSin;
  if (den <= 0.0) discard;                  // at or above the vanishing line
  float dy = uCentre.y - uOrigin.y;
  float u = (S * uB - uP * dy) / den;

  /* Haze first, so the rows past it never reach the arithmetic below —
     that is where k collapses and the column coordinate goes to infinity. */
  float t = 0.5 - u / (uHalfH * 2.0);       // 0 at the near edge .. 1 at the far
  // The retired mask's own stops, and linear like it was: 0% -> 9% in,
  // held to 58%, out by 88%.
  float alpha = clamp(t / 0.09, 0.0, 1.0) * clamp((0.88 - t) / 0.30, 0.0, 1.0);
  if (alpha <= 0.002) discard;

  float k = uP / (uB - u * uSin);
  if (k <= 0.0) discard;                    // rows behind the eye
  float a = (px.x - uOrigin.x) / k - (uCentre.x - uOrigin.x);

  // this pixel's own footprint on the plane, along each axis
  float du = (uB * uA + uP * dy * uSin) / (den * den * uDpr);
  float da = 1.0 / (k * uDpr);

  float cd = cov(u - uFlow + uHalfH, du, uTile.y);
  float cw = cov(a, da, uTile.x);
  float tone = cw + cd - 2.0 * cw * cd;     // XOR, and exact for a box filter

  gl_FragColor = vec4(mix(uLight, uInk, tone) * alpha, alpha);
}`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export function createFloor(canvas: HTMLCanvasElement, options: FloorOptions) {
  const { perspective: P, z: Z, tiltDeg, planeH } = options;
  const tilt = (tiltDeg * Math.PI) / 180;
  const A = P * Math.cos(tilt);
  const B = P - Z;
  const sin = Math.sin(tilt);

  let gl: WebGLRenderingContext | null = null;
  let prog: WebGLProgram | null = null;
  let uni: Record<string, WebGLUniformLocation | null> = {};
  let lost = false;

  let camera: FloorCamera = { ox: 0, oy: 0, cx: 0, cy: 0 };
  let tile = { w: options.tileW, d: options.tileD };
  let halfH = planeH / 2;
  let flow = 0;
  let light: [number, number, number] = [10, 10, 10];
  let ink: [number, number, number] = [80, 80, 80];
  let dpr = 1;
  let bw = 0;
  let bh = 0;
  let raf = 0;

  function init() {
    gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      // The shader writes premultiplied colour, which is what the compositor
      // wants and what keeps the haze from fringing.
      premultipliedAlpha: true,
      powerPreference: 'low-power',
    }) as WebGLRenderingContext | null;
    if (!gl) return false;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return false;
    prog = gl.createProgram();
    if (!prog) return false;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    gl.useProgram(prog);

    /* One triangle that covers the clip cube, not two for a quad: fewer
       vertices, no seam down the diagonal, and every fragment is shaded
       exactly once. */
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    uni = {};
    for (const n of ['uOrigin', 'uCentre', 'uP', 'uB', 'uA', 'uSin', 'uDpr', 'uCanvasH', 'uTile', 'uFlow', 'uHalfH', 'uLight', 'uInk']) {
      uni[n] = gl.getUniformLocation(prog, n);
    }
    gl.uniform1f(uni.uP, P);
    gl.uniform1f(uni.uB, B);
    gl.uniform1f(uni.uA, A);
    gl.uniform1f(uni.uSin, sin);
    return true;
  }

  const ok = init();

  function readColors() {
    const cs = getComputedStyle(canvas);
    light = resolveColor(cs.color, light);
    ink = resolveColor(cs.getPropertyValue('--floor-ink').trim(), ink);
    schedule();
  }

  /** Sizes the backing store to the box, at the display's own resolution —
   *  the whole point of this renderer is that those are now the same number
   *  of pixels, so there is nothing to scale and nothing to resample. */
  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const nw = Math.round(w * dpr);
    const nh = Math.round(h * dpr);
    if (nw === bw && nh === bh) return;
    bw = nw;
    bh = nh;
    canvas.width = bw;
    canvas.height = bh;
    gl?.viewport(0, 0, bw, bh);
    schedule();
  }

  function draw() {
    raf = 0;
    if (!gl || !prog || lost || !bw || !bh) return;
    gl.uniform2f(uni.uOrigin, camera.ox, camera.oy);
    gl.uniform2f(uni.uCentre, camera.cx, camera.cy);
    gl.uniform1f(uni.uDpr, dpr);
    gl.uniform1f(uni.uCanvasH, bh);
    gl.uniform2f(uni.uTile, tile.w, tile.d);
    gl.uniform1f(uni.uFlow, flow);
    gl.uniform1f(uni.uHalfH, halfH);
    gl.uniform3f(uni.uLight, light[0] / 255, light[1] / 255, light[2] / 255);
    gl.uniform3f(uni.uInk, ink[0] / 255, ink[1] / 255, ink[2] / 255);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /* Coalesced to a frame. The scroll and the pointer parallax both push new
     state, often in the same tick, and there is no point drawing twice for
     one paint. */
  function schedule() {
    if (!raf && ok && !lost) raf = requestAnimationFrame(draw);
  }

  function onLost(e: Event) {
    e.preventDefault();
    lost = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }
  function onRestored() {
    lost = false;
    if (init()) {
      bw = bh = 0;
      resize();
      readColors();
    }
  }
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  const themeObserver = new MutationObserver(readColors);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  if (ok) {
    readColors();
    resize();
  }

  return {
    supported: ok,
    resize,
    /** Plane geometry that depends on the stage size, so it moves on resize. */
    setPlane(next: { tileW: number; tileD: number; planeH: number }) {
      tile = { w: next.tileW, d: next.tileD };
      halfH = next.planeH / 2;
      schedule();
    },
    setCamera(next: FloorCamera) {
      if (next.ox === camera.ox && next.oy === camera.oy && next.cx === camera.cx && next.cy === camera.cy) return;
      camera = next;
      schedule();
    },
    setFlow(next: number) {
      if (next === flow) return;
      flow = next;
      schedule();
    },
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      themeObserver.disconnect();
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
      gl = null;
      prog = null;
    },
  };
}
