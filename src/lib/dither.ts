/**
 * DITHER renderer — the fourth way a hero layer can be drawn, next to the
 * ascii mosaic (./ascii.ts), the line screen (./linescreen.ts) and the dot /
 * stitch screens (./halftone.ts).
 *
 * The odd one out: the other three INVENT a screen and re-render the art
 * through it. This one draws the art exactly as authored — a 1-bit stipple
 * dithered by hand in Photoshop — and only disturbs it under the cursor.
 * That is the point. The engraving's dot pattern already IS the texture, at
 * a contrast no procedural screen was matching, so re-screening it threw
 * away the thing worth keeping.
 *
 * WHY THE BUFFER IS SIZED OFF THE FILE, NOT THE BOX
 *
 * Every other renderer here picks its own grain and rasterises the source
 * into it. A hand-dithered bitmap has no grain to pick: its resolution is a
 * property of the file, and resampling it to anything else averages
 * neighbouring dots into greys — which is precisely how a 1-bit stipple
 * stops being 1-bit. So the buffer matches the source pixel-for-pixel
 * (capped by the backing store, since there is no point holding more pixels
 * than the canvas can show) and is blown up with smoothing OFF.
 *
 * THE GLITCH
 *
 * A static bitmap can still be interactive: it is just pixels, and pixels
 * can be moved and dropped. Within a radius of the cursor the image is
 * resampled through a horizontal TEAR (rows band together and slide, the
 * way a broken scanout looks) while ink DROPS OUT and SPILLS into its
 * neighbours at random, so the stipple boils in place. Both are driven off the pointer position rather than a clock, so
 * the effect animates while the mouse moves and costs exactly nothing when
 * it stops — same bargain the line screen makes.
 */

export interface DitherOptions {
  /** Cap on the working buffer's longest side. The source is used at its own
   * resolution below this; past it there is more art than any screen can
   * show and the extra pixels are pure fill rate. */
  maxSide?: number;
  /** Glitch radius as a fraction of the art's longest side. Deliberately
   * NOT in CSS px: every hero layer is laid out oversized and scaled back
   * down by the stage's perspective transform, so a radius in element px
   * lands at a different apparent size on every layer. Measuring against
   * the artwork makes the glitch the same size relative to the picture no
   * matter how deep in the box it sits. */
  radius?: number;
  /** Peak row displacement at the centre of the glitch, as a fraction of
   * the art's width. */
  tear?: number;
  /** Peak share of ink dropped at the centre of the glitch, 0..1. */
  dropout?: number;
  /** Peak chance that an EMPTY pixel near the cursor picks up ink displaced
   * from its surroundings. Dropout alone only ever erases, which reads as a
   * hole being rubbed in the art; pairing it with spill makes the stipple
   * churn in place instead — the same "comes apart and reassembles" read as
   * the ascii mosaic's ripple. */
  spill?: number;
  /** Rows per tear band. 1 shears every row independently (reads as noise);
   * a few rows at a time is what reads as a torn scanout. */
  band?: number;
  /** Fallback ink strength when --linescreen-alpha isn't set in CSS. */
  opacity?: number;
}

/** Backing-store cap — past 2x the extra pixels just cost fill rate. */
const MAX_DPR = 2;

/** Cheap integer hash -> 0..1. Deterministic in its inputs, which is what
 * lets the scatter be recomputed from scratch every repaint instead of
 * stored: the same pixel under the same cursor always decides the same way,
 * so the noise sits still while the mouse does. */
