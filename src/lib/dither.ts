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
 * ATLASES
 *
 * A layer's art can be a SHEET of stills rather than one picture, and the
 * scene can step through them (setFrame) — which is how the devil breathes
 * fire and the cockatrice beats its wings as the dolly closes on them; see
 * THE FLYBY in Hero.tsx. Nothing here
 * knows that: a frame is just a source rect, so `sourceW`/`sourceH` describe
 * one cell and everything below goes on treating that as the whole picture.
 * A step costs one rasterise — the plate and its coverage field are both
 * derived from pixels that just changed — so the caller is expected to work
 * in whole frames and not to scrub.
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
 * can be moved and dropped. In a patch around the cursor the image is
 * resampled through a horizontal TEAR (rows band together and slide, the
 * way a broken scanout looks) while ink DROPS OUT and SPILLS into its
 * neighbours at random, so the stipple boils in place. Both are driven off
 * the pointer position rather than a clock, so the effect animates while the
 * mouse moves and costs exactly nothing when it stops — same bargain the
 * line screen makes.
 *
 * The patch is a TORN piece of the plate, not a disc: see THE PATCH RULE
 * below, which is the same rule the dot screen's cursor obeys.
 *
 * THE FRAY
 *
 * Optionally the plate does not hold together everywhere: where it thins,
 * it comes apart. Local ink DENSITY is the whole signal — below a given
 * coverage the stipple starts dropping dots, and across that same thinning
 * band loose pixel MARKS are scattered (x, +, a hollow square, a dot — the
 * vocabulary the sky is drawn in), each carrying a dim one-pixel halo so it
 * blooms at the size the buffer is blown up to. The picture reads as
 * something transmitted rather than printed: solid where the light is,
 * granular where it falls off, leaking a few pixels into the dark.
 *
 * The marks are not stuck there. Each lattice cell runs a particle on its
 * own clock: born in the thinning band, rising, drifting a little sideways,
 * stepping DOWN the alphabet as it goes — a hollow square becomes an x,
 * then a single pixel, then nothing — and starting again on a fresh roll,
 * so the field churns instead of looping. Nothing is stored between frames:
 * a particle's whole life is a function of its cell and the clock, which is
 * what lets thousands of them run with no state at all.
 * They STEP rather than glide. The tick is deliberately slower than the
 * display, the marks live on the buffer's pixel grid, and the sky's stars
 * twinkle in hard cuts for the same reason — smooth motion would be the one
 * thing here that looked rendered rather than transmitted.
 *
 * Distance thins it twice over: the band narrows AND the marks stop firing
 * (see EMIT_CURVE). One without the other gives a far plate a fringe that is
 * merely tighter rather than quieter, which still competes for attention
 * with whatever is near the camera.
 *
 * DENSITY, not distance from an outline. The first version measured a band
 * inward from the silhouette, which is the obvious reading of "fray the
 * edges" and is wrong for this art: these plates are photographic dithers,
 * where dot density carries tone and the shadow side of a hand has no
 * outline at all — it thins to nothing. A distance field taken from a
 * thresholded shape found an edge around every shadow and freckled the
 * whole picture. Coverage finds the real margins, and on art that IS a
 * solid shape it degenerates to an outline band anyway.
 */

