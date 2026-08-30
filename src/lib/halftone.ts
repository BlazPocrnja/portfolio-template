/**
 * DOT-SCREEN renderer — the third way a hero layer can be drawn, next to the
 * ascii mosaic in ./ascii.ts and the line screen in ./linescreen.ts.
 *
 * A fixed lattice of cells, each carrying one mark whose WEIGHT tracks local
 * tone. Where the line screen reads as engraved hatching, this reads as
 * printed ink — the same tonal trick, rotated from a 1-D cell to a 2-D one.
 *
 * Two mark vocabularies, chosen with `mark`:
 *
 *  - 'dot' — the classic halftone. One disc per cell, diameter following
 *    tone: lit areas swell until neighbours almost kiss, shadows shrink to a
 *    single pixel and then drop out entirely.
 *  - 'cross' — a stitched screen. Tone picks a GLYPH off a ramp (dot -> small
 *    x -> full x -> asterisk -> bold knot) instead of scaling one shape, so
 *    the field reads as cross-stitch or a character mosaic rather than as
 *    printed dots. The ramp is quantised on purpose: a finite alphabet of
 *    marks is the whole point, and interpolating between them would just
 *    rebuild the dot screen with extra steps.
 *
 * It inherits the line screen's two rules on purpose, for the same reasons:
 *
 * 1. Its GEOMETRY does not animate. The lattice is a fixed raster that
 *    content is seen THROUGH; it never slides or wobbles. The marks sitting
 *    on it may boil in place — see `churn` — but that is opt-in, and with it
 *    off there is no rAF loop and an idle layer costs nothing.
 *
 * 2. It does not draw arcs. Every dot is rasterised by hand into a small
 *    ImageData (a hard-thresholded span per scanline, no antialiasing) which
 *    is then blown up with smoothing OFF. ctx.arc + fill would feather every
 *    rim, and a feathered halftone dot looks airbrushed rather than printed.
 *    Hard edges and a quantised set of radii are the whole character of the
 *    process.
 */

export interface DotScreenOptions {
  /** Which mark fills a cell — a scaling disc, or a glyph off the stitch
   * ramp. See the module header. */
  mark?: 'dot' | 'cross';
  /** CSS px per rendered pixel — the upscale factor, i.e. how chunky. */
  pixel?: number;
  /** SCREEN ANGLE, in degrees — the angle of the lattice the marks sit on,
   * not of the artwork. 0 is the one angle print never uses: an upright
   * square grid of identical marks is the most visible arrangement there is,
   * and wherever a run of neighbouring cells saturates to the same heavy
   * glyph the eye stops reading tone and starts reading the grid. Turning
   * the screen breaks up those rows and columns; 45 is the classic choice
   * for a single-colour screen because the diagonal is the direction the eye
   * is least sensitive to. */
  angle?: number;
  /** Ceiling on the working buffer's longest side. The deep backdrop layers
   * are laid out enormous — the stage's perspective scales them back down,
   * but `pixel` is applied to the LAYOUT size, so a full-width panel at the
   * back of the box asks for a buffer of several thousand px a side and an
   * ImageData in the tens of MB. Past this the grain coarsens instead,
   * which is invisible: those layers are optically shrunk anyway. */
  maxSide?: number;
  /** Rendered px between dot centres. This sets how many tone steps exist
   * at all: a cell of N rendered px can only hold N/2 distinct radii, so a
   * tight pitch buys resolution at the cost of tonal range. */
  pitch?: number;
  /** 'dot' only. Peak dot diameter as a fraction of the cell. Past ~1.0
   * neighbouring dots merge into a solid field and it stops reading as
   * dots. The stitch ramp sizes its glyphs to the cell instead. */
  weight?: number;
  /** Tone at or below this drops the dot entirely, which is what keeps the
   * shadows open instead of stippled with grit. */
  cutoff?: number;
  /** Shapes tone before it becomes a radius. <1 lifts the mid-tones (more
   * ink), >1 crushes them. The material masks arrive bright, so the default
   * leans slightly toward crushing. */
  gamma?: number;
  /** Fallback ink strength when --linescreen-alpha isn't set in CSS. */
  opacity?: number;
  /** Patch radius in CELLS. In cells and not px so the patch covers the same
   * number of marks on every layer, however coarse that layer's screen is or
   * however far back the stage has pushed it — a radius in px lands a patch
   * three times the size on a near-camera layer, which is exactly how the
   * hands ended up with a hover you could not miss and the brain one you
   * could. Every mark jitters this by up to ±100%; see THE PATCH RULE. */
  patchRadius?: number;
  /** Fraction of inked cells that re-roll their mark each tick. A cell can
   * only move one step along the alphabet, since the marks are strictly
   * ordered by weight and there is no "different glyph, same density" to
   * swap to the way the ascii pools have. The step is symmetric, so the
   * field boils without the average tone drifting. 0 keeps the screen
   * static and costs nothing at all. */
  churn?: number;
  /** Which of the two dresses the patch wears. false (default) BRIGHTENS:
   * each mark climbs `litStep` rungs of its own alphabet, painted at full
   * strength over a field inked at less. true is the GLITCH, and belongs to
   * one layer: the marks become solid accent tiles with their glyph knocked
   * out of them in the page background. Everything else about the two —
   * which marks, for how long, how they churn — is the same code. */
  accent?: boolean;
  /** How many rungs of its own alphabet a brightened mark climbs, before a
   * per-pass ±1 of churn. Relative, not a target: raising it lifts the whole
   * patch, it does not flatten the picture's own light out of it. */
  litStep?: number;
  /** How long a mark the cursor touched holds what it was given before it
   * drops back, in ms — for the accent tiles and the brightened marks
   * alike. Jittered per mark, so the patch frays out behind the cursor
   * rather than lifting off in one piece. */
  holdMs?: number;
}

