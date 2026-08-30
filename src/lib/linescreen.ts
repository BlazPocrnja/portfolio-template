/**
 * LINE-SCREEN renderer — the second way a hero layer can be drawn, next to
 * the ascii mosaic in ./ascii.ts.
 *
 * It's the engraving/banknote screen: evenly spaced vertical lines whose
 * THICKNESS tracks local tone. Lit areas swell until neighbouring lines
 * nearly touch, shadows taper them away. Same idea as a halftone, but the
 * cell is a line rather than a dot, which is why it reads as hatching
 * instead of stipple.
 *
 * TWO THINGS THIS DELIBERATELY DOES NOT DO
 *
 * 1. It does not animate. A screen is a fixed raster that content is seen
 *    THROUGH; the life comes from the artwork moving behind it, not from
 *    the screen wobbling on its own. An earlier version added travelling
 *    sway/pulse waves and it read as an effect stuck on top rather than as
 *    a print process. Dropping that also removes the rAF loop entirely, so
 *    an idle panel costs nothing at all.
 *
 * 2. It does not draw smooth vector paths. Tone is rasterised by hand into
 *    a small ImageData — one array write per rendered pixel, no
 *    antialiasing anywhere — which is then blown up with image smoothing
 *    OFF. Canvas path fills are unavoidably antialiased, and that feathered
 *    taper looks airbrushed rather than screened. Hard pixel edges and a
 *    quantised set of line widths are the whole character of a real screen,
 *    so they're produced on purpose rather than merely tolerated.
 */

export interface LineScreenOptions {
  /** CSS px per rendered pixel — the upscale factor, i.e. how chunky. */
  pixel?: number;
  /** Rendered px between line centres. This sets how many tone steps exist
   * at all: a lane of N rendered px can only hold N distinct line widths,
   * and `weight` must leave at least one px of it unlit or the lit areas
   * close into a solid slab and stop reading as lines. */
  pitch?: number;
  /** Peak line width as a fraction of the lane. Past ~0.95 lit areas close
   * into a solid slab and the hatching stops reading as lines. */
  weight?: number;
  /** Thinnest inked line as a fraction of the lane. */
  floor?: number;
  /** Fallback ink strength when --linescreen-alpha isn't set in CSS. */
  opacity?: number;
  /** Patch radius in CELLS — a cell here being one lane wide and one row
   * band deep. In cells and not px so the patch covers the same number of
   * marks on every layer whatever its grain or its depth in the stage; a
   * radius in px lands a patch several times the size on a near-camera
   * layer. Every mark jitters it by up to ±100%; see THE PATCH RULE. */
  patchRadius?: number;
  /** How far a lit segment swells, as a fraction of the screen's whole tonal
   * range — added to the width its own tone already earned, so the figure's
   * modelling survives inside the patch. See THE PATCH RULE. */
  litStep?: number;
  /** Ceiling on a lit lane's width, as a fraction of the lane. Below 1 or the
   * brightest lanes close into a solid block under the cursor. */
  litMax?: number;
  /** How long a segment the cursor touched holds its lift before dropping
   * back, in ms. Jittered per segment, so the patch frays out behind the
   * cursor rather than lifting off in one piece. */
  holdMs?: number;
}

/** Backing-store cap — past 2x the extra pixels just cost fill rate. */
const MAX_DPR = 2;

/**
 * Owns one canvas's line-screen render.
 *
 * Mirrors createAsciiMosaic's contract on purpose — refresh/destroy, colour
 * read from the element's own CSS — so the two renderers stay swappable
 * behind one component. Unlike the mosaic there is no frame loop: the
 * screen is static, and only the cursor patch or a resize repaints it.
 */
import { watchPointer } from './pointer';

/* Integer hash -> 0..1. Stable for a given pair, so a mark keeps its place
 * in the hover patch's ragged edge on every pass of the cursor — the shape
 * has to be the SAME broken shape each time or it reads as static rather
 * than as a torn hole. Integer ops rather than the sin trick: this is
 * sampled per mark per hover frame. */