function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Owns one canvas's dither render.
 *
 * Same contract as the other screens (setImage/refresh/destroy, colour read
 * off the element's own CSS, ink strength from --linescreen-alpha) so all
 * four stay swappable behind one component.
 */
import { watchPointer } from './pointer';

export function createDither(canvas: HTMLCanvasElement, options: DitherOptions = {}) {
  const maxSide = options.maxSide ?? 1100;
  const radiusFrac = options.radius ?? 0.3;
  const tearFrac = options.tear ?? 0.045;
  const dropoutMax = options.dropout ?? 0.5;
  const spillMax = options.spill ?? 0.38;
  const band = Math.max(1, options.band ?? 4);
  const opacityDefault = options.opacity ?? 0.9;

  const ctx = canvas.getContext('2d');

  let source: CanvasImageSource | null = null;
  let sourceW = 0;
  let sourceH = 0;

  const buf = document.createElement('canvas');
  const bctx = buf.getContext('2d', { willReadFrequently: true });
  let image: ImageData | null = null;

  /** The artwork's own alpha, one byte per buffer pixel — the thing the
   * glitch reads FROM. Kept separate from `image` because a glitched
   * repaint has to start from the clean plate every time; sampling the
   * previous frame would smear the damage permanently. */
  let base: Uint8Array = new Uint8Array(0);
  let ow = 0;
  let oh = 0;
  let viewW = 0;
  let viewH = 0;

  // Raw CSS colour string handed straight to fillStyle — see the note in
  // linescreen.ts on why this is never parsed here.
  let baseColor = 'rgb(220,220,220)';
  let opacity = opacityDefault;

  let pointerX = -1;
  let pointerY = -1;
  let hoverRaf = 0;

  function readColors() {
    const cs = getComputedStyle(canvas);
    baseColor = cs.color || 'rgb(220,220,220)';
    const v = parseFloat(cs.getPropertyValue('--linescreen-alpha'));
    opacity = Number.isFinite(v) ? v : opacityDefault;
  }

  function resample(): boolean {
    if (!bctx || !source || !sourceW || !sourceH) return false;
    viewW = canvas.clientWidth;
    viewH = canvas.clientHeight;
    if (!viewW || !viewH) return false;

    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const bw = Math.round(viewW * dpr);
    const bh = Math.round(viewH * dpr);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 1:1 with the file wherever the canvas can hold it. Going finer than
    // the backing store would only be thrown away at blit time; going
    // coarser is a real loss, so that only happens when the element is
    // genuinely smaller than the art.
    const cap = Math.min(maxSide, Math.max(bw, bh));
    const scale = Math.min(1, cap / Math.max(sourceW, sourceH));
    ow = Math.max(2, Math.round(sourceW * scale));
    oh = Math.max(2, Math.round(sourceH * scale));

    if (buf.width !== ow || buf.height !== oh) {
      buf.width = ow;
      buf.height = oh;
    }
    bctx.clearRect(0, 0, ow, oh);
    // Smoothing left ON for this one draw: if the element really is smaller
    // than the art, averaging the dots down is the lesser evil. Nearest
    // neighbour on a stipple picks winners at random and moires horribly.
    bctx.imageSmoothingEnabled = true;
    bctx.drawImage(source, 0, 0, ow, oh);
    let data: Uint8ClampedArray;
    try {
      data = bctx.getImageData(0, 0, ow, oh).data;
    } catch {
      // Tainted canvas (cross-origin source without CORS).
      return false;
    }
    base = new Uint8Array(ow * oh);
    for (let i = 0; i < ow * oh; i++) base[i] = data[i * 4 + 3] ?? 0;
    image = bctx.createImageData(ow, oh);
    return true;
  }

  function render() {
    if (!ctx || !bctx || !image || !ow || !oh) return;
    const px = image.data;
    px.fill(0);

    // Pointer in BUFFER pixels. The buffer is the file's own grid, not the
    // screen's, so this is a genuine change of coordinate system rather
    // than the other screens' constant divide.
    const hx = pointerX >= 0 ? (pointerX / viewW) * ow : -1;
    const hy = (pointerY / viewH) * oh;
    const hr = Math.max(ow, oh) * radiusFrac;
    const hr2 = hr * hr;
    const tearMax = ow * tearFrac;
    // Reseeded from the cursor, so the tear and the scatter reshuffle as the
    // mouse travels. This is the entire animation: no clock, no rAF loop.
    const seed = (Math.round(pointerX) * 7 + Math.round(pointerY) * 131) | 0;

    for (let y = 0; y < oh; y++) {
      const rowOff = y * ow;
      // Rows far from the cursor never enter the glitch path at all — for a
      // stationary pointer that is most of the image.
      const dyTop = y - hy;
      const rowInRange = hx >= 0 && dyTop * dyTop < hr2;
      let shift = 0;
      if (rowInRange) {
        // One displacement per BAND of rows. Shearing every row on its own
        // reads as static; a few rows moving together reads as a tear.
        const n = hash((y / band) | 0, 0, seed);
        shift = (n * 2 - 1) * tearMax;
      }
      for (let x = 0; x < ow; x++) {
        let v: number;
        if (!rowInRange) {
          v = base[rowOff + x];
        } else {
          const dx = x - hx;
          const d2 = dx * dx + dyTop * dyTop;
          if (d2 >= hr2) {
            v = base[rowOff + x];
          } else {
            // Falls off from the cursor so the damage has a soft boundary —
            // a hard-edged disc of glitch reads as a circular mask sitting
            // on the art rather than as the art itself coming apart.
            const k = 1 - Math.sqrt(d2) / hr;
            let src = x + Math.round(shift * k);
            if (src < 0) src = 0;
            else if (src >= ow) src = ow - 1;
            v = base[rowOff + src];
            if (v) {
              if (hash(x, y, seed + 9973) < dropoutMax * k * k) v = 0;
            } else if (hash(x, y, seed + 4211) < spillMax * k * k) {
              // Pick up ink from a jittered neighbour. Sampling the ART
              // rather than lighting the pixel outright is what keeps the
              // churn glued to the drawing — an unconditional scatter would
              // spray dots into the empty stage around the silhouette.
              const jx = src + ((hash(x, y, seed + 77) * 7) | 0) - 3;
              const jy = y + ((hash(x, y, seed + 613) * 7) | 0) - 3;
              if (jx >= 0 && jx < ow && jy >= 0 && jy < oh) v = base[jy * ow + jx];
            }
          }
        }
        if (!v) continue;
        const i = (rowOff + x) * 4;
        // Coverage mask; colour arrives in the tint pass below.
        px[i] = 255;
        px[i + 1] = 255;
        px[i + 2] = 255;
        px[i + 3] = v;
      }
    }

    bctx.putImageData(image, 0, 0);
    ctx.clearRect(0, 0, viewW, viewH);
    // Nearest neighbour: the dots are meant to look like dots, not like a
    // photograph of dots.
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buf, 0, 0, ow, oh, 0, 0, viewW, viewH);
    ctx.globalCompositeOperation = 'source-in';
    ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  function setImage(next: CanvasImageSource, naturalW: number, naturalH: number) {
    source = next;
    sourceW = naturalW;
    sourceH = naturalH;
    readColors();
    if (resample()) render();
  }

  function refresh() {
    readColors();
    if (resample()) render();
  }

  const themeObserver = new MutationObserver(refresh);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  function scheduleHover() {
    if (hoverRaf) return;
    hoverRaf = requestAnimationFrame(() => {
      hoverRaf = 0;
      render();
    });
  }
  function onLeave() {
    if (pointerX < 0) return;
    pointerX = -1;
    pointerY = -1;
    scheduleHover();
  }

  /* Window-routed rather than bound to the canvas: the hero's layers overlap
   * as rectangles and the browser can only hand a move to one of them, so
   * the canvases no longer hit-test at all. No ink gate here — unlike the
   * screens, this variant draws the art as authored across its whole box. */
  const unwatchPointer = watchPointer(canvas, {
    move(x, y) {
      pointerX = x;
      pointerY = y;
      scheduleHover();
    },
    leave: onLeave,
  });

  return {
    setImage,
    refresh,
    destroy() {
      if (hoverRaf) cancelAnimationFrame(hoverRaf);
      themeObserver.disconnect();
      unwatchPointer();
    },
  };
}