/* ---- stitch ramp ------------------------------------------------------
 *
 * The glyphs are BUILT, not typed. A real font's × and + are drawn for
 * baseline text, so at 5-7px they land off-centre in their cell, disagree
 * on stroke weight, and get hinted differently on every platform — the
 * lattice ends up crawling. These are plotted straight onto the cell's own
 * integer grid, which is the only way every mark shares one centre and one
 * stroke width.
 */

/** One glyph: a size x size bitmap, 1 = ink. */
type Stamp = Uint8Array;

function plot(g: Stamp, size: number, x: number, y: number) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  g[y * size + x] = 1;
}

/** Diagonal cross, arms `arm` px from centre — the stitch itself. */
function drawX(g: Stamp, size: number, arm: number) {
  const c = (size - 1) >> 1;
  for (let i = -arm; i <= arm; i++) {
    plot(g, size, c + i, c + i);
    plot(g, size, c + i, c - i);
  }
}

/** Upright cross, arms `arm` px from centre. */
function drawPlus(g: Stamp, size: number, arm: number) {
  const c = (size - 1) >> 1;
  for (let i = -arm; i <= arm; i++) {
    plot(g, size, c + i, c);
    plot(g, size, c, c + i);
  }
}

/** 4-neighbour dilation — how the heavy end of the ramp gains weight.
 * Thickening an existing glyph keeps the mark's identity (a bold × still
 * reads as ×) where drawing a separate fat shape would just look like a
 * blob interrupting the alphabet. */
function dilate(g: Stamp, size: number): Stamp {
  const out = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!g[y * size + x]) continue;
      plot(out, size, x, y);
      plot(out, size, x - 1, y);
      plot(out, size, x + 1, y);
      plot(out, size, x, y - 1);
      plot(out, size, x, y + 1);
    }
  }
  return out;
}

/** Knocks the four corner pixels back out. Dilation is what gives the heavy
 * end of the ramp its weight, but left alone it closes the cell into a solid
 * square and the lattice stops reading as marks at all — the highlights turn
 * into blocky slabs. Keeping the corners open means even the darkest cell is
 * still recognisably a fat x rather than a filled tile. */
function openCorners(g: Stamp, size: number): Stamp {
  const last = size - 1;
  g[0] = 0;
  g[last] = 0;
  g[last * size] = 0;
  g[last * size + last] = 0;
  return g;
}

/**
 * The ramp, lightest first. Ordered by ink coverage so tone can index it
 * directly, and shaped so the × dominates the middle of the range — that is
 * where most of a figure's tone lands, and it is what makes the field read
 * as stitching rather than as generic noise.
 */
function buildStitchRamp(size: number): Stamp[] {
  const arm = (size - 1) >> 1;
  const c = arm;
  const ramp: Stamp[] = [];

  const dot = new Uint8Array(size * size);
  plot(dot, size, c, c);
  ramp.push(dot);

  const tinyX = new Uint8Array(size * size);
  drawX(tinyX, size, 1);
  ramp.push(tinyX);

  const smallPlus = new Uint8Array(size * size);
  drawPlus(smallPlus, size, Math.max(1, arm - 1));
  ramp.push(smallPlus);

  const fullX = new Uint8Array(size * size);
  drawX(fullX, size, arm);
  ramp.push(fullX);

  const xPlusCentre = new Uint8Array(size * size);
  drawX(xPlusCentre, size, arm);
  drawPlus(xPlusCentre, size, 1);
  ramp.push(xPlusCentre);

  const asterisk = new Uint8Array(size * size);
  drawX(asterisk, size, arm);
  drawPlus(asterisk, size, arm);
  ramp.push(asterisk);

  ramp.push(openCorners(dilate(fullX, size), size));
  ramp.push(openCorners(dilate(asterisk, size), size));

  return ramp;
}

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



/** Backing-store cap — past 2x the extra pixels just cost fill rate. */
const MAX_DPR = 2;

/* Resolves a CSS colour string to 8-bit RGB by letting canvas parse it.
 * Only the hit flash needs this: it writes its two colours straight into a
 * buffer instead of tinting one, and present()'s single source-in fill can
 * only carry one colour. Parsing by hand is not an option — getComputedStyle
 * hands back color(srgb 0.91 0.9 0.89), i.e. 0..1 floats, and the token could
 * just as well arrive as a hex, an hsl() or a color-mix(). */
let probeCtx: CanvasRenderingContext2D | null | undefined;
function resolveColor(css: string, fallback: [number, number, number]): [number, number, number] {
  if (probeCtx === undefined) {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    probeCtx = c.getContext('2d', { willReadFrequently: true });
  }
  if (!probeCtx || !css) return fallback;
  probeCtx.clearRect(0, 0, 1, 1);
  probeCtx.fillStyle = css;
  probeCtx.fillRect(0, 0, 1, 1);
  try {
    const d = probeCtx.getImageData(0, 0, 1, 1).data;
    // fillStyle silently IGNORES an unparseable value, so a transparent
    // pixel is how "the token didn't resolve" comes back.
    if (!d[3]) return fallback;
    return [d[0], d[1], d[2]];
  } catch {
    return fallback;
  }
}

/**
 * Owns one canvas's dot-screen render.
 *
 * Same contract as createLineScreen (setImage/refresh/destroy, colour read
 * off the element's own CSS, ink strength from --linescreen-alpha) so all
 * three renderers stay swappable behind one component.
 */
/** How much a brightened mark lifts its layer's own ink strength, clamped at
 * full. 1 means it does not lift it at all: the patch paints at exactly the
 * strength the layer is already inked at, and the mark climbing its alphabet
 * carries the whole effect. That is the setting, deliberately — an alpha
 * boost on top reads as a light source shining on the box, where the climb
 * alone reads as the SCREEN itself thickening where the cursor passes, which
 * is the only kind of brightening this scene has a vocabulary for. Raise it
 * to trade the box's depth for punch; see paintHit. */