export interface DitherOptions {
  /** Cap on the working buffer's longest side. The source is used at its own
   * resolution below this; past it there is more art than any screen can
   * show and the extra pixels are pure fill rate. */
  maxSide?: number;
  /** Glitch radius in SCREEN px — what the viewer sees, not what the layer
   * is laid out at. Every hero layer is laid out oversized and scaled back
   * down by the stage's perspective, so the two differ by a factor that is
   * different on every layer (1.1x at the hands, 2.7x at the brain); the
   * projection is divided out in aimPatch, exactly as `pixel` divides it out
   * for the dot screen's grain.
   *
   * SCREEN px and not a fraction of the art, which is what this was. A
   * fraction keeps the patch constant relative to the PICTURE, so a layer
   * laid out large gets a large patch — 0.16 of the art landed 118 screen px
   * on the hands against the clouds' 18, and the two effects stopped reading
   * as the same cursor. What the eye is comparing across layers is how much
   * of the SCREEN the cursor disturbs, so that is the thing to hold still.
   * The dot screen's cursor works out to 18 (3 cells of pitch 6); this sits
   * deliberately close to it.
   *
   * NOMINAL, not a boundary — the rim is jittered per block, so this is the
   * radius at which about half the plate is still being torn. */
  radiusPx?: number;
  /** Peak row displacement, as a fraction of the PATCH radius. Relative to
   * the patch and not to the art: a shear measured against the picture is a
   * fixed number of px whatever the patch is doing, so shrinking the patch
   * left the tear dragging in content from well outside it — which reads as
   * a hole showing somewhere else, not as a plate tearing. */
  tear?: number;
  /** Share of the patch's ink that drops out, 0..1. */
  dropout?: number;
  /** Chance that an EMPTY pixel in the patch picks up ink displaced from its
   * surroundings. Dropout alone only ever erases, which reads as a hole
   * being rubbed in the art; pairing it with spill makes the stipple churn
   * in place instead — the same "comes apart and reassembles" read as the
   * ascii mosaic's ripple.
   *
   * Weighted toward dropout, which nets the patch slightly DARKER than the
   * plate around it. Tried the other way round once — spill over dropout, so
   * the patch gains ink and comes up the way the dot screen's cursor does —
   * and it was the wrong read for this renderer: these are 1-bit plates, and
   * ink added to them thickens the stipple rather than lighting it, so the
   * patch read as a blot instead of as a flash. What carries the effect here
   * is the plate coming APART. */
  spill?: number;
  /** Rows per tear band. 1 shears every row independently (reads as noise);
   * a few rows at a time is what reads as a torn scanout. */
  band?: number;
  /** Fallback ink strength when --linescreen-alpha isn't set in CSS. */
  opacity?: number;
  /** Coverage, 0..1, below which the plate is treated as thin and starts
   * coming apart — measured on a blur of the ink, so it is local density
   * rather than any one dot. Higher eats further into the lit areas. 0
   * leaves the plate whole.
   * Scaled at render time by the `data-near` the scroll dolly writes on the
   * layer's box, so the same authored value reads as a whisper at the back
   * of the scene and as real disintegration at the camera. */
  fray?: number;
  /** Non-zero runs the fray as a particle field — marks rising, churning,
   * dying and re-rolling. Zero freezes it, which is what a scene with
   * prefers-reduced-motion hands down. The magnitude is not read: the rate
   * lives in FRAY_TICK, because at this size the tick is a look, not a
   * setting. */
  churn?: number;
}

/** Backing-store cap — past 2x the extra pixels just cost fill rate. */
const MAX_DPR = 2;

import { watchPointer } from './pointer';

/** Cheap integer hash -> 0..1. Deterministic in its inputs, which is what
 * lets the scatter be recomputed from scratch every repaint instead of
 * stored: the same pixel under the same cursor always decides the same way,
 * so the noise sits still while the mouse does. */