function hash2(x: number, y: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}


/* THE PATCH RULE — shared by the pointer's two consequences.
 *
 * Membership is BINARY and jittered: a mark is in the patch if the cursor is
 * inside that mark's OWN radius, which strays up to ±100% from the nominal
 * one on a hash of where it sits. No falloff term. That is the whole rule,
 * and it is the reason the glitch reads as a torn hole rather than a shape
 * drawn on the art.
 *
 * It matters that there is no falloff. A smooth 1 - d²/r² ramp underneath
 * the jitter looks like it should help, and does nothing: a mark near its
 * own jittered edge is worth almost no ink under that ramp, so extending or
 * shrinking its radius changes nothing you can see, and what survives is the
 * smooth core — a spotlight with a slightly fuzzy rim. Density has to be the
 * only thing that falls off with distance, and here it does, statistically:
 * every mark is in at the centre, half are in at the nominal radius, a few
 * stragglers reach twice it.
 *
 * What a mark DOES once it is in the patch is the only thing that differs
 * between layers, and it is a difference of DRESS, not of mechanism: one
 * `accent` flag picks between an accent tile with the glyph knocked out of
 * it, and the same mark stepped up its own alphabet in the layer's own ink
 * at full strength. Same membership, same hold, same churn, same buffer —
 * only the colours change.
 *
 * The consequence is RELATIVE to the mark's own tone: a lit mark climbs a
 * fixed number of rungs from wherever it already sat, so the art's modelling
 * survives inside the patch — a shadow stays a shadow, it just comes up.
 * (The accent dress mirrors instead of climbing, which is its own kind of
 * relative.) An earlier pass sent every lit mark to a FIXED rung near the
 * top, on the theory that tone dependence was what made the effect look
 * radial. It wasn't, and the result was a scatter of blown-out white marks
 * with the picture's own light thrown away inside the patch.
 *
 * What must never come back is a term that varies with DISTANCE from the
 * cursor. That is the thing that draws a disc, whatever the consequence is
 * doing: a smooth 1 - d²/r² ramp is worth almost no ink at a mark's own
 * jittered edge, so extending or shrinking that edge changes nothing you can
 * see and the smooth core survives as a spotlight with a fuzzy rim. Distance
 * is allowed to decide WHETHER a mark is in. It is not allowed to decide how
 * much.
 *
 * Both consequences also HOLD. A mark the cursor touched keeps what it was
 * given for `holdMs`, halved for about half of them on the same hash, and
 * then drops. That jitter is the point: the patch does not lift off in one
 * piece when the cursor moves on, it frays away behind it, and a mark that
 * has not been touched for a while goes out on its own schedule rather than
 * with its neighbours. Without it the effect snaps to the pointer and reads
 * as a cursor decoration instead of as something happening to the art.
 */

/** One step of break off the lit width, as a fraction of it. */
const LIT_BREAK = 0.14;