const LIT_ALPHA_GAIN = 1;

export function createDotScreen(canvas: HTMLCanvasElement, options: DotScreenOptions = {}) {
  const markKind = options.mark ?? 'dot';
  const pixelMin = Math.max(1, options.pixel ?? 2);
  const maxSide = options.maxSide ?? 1600;
  const angleRad = ((options.angle ?? 0) * Math.PI) / 180;
  const churn = Math.max(0, options.churn ?? 0);
  const pitchMin = Math.max(2, options.pitch ?? 4);
  const weight = options.weight ?? 1.05;
  const cutoff = options.cutoff ?? 0.06;
  const gamma = options.gamma ?? 1.15;
  const opacityDefault = options.opacity ?? 0.62;
  const patchRadius = options.patchRadius ?? 3.5;
  // Accent dress is stitch-only: it mirrors a cell along the glyph alphabet,
  // and a scaling disc doesn't have one.
  const accent = (options.accent ?? false) && markKind === 'cross';
  const holdMs = options.holdMs ?? 260;
  const litStep = options.litStep ?? 2;

  const ctx = canvas.getContext('2d');

  let source: CanvasImageSource | null = null;

  // Low-resolution render target: the screen is rasterised here one array
  // write per pixel, then blown up onto the visible canvas.
  const buf = document.createElement('canvas');
  const bctx = buf.getContext('2d', { willReadFrequently: true });
  let image: ImageData | null = null;

  /* The lattice is a LIST of cells rather than a rows x cols grid, because
   * once the screen is turned its cells no longer line up with the buffer's
   * rows. Parallel arrays: centre in buffer px, plus the tone under it. */
  let cellX: Float32Array = new Float32Array(0);
  let cellY: Float32Array = new Float32Array(0);
  let cellTone: Float32Array = new Float32Array(0);
  /** Per-cell offset along the alphabet: -1, 0 or +1. */
  let cellStep: Int8Array = new Int8Array(0);
  let cellCount = 0;
  /** 'cross' only: the glyph alphabet, rebuilt whenever the cell size
   * changes (the marks are plotted to fit the cell, so they cannot be
   * built once up front). */
  let ramp: Stamp[] = [];
  let stampSize = 0;
  let ow = 0;
  let oh = 0;
  /* Coarse "is there ink around here" map, one bucket per lattice cell,
   * built off the cell list so it works for a turned screen as well as an
   * upright one. It exists for pointer arbitration only: the layers overlap
   * as rectangles, so each one has to be able to say whether the cursor is
   * over its ART before it claims a move. See lib/pointer.ts. */
  let probe: Uint8Array = new Uint8Array(0);
  let probeCols = 0;
  let probeRows = 0;
  /** One stable 0..1 draw per cell, hashed off its position. Breaks the
   * hover's footprint (see HOVER_BREAK) and jitters the glitch patch's rim
   * and hold — everything that must look torn rather than drawn. */
  let cellHash: Float32Array = new Float32Array(0);
  let viewW = 0;
  let viewH = 0;
  /* How much larger this layer's LAYOUT box is than the box the viewer
     actually sees. Solved in resample(), spent in finish(). */
  let projScale = 1;
  /** Solved in resample(): `pixel` is authored in SCREEN px and scaled into
   * the element's own (projected-down) layout space there. */
  let pixel = pixelMin;
  const pitch = pitchMin;

  // Kept as the raw CSS string and handed to fillStyle rather than parsed —
  // getComputedStyle resolves the token to color(srgb 0.91 0.9 0.89), i.e.
  // 0..1 floats, so treating those numbers as 8-bit channels renders the ink
  // almost black. Let canvas parse it.
  let baseColor = 'rgb(220,220,220)';
  let opacity = opacityDefault;

  let pointerX = -1;
  let pointerY = -1;

  /* ---- patch state ----------------------------------------------------
   * A SECOND low-res buffer, blown up over the tinted base. It carries real
   * RGBA rather than coverage, because the tint pass in present() can only
   * apply one colour and the patch needs its own: two at once for the accent
   * dress (tile plus knocked-out glyph), and full-strength ink for the
   * brightening one, over a field deliberately inked at less. Sparse:
   * nothing but patched cells is ever written into it, and a cell is wiped
   * the moment it expires, so the layer costs the size of the patch rather
   * than the size of the field — which is also why the base buffer is never
   * touched by the pointer at all. */
  const hitBuf = document.createElement('canvas');
  const hitCtx = hitBuf.getContext('2d');
  let hitImage: ImageData | null = null;
  /** cell index -> timestamp (ms) the flash drops at. */
  const hits = new Map<number, number>();
  /** cell index -> which mark off `ramp` the flashed cell is showing. */
  const hitGlyphs = new Map<number, number>();
  let hitRaf = 0;
  /** Set by mousemove. The patch is only re-laid when the pointer actually
   * moved, so a parked cursor decays instead of strobing in place. */
  let hitPending = false;
  let hitBgRgb: [number, number, number] = [255, 59, 20];
  let hitFgRgb: [number, number, number] = [0, 0, 0];
  /** The layer's own ink, resolved to bytes — what the brightening dress
   * paints its marks in. */
  let baseRgb: [number, number, number] = [220, 220, 220];

  function readColors() {
    const cs = getComputedStyle(canvas);
    baseColor = cs.color || 'rgb(220,220,220)';
    // Shared with the line screen: one ink-strength knob per theme, because
    // a value that keeps bone dots from blowing out on the dark stage leaves
    // dark dots nearly invisible on the light one.
    const v = parseFloat(cs.getPropertyValue('--linescreen-alpha'));
    opacity = Number.isFinite(v) ? v : opacityDefault;
    if (accent) {
      // The same two tokens the ascii mosaic reads, so one CSS rule dresses
      // the glitch wherever it shows up.
      hitBgRgb = resolveColor(cs.getPropertyValue('--ascii-hit-bg').trim(), hitBgRgb);
      hitFgRgb = resolveColor(cs.getPropertyValue('--ascii-hit-fg').trim(), hitFgRgb);
    } else {
      baseRgb = resolveColor(baseColor, baseRgb);
    }
  }

  /** Resamples the source into the tone field. Only needed when the box
   * size changes, not on every repaint. */
  function resample(): boolean {
    if (!bctx || !source) return false;
    viewW = canvas.clientWidth;
    viewH = canvas.clientHeight;
    if (!viewW || !viewH) return false;

    // Grain is held constant in SCREEN px, not layout px. Every hero layer is
    // laid out oversized and scaled back down by the stage's perspective, by
    // a factor that differs per layer — so a pitch applied to the layout box
    // lands at a different physical mark size on every one of them, and the
    // deeper the layer the finer its marks get. The brain sits at 2.1x, which
    // shrank a 6px cell to under 3px on screen and mashed the whole alphabet
    // into illegible specks. A halftone screen is a property of the PRINT:
    // the same cell size everywhere on the final surface.
    const projected = canvas.getBoundingClientRect().width;
    projScale = projected > 0 ? viewW / projected : 1;
    // Only `pixel` carries the correction. A cell measures pixel * pitch CSS
    // px, so scaling BOTH would compensate twice over — which is exactly how
    // the first attempt landed 12px cells where it wanted 6. Leaving `pitch`
    // alone also keeps a cell the same number of RENDERED px, so the glyph
    // stamps keep their internal resolution no matter how deep the layer is.
    // Coarsen further if that still asks for more buffer than it is worth.
    pixel = Math.max(pixelMin * projScale, Math.max(viewW, viewH) / maxSide);
    ow = Math.max(2, Math.round(viewW / pixel));
    oh = Math.max(2, Math.round(viewH / pixel));

    if (buf.width !== ow || buf.height !== oh) {
      buf.width = ow;
      buf.height = oh;
    }
    bctx.clearRect(0, 0, ow, oh);
    bctx.imageSmoothingEnabled = true;
    /* An UPRIGHT screen's cells line up with the buffer's own rows, so the
     * lattice can be sampled the cheap and accurate way: draw the source
     * straight down to one pixel per cell and let canvas's area filter do
     * the averaging. A TURNED screen samples at positions that fall between
     * those rows, so there is no downscale that would land on them and the
     * per-cell averaging has to be done by hand below.
     *
     * Both paths fill the same cell list, so render() never has to care.
     * Keeping the upright path is not just an optimisation: canvas's filter
     * is a better estimator than a hand-rolled box average, and swapping it
     * out visibly softened the lattice even at 0deg — measured as a drop
     * from 5.83 to 4.00 in axis-aligned lattice energy on the same crop. */
    const upright = angleRad === 0;
    let field: Uint8Array | null = null;
    let gridData: Uint8ClampedArray | null = null;
    let cols = 0;
    let rows = 0;
    if (upright) {
      cols = Math.max(2, Math.round(ow / pitch));
      rows = Math.max(2, Math.round(oh / pitch));
      bctx.drawImage(source, 0, 0, cols, rows);
      try {
        gridData = bctx.getImageData(0, 0, cols, rows).data;
      } catch {
        return false;
      }
      bctx.clearRect(0, 0, ow, oh);
    } else {
      bctx.drawImage(source, 0, 0, ow, oh);
      let data: Uint8ClampedArray;
      try {
        data = bctx.getImageData(0, 0, ow, oh).data;
      } catch {
        // Tainted canvas (cross-origin source without CORS).
        return false;
      }
      field = new Uint8Array(ow * oh);
      for (let i = 0; i < ow * oh; i++) field[i] = data[i * 4 + 3] ?? 0;
    }
    image = bctx.createImageData(ow, oh);
    // Every cell index is about to be rebuilt, so anything still held now
    // points at a cell that no longer exists.
    hits.clear();
    hitGlyphs.clear();
    if (hitBuf.width !== ow || hitBuf.height !== oh) {
      hitBuf.width = ow;
      hitBuf.height = oh;
    }
    hitImage = bctx.createImageData(ow, oh);

    if (markKind === 'cross') {
      /* Stamp size follows the lattice's PACKING, not the pitch alone. The
       * stamps are axis-aligned squares, so two neighbours stay apart only
       * if they clear each other on one axis or the other — i.e. side <=
       * pitch * max(|cos|, |sin|). Straight up that is just the pitch, but
       * turn the screen toward 45deg and the four nearest neighbours all
       * close in diagonally: at 45deg they sit 0.707 * pitch apart on BOTH
       * axes, a 5px stamp on a 6px pitch overlaps every neighbour, and the
       * marks fuse into chunky blobs instead of reading as separate glyphs.
       * Deriving the size here means no angle can silently do that again.
       * Odd, so the glyph has a true centre pixel to hang its arms off — an
       * even cell splits the centre across two rows and every mark in the
       * alphabet comes out lopsided. */
      const room = pitch * Math.max(Math.abs(Math.cos(angleRad)), Math.abs(Math.sin(angleRad)));
      const fit = Math.max(3, Math.floor(room));
      const next = fit % 2 === 1 ? fit : fit - 1;
      if (next !== stampSize) {
        stampSize = next;
        ramp = buildStitchRamp(stampSize);
      }
    }

    /* ---- lay the screen ------------------------------------------------
     * Cell centres walk two rotated basis vectors from the buffer's middle.
     * Index ranges come from projecting the four corners onto those axes, so
     * the lattice covers the buffer whatever the angle, with a one-cell
     * margin for marks that straddle an edge. */
    if (upright && gridData) {
      // Centres spread across the buffer exactly as the pre-angle renderer
      // laid them: cellW is ow/cols, which is fractional, so the rounding
      // wobble that gives is part of the look being reproduced.
      const cellW = ow / cols;
      const cellH = oh / rows;
      const cap = cols * rows;
      if (cellX.length < cap) {
        cellX = new Float32Array(cap);
        cellY = new Float32Array(cap);
        cellTone = new Float32Array(cap);
        cellStep = new Int8Array(cap);
      }
      cellCount = 0;
      for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {
          cellX[cellCount] = (cx + 0.5) * cellW;
          cellY[cellCount] = (cy + 0.5) * cellH;
          cellTone[cellCount] = (gridData[(cy * cols + cx) * 4 + 3] ?? 0) / 255;
          cellCount++;
        }
      }
      return finish();
    }

    const cs = Math.cos(angleRad);
    const sn = Math.sin(angleRad);
    const ox = ow / 2;
    const oy = oh / 2;
    let iMin = Infinity, iMax = -Infinity, jMin = Infinity, jMax = -Infinity;
    for (const [px0, py0] of [[0, 0], [ow, 0], [0, oh], [ow, oh]] as const) {
      const dx = px0 - ox;
      const dy = py0 - oy;
      const i = (dx * cs + dy * sn) / pitch;
      const j = (-dx * sn + dy * cs) / pitch;
      if (i < iMin) iMin = i;
      if (i > iMax) iMax = i;
      if (j < jMin) jMin = j;
      if (j > jMax) jMax = j;
    }
    const i0 = Math.floor(iMin) - 1, i1 = Math.ceil(iMax) + 1;
    const j0 = Math.floor(jMin) - 1, j1 = Math.ceil(jMax) + 1;
    const cap = (i1 - i0 + 1) * (j1 - j0 + 1);
    if (cellX.length < cap) {
      cellX = new Float32Array(cap);
      cellY = new Float32Array(cap);
      cellTone = new Float32Array(cap);
      cellStep = new Int8Array(cap);
    }
    // The box averaged per cell must cover exactly ONE cell's worth of
    // artwork. An earlier version used a half-width of pitch/2, which makes
    // a (pitch+1)-square box — 36% too much area, so neighbouring boxes
    // overlap, every sparse ink mark gets counted by several cells at once,
    // and thin artwork (the frieze, the far range) came out markedly
    // heavier than it had been. Axis-aligned even when the screen is
    // turned: the box only has to gather a cell's worth, and matching it to
    // the rotated basis buys nothing visible for a lot more arithmetic.
    const boxSide = Math.max(1, Math.round(pitch));
    const boxHalf = boxSide >> 1;
    const src = field;
    if (!src) return false;
    cellCount = 0;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const x = ox + (i * cs - j * sn) * pitch;
        const y = oy + (i * sn + j * cs) * pitch;
        if (x < -pitch || y < -pitch || x > ow + pitch || y > oh + pitch) continue;
        const bx = Math.round(x);
        const by = Math.round(y);
        let sum = 0;
        let n = 0;
        const yA = Math.max(0, by - boxHalf), yB = Math.min(oh - 1, yA + boxSide - 1);
        const xA = Math.max(0, bx - boxHalf), xB = Math.min(ow - 1, xA + boxSide - 1);
        for (let sy = yA; sy <= yB; sy++) {
          const rowOff = sy * ow;
          for (let sx = xA; sx <= xB; sx++) {
            sum += src[rowOff + sx];
            n++;
          }
        }
        if (!n) continue;
        cellX[cellCount] = x;
        cellY[cellCount] = y;
        cellTone[cellCount] = sum / n / 255;
        cellCount++;
      }
    }

    return finish();
  }

  /** One pass over the finished cell list for the two things every cell
   * needs and the lattice loops don't produce: its noise draw, and the ink
   * probe (one byte per cell-sized bucket, for pointer arbitration). */
  function indexCells() {
    probeCols = Math.max(1, Math.ceil(ow / pitch));
    probeRows = Math.max(1, Math.ceil(oh / pitch));
    const n = probeCols * probeRows;
    if (probe.length !== n) probe = new Uint8Array(n);
    else probe.fill(0);
    if (cellHash.length < cellCount) cellHash = new Float32Array(cellCount);
    for (let c = 0; c < cellCount; c++) {
      cellHash[c] = hash2(Math.round(cellX[c]), Math.round(cellY[c]));
      if (cellTone[c] <= cutoff) continue;
      const px = Math.min(probeCols - 1, Math.max(0, (cellX[c] / pitch) | 0));
      const py = Math.min(probeRows - 1, Math.max(0, (cellY[c] / pitch) | 0));
      probe[py * probeCols + px] = 1;
    }
  }

  /** Is there ink within `reach` buffer px of this point? The question the
   * pointer router actually needs answered — not "is this exact cell inked"
   * but "would the cursor do anything here", which for a sparse dithered
   * subject like the brain is a far more forgiving (and more truthful) test
   * than sampling a single cell through the gaps in its own stipple. */
  function inkedNear(bx: number, by: number, reach: number) {
    if (!probeCols) return false;
    const rad = Math.max(1, Math.ceil(reach / pitch));
    const cx = (bx / pitch) | 0;
    const cy = (by / pitch) | 0;
    const y0 = Math.max(0, cy - rad), y1 = Math.min(probeRows - 1, cy + rad);
    const x0 = Math.max(0, cx - rad), x1 = Math.min(probeCols - 1, cx + rad);
    for (let y = y0; y <= y1; y++) {
      const rowOff = y * probeCols;
      for (let x = x0; x <= x1; x++) if (probe[rowOff + x]) return true;
    }
    return false;
  }

  /** Backing store + transform, once whichever lattice path has run. */
  function finish(): boolean {
    indexCells();
    /* Sized against what the viewer SEES, not against the layout box. Every
       hero layer is laid out oversized and scaled back down by the stage's
       perspective, so a store sized in layout px holds projScale device
       pixels for every one the screen can show — 2.2x on the deep layers,
       which is 5x the memory for no visible difference. Dividing it out
       renders at exactly screen resolution.
       This is also what keeps a wide layer legal: the sky spans multiples
       of the stage's width, and at layout resolution its store ran past the
       ~16k-px side limit a canvas has, where the browser hands back a blank
       one rather than an error. */
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR) / Math.max(1, projScale);
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

  /** Half-extent of the block one cell can touch, in buffer px. Used to
   * wipe a single cell before repainting it during a churn tick. */
  function cellReach(maxR: number) {
    // A lit mark tops out at the alphabet's own maximum, so nothing reaches
    // further than an ordinary full-tone one.
    return markKind === 'cross' ? (stampSize >> 1) + 1 : Math.ceil(maxR) + 2;
  }

  /** Paints one glyph from the ramp with its centre on the cell's. Defaults
   * to opaque white into the coverage mask — the base field's only caller —
   * but the hit layer stamps its knocked-out glyph through here too, in a
   * real colour and into its own buffer. */
  function stampInto(
    g: Stamp,
    ax: number,
    ay: number,
    target: ImageData | null = image,
    cr = 255,
    cg = 255,
    cb = 255,
    ca = 255
  ) {
    if (!target) return;
    const px = target.data;
    const x0 = ax - (stampSize >> 1);
    const y0 = ay - (stampSize >> 1);
    for (let sy = 0; sy < stampSize; sy++) {
      const y = y0 + sy;
      if (y < 0 || y >= oh) continue;
      const rowOff = y * ow;
      const stampOff = sy * stampSize;
      for (let sx = 0; sx < stampSize; sx++) {
        if (!g[stampOff + sx]) continue;
        const x = x0 + sx;
        if (x < 0 || x >= ow) continue;
        const i = (rowOff + x) * 4;
        px[i] = cr;
        px[i + 1] = cg;
        px[i + 2] = cb;
        px[i + 3] = ca;
      }
    }
  }

  /** Blanks the block a cell occupies, so it can be repainted in isolation.
   * Safe because the stamp size is derived from the lattice packing — no
   * cell's block can reach into a neighbour's. */
  function clearCell(c: number, reach: number) {
    if (!image) return;
    const px = image.data;
    const bx = Math.round(cellX[c]);
    const by = Math.round(cellY[c]);
    const y0 = Math.max(0, by - reach), y1 = Math.min(oh - 1, by + reach);
    const x0 = Math.max(0, bx - reach), x1 = Math.min(ow - 1, bx + reach);
    for (let y = y0; y <= y1; y++) {
      const rowOff = y * ow;
      for (let x = x0; x <= x1; x++) px[(rowOff + x) * 4 + 3] = 0;
    }
  }

  /** Paints one cell into the buffer. Split out of render() so a churn tick
   * can repaint just the cells that moved instead of the whole field. */
  function paintCell(c: number, maxR: number, levels: number) {
    if (!image) return;
    const px = image.data;
    const v = cellTone[c];
    if (v <= cutoff) return;
    const centreX = cellX[c];
    const centreY = cellY[c];
    const baseX = Math.round(centreX);
    const baseY = Math.round(centreY);

    // Shared 0..1 ink amount. Both vocabularies read it the same way — one
    // scales a radius by it, the other indexes an alphabet with it — so the
    // tone curve behaves identically whichever mark is in use. The pointer
    // does not appear here at all: the patch lives entirely in its own
    // buffer, over the top.
    const ink = Math.pow(v, gamma);

    if (markKind === 'cross') {
      if (!levels) return;
      const idx = Math.min(levels - 1, Math.max(0, Math.round(ink * (levels - 1)) + cellStep[c]));
      stampInto(ramp[idx], baseX, baseY);
      return;
    }

    // Radii quantise to whole rendered pixels: a printed screen has a finite
    // set of dot sizes, and rounding here is what produces that stepping
    // instead of a continuous swell.
    const rr = Math.round(maxR * ink) + cellStep[c];
    if (rr < 1) {
      // The smallest mark a screen can make is one pixel. Below that it has
      // to drop out rather than fade — that is what `cutoff` is for.
      if (baseX >= 0 && baseX < ow && baseY >= 0 && baseY < oh) {
        const i = (baseY * ow + baseX) * 4;
        px[i] = 255;
        px[i + 1] = 255;
        px[i + 2] = 255;
        px[i + 3] = 255;
      }
      return;
    }
    // +0.35 rounds the rim out to a disc; on the integer lattice a bare
    // radius squared cuts the corners off into a diamond.
    const r2 = (rr + 0.35) * (rr + 0.35);
    const y0 = Math.max(0, baseY - rr);
    const y1 = Math.min(oh - 1, baseY + rr);
    for (let y = y0; y <= y1; y++) {
      const dy = y - baseY;
      const span = Math.floor(Math.sqrt(Math.max(0, r2 - dy * dy)));
      let x0 = baseX - span;
      let x1 = baseX + span;
      if (x0 < 0) x0 = 0;
      if (x1 > ow - 1) x1 = ow - 1;
      const rowOff = y * ow;
      // Opaque white: this buffer is a COVERAGE MASK, not the final art.
      // Colour arrives in the tint pass in present().
      for (let x = x0; x <= x1; x++) {
        const i = (rowOff + x) * 4;
        px[i] = 255;
        px[i + 1] = 255;
        px[i + 2] = 255;
        px[i + 3] = 255;
      }
    }
  }

  /* ---- the patch ------------------------------------------------------
   *
   * One implementation, both dresses. See THE PATCH RULE at the top of the
   * file; `accent` is the only thing that branches, and only over colour.
   */

  /** The tile a flashed cell fills, in buffer px. One PITCH square, not the
   * stamp's own footprint: the whole point of the effect is contiguous
   * blocks of colour, so the tiles have to meet edge to edge the way the
   * ascii mosaic's cell fills do. Sized for an upright screen — turn the
   * lattice and neighbouring tiles overlap, harmlessly, since they are
   * opaque and identical. */
  function hitTile(c: number) {
    const side = Math.max(1, Math.round(pitch));
    const off = side >> 1;
    const bx = Math.round(cellX[c]) - off;
    const by = Math.round(cellY[c]) - off;
    return {
      x0: Math.max(0, bx),
      x1: Math.min(ow - 1, bx + side - 1),
      y0: Math.max(0, by),
      y1: Math.min(oh - 1, by + side - 1),
    };
  }

  /** Per-cell edge jitter in -1..1, off the cell's own stable draw — a cell
   * keeps its place in the patch's ragged rim on every pass of the cursor,
   * which is what makes the shape read as a torn hole rather than as
   * static. */
  function cellJitter(c: number) {
    return cellHash[c] * 2 - 1;
  }

  /** Is this cell in the pointer's patch, and how hard? 0 means outside.
   * See THE PATCH RULE at the top of the file: binary membership against the
   * cell's own jittered radius, then a decorrelated per-cell strength. The
   * membership and the ink probe both go through here, which is the only
   * way every layer stays the same gesture. `r` is in buffer px. */
  function patchAmount(c: number, hx: number, hy: number, r: number) {
    const dx = cellX[c] - hx;
    const dy = cellY[c] - hy;
    const d2 = dx * dx + dy * dy;
    // Jitter can push a cell's own radius out to 2r, so that is how far the
    // test has to reach before it can reject on distance alone.
    if (d2 > 4 * r * r) return 0;
    const n = cellHash[c];
    const rr = r * (1 + (n * 2 - 1));
    if (rr <= 0 || d2 > rr * rr) return 0;
    return 0.55 + 0.45 * ((n * 7.13) % 1);
  }

  /** The patched cell's mark, re-rolled on every pass so the patch churns
   * under a moving cursor rather than sitting still.
   *
   * Accent: the cell's DENSITY MIRROR off the ramp, plus a step of noise —
   * what the ascii ripple does, a light cell flashing heavy and a heavy one
   * light, which is why that patch reads as the image inverting inside it
   * rather than merely being tinted.
   *
   * Brightening: `litStep` rungs UP FROM WHERE THE MARK ALREADY WAS, so a
   * shadow comes up as a shadow and only the highlights reach the top of the
   * ramp — the picture's own light survives inside the patch instead of
   * being flattened out of it. See THE PATCH RULE on why this is safe and
   * the distance term is not. */
  function rollHitGlyph(c: number, levels: number) {
    const base = Math.min(levels - 1, Math.max(0, Math.round(Math.pow(cellTone[c], gamma) * (levels - 1))));
    if (!accent) {
      return Math.min(levels - 1, base + litStep + ((Math.random() * 2) | 0));
    }
    const mirror = levels - 1 - base;
    return Math.min(levels - 1, Math.max(0, mirror + ((Math.random() * 3) | 0) - 1));
  }

  /** Draws one patched cell in whichever dress this layer wears: a solid
   * accent tile with the glyph knocked out of it in the page background, or
   * the bare glyph in the layer's own ink at full strength. The mark is the
   * same either way — the tile is the only extra. */
  function paintHit(c: number) {
    if (!hitImage || !ramp.length) return;
    if (accent) {
      const px = hitImage.data;
      const t = hitTile(c);
      for (let y = t.y0; y <= t.y1; y++) {
        const rowOff = y * ow;
        for (let x = t.x0; x <= t.x1; x++) {
          const i = (rowOff + x) * 4;
          px[i] = hitBgRgb[0];
          px[i + 1] = hitBgRgb[1];
          px[i + 2] = hitBgRgb[2];
          px[i + 3] = 255;
        }
      }
    }
    const g = ramp[hitGlyphs.get(c) ?? 0];
    if (!g) return;
    // The brightening dress paints at THIS LAYER'S OWN ink strength. The hit
    // buffer is composited over the tinted base at globalAlpha 1, so painting
    // at 255 overrides the per-layer `ink` that sets the scene's depth — and
    // the layer it flattered most was the one that could least afford it: the
    // far mountains are laid in at 0.24 precisely so they read as distance,
    // and a patch of full-strength marks on them came back as bright white
    // chunks floating behind the scene. Matching the layer instead keeps
    // every patch inside its own plane in the box; the mark climbing its
    // alphabet is what makes it visible, and on a distant range that is
    // correctly a whisper. The accent dress is exempt: it is one layer, and
    // being unmissable is its whole job.
    const ink = accent ? hitFgRgb : baseRgb;
    const alpha = accent ? 255 : Math.round(255 * Math.min(1, opacity * LIT_ALPHA_GAIN));
    stampInto(g, Math.round(cellX[c]), Math.round(cellY[c]), hitImage, ink[0], ink[1], ink[2], alpha);
  }

  function clearHit(c: number) {
    if (!hitImage) return;
    const px = hitImage.data;
    const t = hitTile(c);
    for (let y = t.y0; y <= t.y1; y++) {
      const rowOff = y * ow;
      for (let x = t.x0; x <= t.x1; x++) px[(rowOff + x) * 4 + 3] = 0;
    }
  }

  /** Lays the patch around the cursor. Two things keep it from being a
   * spotlight: only cells the artwork actually inked can flash, so the patch
   * is clipped to the silhouette and never spills onto bare stage; and every
   * cell tests against its OWN jittered radius, so the rim dissolves cell by
   * cell instead of describing a circle. */
  function layHits(now: number) {
    if (!hitImage || pointerX < 0 || !cellCount || !ramp.length) return false;
    const hx = pointerX / pixel;
    const hy = pointerY / pixel;
    const r = patchRadius * pitch;
    const levels = ramp.length;
    let touched = false;
    for (let c = 0; c < cellCount; c++) {
      if (cellTone[c] <= cutoff) continue;
      if (!patchAmount(c, hx, hy, r)) continue;
      const j = cellJitter(c);
      // Re-rolled on every pass, so the marks inside the colour keep
      // changing for as long as the cursor is moving. The hold is jittered
      // too, so the patch frays as it decays rather than lifting all at once.
      hitGlyphs.set(c, rollHitGlyph(c, levels));
      hits.set(c, now + holdMs * (Math.abs(j) > 0.5 ? 1 : 0.5));
      paintHit(c);
      touched = true;
    }
    return touched;
  }

  function hitFrame(now: number) {
    hitRaf = 0;
    let changed = false;
    for (const [c, until] of hits) {
      if (now >= until) {
        hits.delete(c);
        hitGlyphs.delete(c);
        clearHit(c);
        changed = true;
      }
    }
    if (hitPending) {
      hitPending = false;
      if (layHits(now)) changed = true;
    }
    if (changed) present();
    // Keep ticking while anything is still holding, so a cursor that stops
    // (or leaves) still gets its patch expired instead of frozen on screen.
    if (hits.size || hitPending) hitRaf = requestAnimationFrame(hitFrame);
  }

  function scheduleHitFrame() {
    if (!hitRaf) hitRaf = requestAnimationFrame(hitFrame);
  }

  function render() {
    if (!ctx || !bctx || !image || !cellCount) return;
    image.data.fill(0);
    const maxR = pitch * weight * 0.5;
    const levels = ramp.length;
    for (let c = 0; c < cellCount; c++) paintCell(c, maxR, levels);
    present();
  }

  /** Buffer -> canvas, tinted. The only part a churn tick has to repeat in
   * full; the painting above it can be done for just the cells that moved. */
  function present() {
    if (!ctx || !bctx || !image) return;
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
    // The flash goes on last and at full strength, over the ink rather than
    // through the tint — it already carries its own two colours, and
    // thinning it by the layer's ink alpha would sand the hit back into the
    // field it is meant to punch a hole in.
    if (hitImage && hitCtx && hits.size) {
      hitCtx.putImageData(hitImage, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(hitBuf, 0, 0, ow, oh, 0, 0, viewW, viewH);
    }
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

  function onLeave() {
    if (pointerX < 0) return;
    pointerX = -1;
    pointerY = -1;
    // Nothing to clear by hand — held marks expire on their own tick, so the
    // patch frays out behind the cursor instead of snapping off.
    scheduleHitFrame();
  }

  /* Window-routed rather than bound to the canvas: these layers overlap as
   * rectangles and the browser can only deliver a move to one of them. The
   * coordinates arrive in this element's own layout space, which is what
   * offsetX used to give us. See lib/pointer.ts. */
  const unwatchPointer = watchPointer(canvas, {
    move(x, y) {
      // Claim the cursor only where this layer has something to say. Without
      // it a wide, mostly-empty backdrop panel answers for every layer
      // behind it.
      if (!inkedNear(x / pixel, y / pixel, patchRadius * pitch)) {
        onLeave();
        return;
      }
      pointerX = x;
      pointerY = y;
      // No base repaint: the patch lives in its own buffer, so a move only
      // has to redraw the patch and re-composite.
      hitPending = true;
      scheduleHitFrame();
    },
    leave: onLeave,
  });

  /* ---- churn ----------------------------------------------------------
   * The module used to say flatly that it does not animate, on the grounds
   * that a screen is a fixed raster content is seen THROUGH. That holds for
   * the screen's GEOMETRY — the lattice never moves — but the marks sitting
   * on it can still boil, and that is what this does.
   *
   * Every tick re-rolls a share of cells one step along the alphabet. Two
   * things scale with `churn`, which is what makes depth read: how MANY
   * cells re-roll per tick, and how OFTEN a tick happens. A near layer
   * churns fast and hard; a far one drifts. The tick rate matters as much as
   * the amount here, because a repaint rewrites the whole buffer — running
   * every layer at 60fps would spend most of a frame on backdrops nobody is
   * looking at.
   */
  const tickMs = churn > 0 ? 1000 / (4 + churn * 100) : 0;
  // Share of re-rolled cells that actually step off their true tone. Scaled
  // so a distant layer is subtler in AMPLITUDE too, not merely slower: left
  // fixed, every layer would drift to the same noise floor and only the
  // speed would differ.
  const stepChance = Math.min(0.6, churn * 5);
  let churnRaf = 0;
  let lastTick = 0;
  function churnFrame(now: number) {
    churnRaf = requestAnimationFrame(churnFrame);
    if (!cellCount || now - lastTick < tickMs) return;
    lastTick = now;
    const n = Math.max(1, Math.round(cellCount * churn));
    const maxR = pitch * weight * 0.5;
    const levels = ramp.length;
    const reach = cellReach(maxR);
    let moved = 0;
    for (let k = 0; k < n; k++) {
      const c = (Math.random() * cellCount) | 0;
      const r = Math.random();
      // Symmetric, so the field boils without the average tone drifting.
      const next = r < stepChance * 0.5 ? -1 : r < stepChance ? 1 : 0;
      if (next === cellStep[c]) continue;
      cellStep[c] = next;
      /* Wipe and repaint this cell alone. Redrawing the whole field every
         tick was costing about as much as the rest of the page put together
         — the buffer fill and the re-stamp are proportional to the LAYER,
         where this is proportional to what actually changed. */
      clearCell(c, reach);
      paintCell(c, maxR, levels);
      moved++;
    }
    if (moved) present();
  }
  if (churn > 0) churnRaf = requestAnimationFrame(churnFrame);

  return {
    setImage,
    refresh,
    destroy() {
      if (hitRaf) cancelAnimationFrame(hitRaf);
      if (churnRaf) cancelAnimationFrame(churnRaf);
      themeObserver.disconnect();
      unwatchPointer();
    },
  };
}