function hash(x: number, y: number, seed: number): number {
  /* imul on all three terms, not just the avalanche. A plain `*` on 32-bit
     inputs runs past 2^53 and drops the low bits before `| 0` can keep them,
     which quietly costs the term most of its entropy — and the seeds here
     are 32-bit now that the glitch's roll and the fray's edge clock both
     ride in them. */
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/* ---- the cursor's patch ------------------------------------------------
 *
 * THE PATCH RULE, ported from the dot screen (see lib/halftone.ts, where it
 * is written out in full). Distance from the cursor decides WHETHER a piece
 * of the plate is in the patch. It is not allowed to decide how much.
 *
 * This used to be a disc with a `1 - d/r` ramp on the tear, the dropout and
 * the spill, and the ramp is what drew the circle: damage that fades out
 * evenly in every direction is a shape laid on the art, however ragged the
 * art underneath it is. The mountains and the clouds never read that way
 * because their screen tests every mark against a radius of its OWN, strayed
 * up to ±100% on a hash of where it sits — so the rim dissolves mark by mark
 * and the density falls off statistically instead of by formula.
 *
 * The dither has no marks to jitter — it works pixel by pixel, and jittering
 * per pixel would hand back a smooth density ramp under a microscope, which
 * is the same circle again. So the jitter rides a BLOCK lattice, coarse
 * enough that each block's decision is visible as a piece of torn plate. The
 * blocks are wider than they are tall, which puts the tearing along the same
 * axis as the scanline shear rather than fighting it.
 *
 * The lattice RE-ROLLS on the glitch clock, in two ways at once: which
 * blocks are in gets a fresh draw, and the grid's own origin shifts under
 * them. Pinning it in the art's space — which is what this did first — left
 * the patch's silhouette frozen while its insides churned: the same ragged
 * outline, redrawn, which is a stencil with noise behind it. A tear that
 * changes SHAPE is the thing that reads as the plate failing, and shifting
 * the origin as well as the membership keeps consecutive frames from being
 * the same blocks turning on and off in place.
 */
/** Blocks across one nominal radius, horizontally and vertically. Fewer =
 * coarser tearing. Proportional rather than absolute so a layer whose buffer
 * is half the size does not get twice the tearing. Three across the radius
 * is what the dot screen's rim works out to (a patch 3 cells wide, jittered
 * a cell at a time), and it is about the coarsest granularity the eye still
 * reads as one patch rather than as loose blocks. */
const PATCH_STEPS_X = 3;
const PATCH_STEPS_Y = 5;
/** How far a block's own radius may stray from the nominal one, as a
 * fraction. 1 is the ±100% the dot screen uses: every block is in at the
 * centre, half are in at the nominal radius, a few stragglers reach twice
 * it. */
const PATCH_JITTER = 1;
/** Base seed for that lattice. The glitch's roll is added to it per frame —
 * see above — so this only fixes where the sequence starts. */
const PATCH_SEED = 20873;

/* ---- the glitch clock --------------------------------------------------
 *
 * The damage used to be a pure function of where the pointer was, which
 * meant a held mouse was a held FRAME: the tear sat in one position, the
 * dropout kept exactly the pixels it had dropped, and the whole patch turned
 * into a still. Reading it as a glitch depends on it not settling — a real
 * broken scanout re-tears several times a second whether or not anything
 * moved.
 *
 * So the patch keeps its own clock, and it is deliberately IRREGULAR. An
 * even cadence reads as static — noise at a fixed rate, which the eye
 * resolves as a texture rather than as something failing. Each roll holds
 * for its own jittered stretch, so the patch stutters: a couple of fast
 * jumps, a frame that hangs a beat too long, then another jump.
 *
 * It only runs while the cursor is actually on the layer. That is what
 * keeps this affordable: the plate cache is keyed on the seed, so a rolling
 * seed rebuilds the plate on every roll — and only ever for the one layer
 * the pointer is over. */
const GLITCH_HOLD_MIN = 55;
const GLITCH_HOLD_SPAN = 105;

/* ---- fray ------------------------------------------------------------- */
/** Radius the ink is blurred over to read local density out of a stipple.
 * Wide enough to span several dots, short enough to still find a margin. */
const COVER_BLUR = 5;
/** Where the scatter peaks and where it stops, as multiples of the fray
 * level: densest a third of the way down the thinning band, gone a little
 * past the level itself. Marks in solid ink would read as damage; marks out
 * in the empty dark would read as dirt on the lens. */
const MARK_PEAK = 0.3;
const MARK_FAR = 1.3;
/** Lattice pitch for the loose marks, in buffer px. */
const FRAY_CELL = 5;
/** How fast a layer stops EMITTING as it recedes, over and above the band
 * narrowing on its own. Without this a distant plate frays in a thin line
 * that is still fully populated — narrow, but just as busy, and busy is what
 * carries across a room. Marks are the loud part of this effect, so they are
 * the part that has to thin out with distance. Only ever cuts: at the
 * authored distance and nearer, every cell that qualifies still fires. */
const EMIT_CURVE = 1.6;
/** ms between fray ticks. Slower than the display on purpose — see the note
 * on stepping at the top. Also the whole cost of the effect: the plate is
 * re-rendered on each one, so this is the dial to reach for if two large
 * frayed layers ever cost too much. */
const FRAY_TICK = 45;
/** How far a mark rises over one life, and how far it may wander sideways,
 * in buffer px. Up only: this is a thing coming off the hands, and anything
 * that fell would read as debris rather than as heat. */
const FRAY_RISE = 20;
const FRAY_DRIFT = 5;
/** Life of one mark, in ms: a floor and the spread above it. Every cell
 * draws its own, so no two are ever in step. */
const LIFE_MIN = 900;
const LIFE_SPAN = 1400;
/** Where a mark steps down the alphabet, as fractions of its life. */
const STAGE_MID = 0.45;
const STAGE_LATE = 0.78;
/** How often the eroded edge of the plate itself re-rolls, in ms. Slower
 * than the marks: the plate is what stays put while they come off it. */
const EDGE_TICK = 190;
/** Alpha of the one-pixel halo each mark carries. The buffer is blown up
 * with smoothing off, so this is a hard ring at display size — which is
 * what reads as a mark glowing rather than a mark being blurry. */
const FRAY_HALO = 74;
/** The marks themselves, as offsets from their own centre: x, +, hollow
 * square, dot. Same alphabet as the star field, one scale down. */
const FRAY_MARKS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [[-1, -1], [0, 0], [1, 1], [1, -1], [-1, 1]],
  [[0, -1], [0, 0], [0, 1], [-1, 0], [1, 0]],
  [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]],
  [[0, 0]],
];
const HALO_RING: ReadonlyArray<readonly [number, number]> = [[0, -1], [0, 1], [-1, 0], [1, 0]];