export function createLineScreen(canvas: HTMLCanvasElement, options: LineScreenOptions = {}) {
  const pixel = Math.max(1, options.pixel ?? 3);
  const pitch = Math.max(2, options.pitch ?? 3);
  const weight = options.weight ?? 0.72;
  const floorW = options.floor ?? 0.12;
  const opacityDefault = options.opacity ?? 0.62;
  const patchRadius = options.patchRadius ?? 3.5;
  const litStep = options.litStep ?? 0.6;
  const litMax = options.litMax ?? 0.92;
  const holdMs = options.holdMs ?? 260;

  const ctx = canvas.getContext('2d');

  let source: CanvasImageSource | null = null;

  // Low-resolution render target: the screen is rasterised here one array
  // write per pixel, then blown up onto the visible canvas.
  const buf = document.createElement('canvas');
  const bctx = buf.getContext('2d', { willReadFrequently: true });
  let image: ImageData | null = null;

  /** cols x oh tone samples — one row per RENDERED row, so the vertical
   * taper quantises on the same grid the ink does. */
  let tone: Float32Array = new Float32Array(0);
  let cols = 0;
  let ow = 0;
  let oh = 0;
  let viewW = 0;
  let viewH = 0;

  // Kept as the raw CSS string and handed to fillStyle rather than parsed:
  // getComputedStyle resolves the token to `color(srgb 0.91 0.9 0.89)` —
  // 0..1 floats, not 0..255 — so pulling numbers out of it and treating
  // them as 8-bit channels renders the ink almost black. Let canvas parse.
  let baseColor = 'rgb(220,220,220)';
  let opacity = opacityDefault;

  let pointerX = -1;
  let pointerY = -1;

  /* ---- held lift ------------------------------------------------------
   * One slot per (lane, row-band) — the unit the patch is broken on. Flat
   * arrays rather than the map the dot screen uses, because this renderer
   * has no per-mark repaint to drive: it rebuilds its whole buffer anyway,
   * so expiry can just be a comparison made while painting and nothing has
   * to be swept. `bandRows` is set with the lattice; see `breakBand`. */
  let holdUntil: Float64Array = new Float64Array(0);
  let holdAmt: Float32Array = new Float32Array(0);
  let bands = 0;
  let bandRows = 1;
  /** Layout px per on-screen px for this layer, from its own projected box.
   * The GRAIN here is deliberately authored in layout space and so shrinks
   * with depth, but the patch must not: it is a cursor-sized thing, and left
   * uncorrected a deep layer's patch came out a third the size of a near
   * one's for the same radius in cells. Only the patch reads this. */
  let projScale = 1;
  /** Latest expiry outstanding — the whole condition for keeping the loop
   * alive, since nothing else has to be tracked. */
  let holdMax = 0;
  let patchRaf = 0;
  let patchPending = false;

  function readColors() {
    const cs = getComputedStyle(canvas);
    baseColor = cs.color || 'rgb(220,220,220)';
    // Ink strength is a CSS var so each theme can set it independently: a
    // value that keeps bone lines from blowing out on the dark stage leaves
    // dark lines nearly invisible on the light one, because thin marks lose
    // far more contrast against a bright ground.
    const v = parseFloat(cs.getPropertyValue('--linescreen-alpha'));
    opacity = Number.isFinite(v) ? v : opacityDefault;
  }

  /** Resamples the source into the tone field. Only needed when the box
   * size changes, not on every repaint. */
  function resample(): boolean {
    if (!bctx || !source) return false;
    viewW = canvas.clientWidth;
    viewH = canvas.clientHeight;
    if (!viewW || !viewH) return false;

    const projected = canvas.getBoundingClientRect().width;
    projScale = projected > 0 ? viewW / projected : 1;
    ow = Math.max(2, Math.round(viewW / pixel));
    oh = Math.max(2, Math.round(viewH / pixel));
    cols = Math.max(2, Math.round(ow / pitch));

    if (buf.width !== ow || buf.height !== oh) {
      buf.width = ow;
      buf.height = oh;
    }
    bctx.clearRect(0, 0, ow, oh);
    bctx.drawImage(source, 0, 0, cols, oh);
    let data: Uint8ClampedArray;
    try {
      data = bctx.getImageData(0, 0, cols, oh).data;
    } catch {
      // Tainted canvas (cross-origin source without CORS).
      return false;
    }
    tone = new Float32Array(cols * oh);
    for (let i = 0; i < cols * oh; i++) tone[i] = (data[i * 4 + 3] ?? 0) / 255;
    image = bctx.createImageData(ow, oh);

    // Rows are broken in BANDS about one lane deep, so the patch's noise
    // lands in roughly square chunks. Per-row noise on a screen whose marks
    // are vertical lines reads as interference on the hatching, not as a
    // torn edge — the same reason the dither renderer tears in bands.
    bandRows = Math.max(2, Math.round(ow / cols));
    bands = Math.max(1, Math.ceil(oh / bandRows));
    const slots = cols * bands;
    if (holdUntil.length !== slots) {
      holdUntil = new Float64Array(slots);
      holdAmt = new Float32Array(slots);
    } else {
      holdUntil.fill(0);
    }
    holdMax = 0;

    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const bw = Math.round(viewW * dpr);
    const bh = Math.round(viewH * dpr);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    // A width/height write resets all 2D state, so both the transform and
    // the smoothing flag are re-established at paint time in render().
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  }

  function render() {
    if (!ctx || !bctx || !image || !cols || !oh) return;
    const px = image.data;
    px.fill(0);
    const lane = ow / cols;
    const maxHalf = lane * weight * 0.5;
    const minHalf = lane * floorW * 0.5;
    const litHalf = lane * litMax * 0.5;
    const litRise = (maxHalf - minHalf) * litStep;

    // The pointer is not consulted here: a segment carries whatever lift it
    // was given by layBulge until it expires, which is what lets the patch
    // outlive the cursor that made it.
    const now = performance.now();

    for (let y = 0; y < oh; y++) {
      const toneOff = y * cols;
      const rowOff = y * ow;
      for (let c = 0; c < cols; c++) {
        const v = tone[toneOff + c] ?? 0;
        if (v <= 0.02) continue;
        const centre = (c + 0.5) * lane;
        let half = minHalf + (maxHalf - minHalf) * v;
        const slot = c * bands + ((y / bandRows) | 0);
        // Climbs from the width this segment's own tone earned, capped so the
        // brightest lanes can't close into a slab.
        if (holdUntil[slot] > now) {
          half = Math.min(litHalf, half + litRise * (1 - LIT_BREAK * holdAmt[slot]));
        }
        // Hard thresholded span — no partial coverage at the ends, which is
        // what keeps edges pixel-crisp instead of feathered.
        let x0 = Math.round(centre - half);
        let x1 = Math.round(centre + half);
        if (x1 <= x0) x1 = x0 + 1; // an inked lane never vanishes entirely
        if (x0 < 0) x0 = 0;
        if (x1 > ow) x1 = ow;
        // Opaque white: this buffer is a COVERAGE MASK, not the final art.
        // Colour arrives in the tint pass below.
        for (let x = x0; x < x1; x++) {
          const i = (rowOff + x) * 4;
          px[i] = 255;
          px[i + 1] = 255;
          px[i + 2] = 255;
          px[i + 3] = 255;
        }
      }
    }

    bctx.putImageData(image, 0, 0);
    ctx.clearRect(0, 0, viewW, viewH);
    // Nearest-neighbour blow-up: this is what turns the low-res raster into
    // visible square pixels rather than a smooth gradient.
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buf, 0, 0, ow, oh, 0, 0, viewW, viewH);
    // Tint the mask through the CSS colour. source-in keeps the new paint
    // only where the mask already covers, so the theme token drives the ink
    // without this code ever having to understand the colour syntax.
    ctx.globalCompositeOperation = 'source-in';
    ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  function setImage(next: CanvasImageSource) {
    source = next;
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

  /** Pointer repaints are coalesced to one per frame — mousemove fires far
   * faster than the display refreshes. */
  /** Lays the patch around the cursor — THE PATCH RULE on this screen's own
   * unit — writing a held lift per (lane, band) instead of shading straight
   * into the paint. No falloff term; see the note at the top of the file for
   * why adding one back is exactly what turns this into a spotlight. */
  function layPatch(now: number) {
    if (pointerX < 0 || !cols || !bands) return;
    const hx = pointerX / pixel;
    const hy = pointerY / pixel;
    const lane = ow / cols;
    // One cell is a lane across and a band deep, and the two are the same
    // size by construction — see bandRows. Scaled back up by the layer's own
    // projection so the patch is the same size ON SCREEN at any depth.
    const hr = patchRadius * bandRows * projScale;
    // Jitter can push a segment's own radius out to 2r, so that is how far
    // the scan has to reach before it can reject on distance alone.
    const maxR2 = 4 * hr * hr;
    for (let c = 0; c < cols; c++) {
      const dx = (c + 0.5) * lane - hx;
      const dx2 = dx * dx;
      if (dx2 > maxR2) continue;
      for (let bi = 0; bi < bands; bi++) {
        const dy = (bi + 0.5) * bandRows - hy;
        const d2 = dx2 + dy * dy;
        if (d2 > maxR2) continue;
        const n = hash2(c, bi);
        const j = n * 2 - 1;
        const rr = hr * (1 + j);
        if (rr <= 0 || d2 > rr * rr) continue;
        const slot = c * bands + bi;
        holdAmt[slot] = 0.55 + 0.45 * ((n * 7.13) % 1);
        // Half the segments hold half as long, on their own draw — so the
        // patch frays away behind the cursor instead of lifting off whole.
        const until = now + holdMs * (Math.abs(j) > 0.5 ? 1 : 0.5);
        holdUntil[slot] = until;
        if (until > holdMax) holdMax = until;
      }
    }
  }

  function patchFrame(now: number) {
    patchRaf = 0;
    if (patchPending) {
      patchPending = false;
      layPatch(now);
    }
    // Expiry needs no sweep: render() compares each slot against the clock
    // as it paints, so this last pass past holdMax is what clears the field.
    render();
    if (now < holdMax || patchPending) patchRaf = requestAnimationFrame(patchFrame);
  }

  function schedulePatchFrame() {
    if (!patchRaf) patchRaf = requestAnimationFrame(patchFrame);
  }
  function onLeave() {
    if (pointerX < 0) return;
    pointerX = -1;
    pointerY = -1;
    // Nothing to clear by hand — held segments expire on their own tick, so
    // the patch frays out behind the cursor instead of snapping off.
    schedulePatchFrame();
  }

  /** Is there ink within `reach` rendered px of this point? The tone field
   * is already one sample per lane per row, so the question costs a box scan
   * over it and nothing else. The pointer router needs it because these
   * layers overlap as rectangles — see lib/pointer.ts. */
  function inkedNear(bx: number, by: number, reach: number) {
    if (!cols || !oh) return false;
    const lane = ow / cols;
    const cr = Math.max(1, Math.ceil(reach / lane));
    const c0 = Math.max(0, ((bx / lane) | 0) - cr);
    const c1 = Math.min(cols - 1, ((bx / lane) | 0) + cr);
    const rr = Math.max(1, Math.round(reach));
    const y0 = Math.max(0, ((by | 0) - rr));
    const y1 = Math.min(oh - 1, ((by | 0) + rr));
    for (let y = y0; y <= y1; y++) {
      const toneOff = y * cols;
      for (let c = c0; c <= c1; c++) if ((tone[toneOff + c] ?? 0) > 0.02) return true;
    }
    return false;
  }

  /* Window-routed rather than bound to the canvas: the hero's layers overlap
   * as rectangles and the browser can only hand a move to one of them. */
  const unwatchPointer = watchPointer(canvas, {
    move(x, y) {
      if (!inkedNear(x / pixel, y / pixel, patchRadius * bandRows * projScale)) {
        onLeave();
        return;
      }
      pointerX = x;
      pointerY = y;
      patchPending = true;
      schedulePatchFrame();
    },
    leave: onLeave,
  });

  return {
    setImage,
    refresh,
    destroy() {
      if (patchRaf) cancelAnimationFrame(patchRaf);
      themeObserver.disconnect();
      unwatchPointer();
    },
  };
}