/** Local ink density, 0..255: a separable box blur of the plate's alpha.
 * Two passes with running sums, so the cost is linear in pixels — and it
 * runs once per resize, never per frame. */
function coverage(alpha: Uint8Array, w: number, h: number): Float32Array {
  const n = w * h;
  const tmp = new Float32Array(n);
  const out = new Float32Array(n);
  const r = COVER_BLUR;
  const span = 2 * r + 1;
  const clamp = (v: number, max: number) => (v < 0 ? 0 : v > max ? max : v);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = 0;
    for (let x = -r; x <= r; x++) sum += alpha[row + clamp(x, w - 1)];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum / span;
      sum -= alpha[row + clamp(x - r, w - 1)];
      sum += alpha[row + clamp(x + r + 1, w - 1)];
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) sum += tmp[clamp(y, h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / span;
      sum -= tmp[clamp(y - r, h - 1) * w + x];
      sum += tmp[clamp(y + r + 1, h - 1) * w + x];
    }
  }
  return out;
}

/**
 * Owns one canvas's dither render.
 *
 * Same contract as the other screens (setImage/refresh/destroy, colour read
 * off the element's own CSS, ink strength from --linescreen-alpha) so all
 * four stay swappable behind one component.
 */
export function createDither(canvas: HTMLCanvasElement, options: DitherOptions = {}) {
  const maxSide = options.maxSide ?? 1100;
  const radiusPx = options.radiusPx ?? 22;
  const tearFrac = options.tear ?? 0.6;
  const dropoutMax = options.dropout ?? 0.5;
  const spillMax = options.spill ?? 0.38;
  const band = Math.max(1, options.band ?? 4);
  const opacityDefault = options.opacity ?? 0.9;
  const frayLevel = Math.max(0, Math.min(1, options.fray ?? 0));
  /** That level in the 0..255 the coverage field is measured in. */
  const frayFloor = frayLevel * 255;
  const frayMoves = frayLevel > 0 && (options.churn ?? 0) > 0;
  /* Reads `churn` directly rather than through frayMoves: the glitch clock
     is motion whether or not this layer frays, and prefers-reduced-motion
     arrives as churn 0 (see HeroAsciiArt). */
  const glitchMoves = (options.churn ?? 0) > 0;
  /* The layer's outer box carries how near the camera it currently is, put
     there by the scroll dolly (see frayGain in Hero.tsx). Reading a dataset
     property costs nothing and asks the browser to measure nothing, which is
     the point — this is read on every tick, mid-scroll. */
  const frayHost = frayLevel > 0 ? canvas.closest<HTMLElement>('[data-near]') : null;
  function frayNow() {
    if (!frayHost) return 1;
    const gain = Number(frayHost.dataset.near);
    return Number.isFinite(gain) && gain > 0 ? gain : 1;
  }

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
  /* Local density of the plate, solved once per resize. The fray reads
     everything it needs from this. */
  let cover: Float32Array = new Float32Array(0);
  /* The eroded plate, kept between ticks. The marks move every tick; the
     plate under them only changes when the cursor moves, when the edge
     re-rolls, or when the layer's distance does — a few times a second at
     most. Re-deriving it per tick meant walking every pixel of every frayed
     layer 22 times a second, which was most of the cost of the effect for
     none of the motion. */
  let plate: Uint8ClampedArray = new Uint8ClampedArray(0);
  let plateKey = '';
  /* Which cell of the source is the plate. Zero for an ordinary single-image
     layer; for an ATLAS (see setFrame) the top-left of the current frame,
     with sourceW/sourceH holding one frame rather than the whole sheet.
     Everything downstream is written against sourceW/sourceH, so a frame is
     simply a smaller picture that happens to live inside a bigger file. */
  let srcX = 0;
  let srcY = 0;
  let ow = 0;
  let oh = 0;
  let viewW = 0;
  let viewH = 0;
  /** Layout px per screen px on this layer — solved in resample(). */
  let projScale = 1;

  // Raw CSS colour string handed straight to fillStyle — see the note in
  // linescreen.ts on why this is never parsed here.
  let baseColor = 'rgb(220,220,220)';
  let opacity = opacityDefault;

  let pointerX = -1;
  let pointerY = -1;
  let hoverRaf = 0;

  /* The glitch's own roll, and when it next expires. Held in state rather
     than derived from the clock so the hold can be jittered per roll — an
     even cadence reads as static rather than as a fault. Frozen (and the
     seed pinned) while the pointer is away, so a layer nobody is touching
     renders identically every time and cannot flicker. */
  let glitchRoll = 0;
  let glitchUntil = 0;
  function rollGlitch(now: number) {
    if (!glitchMoves || pointerX < 0) return;
    if (now < glitchUntil) return;
    glitchRoll = (glitchRoll * 1103515245 + 12345) | 0;
    glitchUntil = now + GLITCH_HOLD_MIN + Math.random() * GLITCH_HOLD_SPAN;
  }

  /* The cursor's patch, in BUFFER pixels — the buffer is the file's own
     grid, not the screen's, so this is a genuine change of coordinate
     system rather than the other screens' constant divide. Solved once per
     frame because two different passes need it: the tear/dropout, and the
     fray deciding which of its marks the cursor is allowed to scramble.
     hx < 0 means the pointer is off the layer entirely. */
  let hx = -1;
  let hy = 0;
  let hr = 0;
  /** The furthest a block's jittered radius can reach — how far the tests
      below have to look before they can reject on distance alone. */
  let hrMax2 = 0;
  /** The tearing lattice's pitch, in buffer px. */
  let pcw = 1;
  let pch = 1;
  /** Its seed and its origin for THIS frame, both moved by the glitch roll
      so the patch changes shape and not just contents. */
  let patchSeed = PATCH_SEED;
  let patchOffX = 0;
  let patchOffY = 0;
  function aimPatch() {
    hx = pointerX >= 0 && viewW > 0 ? (pointerX / viewW) * ow : -1;
    hy = viewH > 0 ? (pointerY / viewH) * oh : 0;
    /* Screen px -> layout px (undo the stage's perspective) -> buffer px
       (the file's own grid). Both steps are ratios this renderer already
       holds, so the patch costs no measuring per frame. */
    hr = viewW > 0 ? (radiusPx * projScale * ow) / viewW : 0;
    const reach = hr * (1 + PATCH_JITTER);
    hrMax2 = reach * reach;
    pcw = Math.max(3, Math.round(hr / PATCH_STEPS_X));
    pch = Math.max(2, Math.round(hr / PATCH_STEPS_Y));
    /* A fresh draw for which blocks are in, and a fresh place for the grid
       lines to fall. Without the offset the same block boundaries sit in the
       same pixels every roll, and the eye finds the grid through the noise
       however the membership shuffles. */
    patchSeed = (PATCH_SEED + glitchRoll) | 0;
    patchOffX = (hash(glitchRoll, 17, 5381) * pcw) | 0;
    patchOffY = (hash(glitchRoll, 43, 5381) * pch) | 0;
    // The block memo below is only valid within one frame now that the
    // lattice moves under it.
    memoBx = NaN;
    memoBy = NaN;
  }

  /* One-entry memo for the block radius. The plate is walked row-major, so
     every pixel of a block asks the same question its neighbour just did —
     tens of thousands of hashes a pass, all but one per block redundant. */
  let memoBx = NaN;
  let memoBy = NaN;
  let memoR2 = 0;

  /** Whether the cursor has hold of this block of the plate. `d2` is the
      pixel's own squared distance; `bx`/`by` are its block. Binary, against
      the block's own radius, with no falloff anywhere — see THE PATCH RULE
      at the top. */
  function torn(d2: number, bx: number, by: number): boolean {
    if (hx < 0 || d2 > hrMax2) return false;
    if (bx !== memoBx || by !== memoBy) {
      memoBx = bx;
      memoBy = by;
      const rr = hr * (1 + (hash(bx, by, patchSeed) * 2 - 1) * PATCH_JITTER);
      memoR2 = rr > 0 ? rr * rr : 0;
    }
    return d2 < memoR2;
  }

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

    /* How much larger this layer's LAYOUT box is than the box the viewer
       actually sees. Read the same way the dot screen reads it, and spent in
       aimPatch on the one thing here that is authored in screen px. */
    const projected = canvas.getBoundingClientRect().width;
    projScale = projected > 0 ? viewW / projected : 1;

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
    // Source rect, not the whole image: an atlas layer draws one frame out
    // of the sheet. srcX/srcY are 0 for everything else, so this is the
    // same draw it always was.
    bctx.drawImage(source, srcX, srcY, sourceW, sourceH, 0, 0, ow, oh);
    let data: Uint8ClampedArray;
    try {
      data = bctx.getImageData(0, 0, ow, oh).data;
    } catch {
      // Tainted canvas (cross-origin source without CORS).
      return false;
    }
    /* Reused whenever the buffer has not actually changed shape. An atlas
       layer comes back through here on every frame step — a few dozen times
       across the dolly — and throwing away three buffers this size each
       time hands the collector several megabytes of garbage mid-scroll, for
       nothing: the only thing that moved is the pixels inside them. */
    if (base.length !== ow * oh) base = new Uint8Array(ow * oh);
    for (let i = 0; i < ow * oh; i++) base[i] = data[i * 4 + 3] ?? 0;
    if (frayLevel > 0) cover = coverage(base, ow, oh);
    if (!image || image.width !== ow || image.height !== oh) image = bctx.createImageData(ow, oh);
    if (plate.length !== ow * oh * 4) plate = new Uint8ClampedArray(ow * oh * 4);
    // The plate is derived from pixels that just changed, so its memo is
    // stale whether or not the buffer was reallocated.
    plateKey = '';
    return true;
  }

  function render() {
    if (!ctx || !bctx || !image || !ow || !oh) return;
    const px = image.data;

    /* Reseeded from the cursor, so the tear reshuffles as the mouse travels
       — AND from the glitch's own clock, so it goes on tearing when the mouse
       stops. Two independent terms on purpose: moving the pointer should
       disturb the patch immediately rather than waiting for the next roll. */
    rollGlitch(performance.now());
    const seed = (Math.round(pointerX) * 7 + Math.round(pointerY) * 131 + glitchRoll) | 0;
    // Where that cursor is on the buffer, and how far its damage reaches.
    // Both passes below read it.
    aimPatch();
    /* The fray's two clocks. Read once per frame so every mark in a pass
       agrees on what time it is, and frozen at zero when the field is not
       moving — a still fray has to render identically every time or it
       would flicker whenever the cursor triggered a repaint. */
    const now = frayMoves ? performance.now() : 0;
    const edgeRoll = frayMoves ? Math.floor(now / EDGE_TICK) * 7919 : 0;
    /* Solved once per frame so the erosion and the marks cannot disagree
       about how near the layer is. Distance does two separate things: it
       narrows the band the fray happens in, and it thins out how many marks
       that band emits. The second is what keeps a far plate from reading as
       busy — the band alone would just make a tighter, equally crowded
       fringe. */
    const gainNow = frayLevel > 0 ? frayNow() : 0;
    const floorNow = frayFloor * gainNow;
    const emitNow = gainNow >= 1 ? 1 : Math.pow(gainNow, EMIT_CURVE);

    /* Everything the plate depends on, and nothing the marks do. The
       distance is rounded so that scrolling cannot invalidate the cache every
       frame over a change too small to see. */
    const key = `${seed}|${edgeRoll}|${floorNow.toFixed(1)}`;
    if (key !== plateKey) {
      plateKey = key;
      buildPlate(floorNow, seed, edgeRoll);
    }
    px.set(plate);

    if (frayLevel > 0) scatterMarks(px, seed, now, floorNow, emitNow);

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

  /** The art itself: torn under the cursor, thinned where it is already
   * thin. Written into `plate` rather than straight out, so a tick that only
   * moves the marks can start from a copy instead of doing this again. */
  function buildPlate(floorNow: number, seed: number, edgeRoll: number) {
    const px = plate;
    px.fill(0);

    const tearMax = hr * tearFrac;
    for (let y = 0; y < oh; y++) {
      const rowOff = y * ow;
      // Rows far from the cursor never enter the glitch path at all — for a
      // stationary pointer that is most of the image.
      const dyTop = y - hy;
      const rowInRange = dyTop * dyTop < hrMax2 && hx >= 0;
      const by = ((y + patchOffY) / pch) | 0;
      let shift = 0;
      if (rowInRange) {
        // One displacement per BAND of rows. Shearing every row on its own
        // reads as static; a few rows moving together reads as a tear.
        // Rounded here rather than per pixel: the whole band slides by ONE
        // integer amount now that nothing tapers it across the patch, which
        // is what a broken scanout actually does.
        const n = hash((y / band) | 0, 0, seed);
        shift = Math.round((n * 2 - 1) * tearMax);
      }
      for (let x = 0; x < ow; x++) {
        let v: number;
        // Whether the cursor is standing on this pixel. Also read by the
        // fray below, which is the only thing the cursor is allowed to
        // reshuffle.
        let inPatch = false;
        if (!rowInRange) {
          v = base[rowOff + x];
        } else {
          const dx = x - hx;
          inPatch = torn(dx * dx + dyTop * dyTop, ((x + patchOffX) / pcw) | 0, by);
          if (!inPatch) {
            v = base[rowOff + x];
          } else {
            /* No distance term. The damage is the same everywhere inside
               the patch and simply stops at its ragged edge — see THE PATCH
               RULE. What used to be here was `1 - d/r` on all three of the
               shear, the dropout and the spill, and that ramp is what made
               the effect read as a circle. */
            let src = x + shift;
            if (src < 0) src = 0;
            else if (src >= ow) src = ow - 1;
            v = base[rowOff + src];
            if (v) {
              if (hash(x, y, seed + 9973) < dropoutMax) v = 0;
            } else if (hash(x, y, seed + 4211) < spillMax) {
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
        // Thin the plate where it is already thin: a dot's survival is the
        // local density around it, so a falling-off tone dissolves dot by
        // dot instead of ending on a line.
        /* The cursor's seed is added ONLY inside the patch. It used to be
           in here unconditionally, and the consequence was that nudging the
           mouse anywhere over the layer re-rolled the erosion across the
           entire plate — the whole margin flickered at once, which reads as
           the image being redrawn rather than as the cursor disturbing it.
           Outside the patch the erosion keeps its own clock (EDGE_TICK) and
           the cursor is not part of the decision at all. */
        if (v && frayLevel > 0) {
          const c = cover[rowOff + x];
          const fs = (inPatch ? seed : 0) + 5501 + edgeRoll;
          if (c < floorNow && hash(x, y, fs) > c / floorNow) v = 0;
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

  }

  /** The particle field. Density sets the CHANCE a lattice cell emits at
   * all, never how strongly its mark is drawn: a mark is a mark, and dimming
   * them by how thin the ink is would put a soft rim back on the picture —
   * the exact thing the fray exists to avoid. What a mark does instead is
   * get SMALLER as it dies, which the eye reads as fading without anything
   * having gone grey. */
  function scatterMarks(px: Uint8ClampedArray, seed: number, now: number, floorNow: number, emitNow: number) {
    const peak = floorNow * MARK_PEAK;
    const far = floorNow * MARK_FAR;
    for (let cy = 1; cy < oh - 1; cy += FRAY_CELL) {
      for (let cx = 1; cx < ow - 1; cx += FRAY_CELL) {
        const c = cover[cy * ow + cx];
        // Rises out of the empty dark, peaks in the thin margin, gone by the
        // time the ink is solid.
        const k = Math.min(c / peak, (far - c) / (far - peak));
        if (k <= 0) continue;
        /* WHICH marks the cursor may scramble. Everything below that used
           to key off `seed` keyed off it everywhere, so the pointer landing
           anywhere on the layer re-rolled every cell's emit, glyph and
           heading at once — the entire field jumped on contact instead of
           the cursor stirring the part it is over. The clock terms (`life`,
           `u`) never took the seed and still do not: a mark's age is its
           own, so a cell the cursor sweeps gets a new mark rather than a
           restarted one. */
        const pdx = cx - hx;
        const pdy = cy - hy;
        /* Same membership test the plate uses, so the scramble is torn off
           along the same ragged edge rather than ending on a circle of its
           own a few pixels away from the plate's. */
        const s = torn(pdx * pdx + pdy * pdy, ((cx + patchOffX) / pcw) | 0, ((cy + patchOffY) / pch) | 0)
          ? seed
          : 0;
        if (hash(cx, cy, s + 8191) > k * k * emitNow) continue;

        /* One life, solved rather than stored. Its length and its phase are
           the cell's own, so the field never pulses together. */
        const life = LIFE_MIN + hash(cx, cy, 911) * LIFE_SPAN;
        const u = now / life + hash(cx, cy, 4242);
        const cycle = Math.floor(u);
        const t = u - cycle;
        /* Re-rolled per LIFE, not per frame: within one rise a mark keeps
           its glyph and its heading, and picks new ones when it comes back.
           That is the difference between a field that churns and a field
           that jitters. */
        const roll = hash(cx + cycle * 31, cy - cycle * 17, s + 313);
        const sway = hash(cx - cycle * 13, cy + cycle * 29, s + 577) - 0.5;

        const jx = cx + Math.round(sway * FRAY_DRIFT * t) + ((hash(cx, cy, s + 77) * 3) | 0) - 1;
        const jy = cy - Math.round(t * FRAY_RISE) + ((hash(cx, cy, s + 991) * 3) | 0) - 1;

        /* The decay ladder: a feature mark while it is close, an x or a +
           as it goes, a single lit pixel at the end. The last stage drops
           its halo too, so a mark's final frame is one pixel — which is how
           it leaves without ever dimming. */
        const late = t >= STAGE_LATE;
        const mark = late
          ? FRAY_MARKS[3]
          : t >= STAGE_MID
            ? FRAY_MARKS[(roll * 2) | 0]
            : FRAY_MARKS[(roll * 3) | 0];

        for (const [dx, dy] of mark) {
          const mx = jx + dx;
          const my = jy + dy;
          if (mx < 0 || mx >= ow || my < 0 || my >= oh) continue;
          const o = (my * ow + mx) * 4;
          px[o] = 255;
          px[o + 1] = 255;
          px[o + 2] = 255;
          px[o + 3] = 255;
          if (late) continue;
          for (const [rx, ry] of HALO_RING) {
            const nx = mx + rx;
            const ny = my + ry;
            if (nx < 0 || nx >= ow || ny < 0 || ny >= oh) continue;
            const q = (ny * ow + nx) * 4;
            if (px[q + 3] >= FRAY_HALO) continue;
            px[q] = 255;
            px[q + 1] = 255;
            px[q + 2] = 255;
            px[q + 3] = FRAY_HALO;
          }
        }
      }
    }
  }

  /** For an atlas, `naturalW`/`naturalH` are ONE FRAME's size and `frameX`/
   * `frameY` its origin in the sheet — not the file's own dimensions. */
  function setImage(next: CanvasImageSource, naturalW: number, naturalH: number, frameX = 0, frameY = 0) {
    source = next;
    sourceW = naturalW;
    sourceH = naturalH;
    srcX = frameX;
    srcY = frameY;
    readColors();
    if (resample()) render();
  }

  /** Shows a different cell of the atlas. The scene drives this from the
   * scroll, so it is called with the same frame far more often than with a
   * new one — hence the early-out. A step costs one rasterise of the plate
   * (and its coverage field), which is why the caller works in whole frames
   * rather than scrubbing continuously. */
  function setFrame(frameX: number, frameY: number) {
    if (frameX === srcX && frameY === srcY) return;
    srcX = frameX;
    srcY = frameY;
    if (source && resample()) render();
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

  /* The only clock in this renderer. Two things ask for it: the fray, which
     runs whenever the layer is on screen, and the glitch, which runs only
     while the cursor is on this layer. One interval serves both — they step
     at the same rate and a second timer would just double the repaints on
     the layer being hovered.
     An interval rather than rAF: both fields are meant to step at their own
     rate, so pacing them to the display would mean throttling every frame
     anyway, and a background tab throttles this for free.
     Gated on the canvas actually being on screen. Everything else here is
     paid for only when the cursor moves, and a field that repainted two
     large buffers 22 times a second while the reader was three sections
     down would be the one part of this scene that cost something for
     nothing. */
  let tickTimer = 0;
  let onScreenNow = false;
  const wantsTick = () => onScreenNow && (frayMoves || (glitchMoves && pointerX >= 0));
  const syncTick = () => {
    if (wantsTick()) {
      if (!tickTimer) {
        tickTimer = window.setInterval(() => {
          if (image) render();
        }, FRAY_TICK);
      }
    } else if (tickTimer) {
      window.clearInterval(tickTimer);
      tickTimer = 0;
    }
  };
  const onScreen = frayMoves || glitchMoves
    ? new IntersectionObserver(([entry]) => {
        onScreenNow = entry.isIntersecting;
        syncTick();
      })
    : null;
  onScreen?.observe(canvas);

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
    // Stops the glitch clock on a layer nobody is touching. A frayed layer
    // keeps ticking for its own field; an unfrayed one goes quiet entirely.
    syncTick();
    scheduleHover();
  }

  /* Window-routed rather than bound to the canvas: the hero's layers overlap
   * as rectangles and the browser can only hand a move to one of them, so
   * the canvases no longer hit-test at all. No ink gate here — unlike the
   * screens, this variant draws the art as authored across its whole box. */
  const unwatchPointer = watchPointer(canvas, {
    move(x, y) {
      const entered = pointerX < 0;
      pointerX = x;
      pointerY = y;
      if (entered) syncTick();
      scheduleHover();
    },
    leave: onLeave,
  });

  return {
    setImage,
    setFrame,
    refresh,
    destroy() {
      onScreen?.disconnect();
      if (tickTimer) window.clearInterval(tickTimer);
      tickTimer = 0;
      if (hoverRaf) cancelAnimationFrame(hoverRaf);
      themeObserver.disconnect();
      unwatchPointer();
    },
  };
}
