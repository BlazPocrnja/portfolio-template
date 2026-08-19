/** Character pools ordered from sparsest to densest — density (or, for the
 * baked art, a reverse lookup) picks a pool; hover swaps a cell to its
 * density mirror. Shared by every ascii-mosaic panel (footer hands, hero
 * brain/hands) so they ripple with the same vocabulary. */
export const POOLS = [
  ' ',
  '·.,',
  ':;`-~^',
  '=+<>?!:;',
  '|/\\()[]{}«»',
  '÷×±–—≈≠≤≥∞∆∇',
  '¤†‡§¶©®™°¬',
  '%&#$@¥€£¢',
];

export interface AsciiGrid {
  chars: string[][];
  pools: number[][];
  /** Continuous 0..1 density per cell, independent of which (quantized,
   * 8-bucket) pool the character came from. The character choice gives
   * coarse shape/texture; this drives per-glyph opacity so the tonal range
   * isn't capped at 8 steps — a photographic gradient instead of a stepped
   * one. -1 for blank cells. */
  values: number[][];
  cols: number;
  rows: number;
}

export const EMPTY_GRID: AsciiGrid = { chars: [], pools: [], values: [], cols: 0, rows: 0 };

export function makeRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/** brightness (0..1) -> per-glyph opacity. Floored so a cell that earned a
 * real character never fades to invisible, ceilinged just under 1 so even
 * the brightest cells keep a hair of texture against the flat background. */
function opacityFor(value: number): number {
  if (value < 0) return 1;
  return 0.22 + value * 0.76;
}

/**
 * Samples a source image down to `cols` columns and maps each cell to a
 * character pool. Returns an empty grid (cols: 0) if the source can't be
 * read — e.g. a cross-origin image without CORS headers taints the canvas
 * — so the caller can fall back to baked-in art.
 *
 * `density` picks how a cell's coverage is read:
 *  - 'luminance' (default): brightness of the downsampled RGB, weighted by
 *    alpha — right for ordinary photos on a transparent/light background.
 *  - 'alpha': the downsampled alpha channel itself. Canvas antialiases a
 *    scaled-down drawImage, so for a 1-bit stipple (pure-black ink dots,
 *    alpha 0/255 — e.g. the dithered engraving exports) the shrunk alpha
 *    IS the local dot density; reading luminance instead would see uniform
 *    black ink and collapse every cell to the same bucket.
 */
export function buildAsciiGridFromImage(
  source: CanvasImageSource,
  sourceW: number,
  sourceH: number,
  cols: number,
  seed: number,
  density: 'luminance' | 'alpha' = 'luminance'
): AsciiGrid {
  if (!sourceW || !sourceH) return EMPTY_GRID;
  const rand = makeRng(seed);
  const aspect = sourceH / sourceW;
  const rows = Math.max(1, Math.round(cols * aspect));

  const sample = document.createElement('canvas');
  sample.width = cols;
  sample.height = rows;
  const sctx = sample.getContext('2d');
  if (!sctx) return EMPTY_GRID;
  sctx.drawImage(source, 0, 0, cols, rows);

  let data: Uint8ClampedArray;
  try {
    data = sctx.getImageData(0, 0, cols, rows).data;
  } catch {
    return EMPTY_GRID;
  }

  const chars: string[][] = [];
  const pools: number[][] = [];
  const values: number[][] = [];
  for (let y = 0; y < rows; y++) {
    const rowChars: string[] = [];
    const rowPools: number[] = [];
    const rowValues: number[] = [];
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const a = data[i + 3] ?? 0;
      if (a < 15) {
        rowChars.push(' ');
        rowPools.push(-1);
        rowValues.push(-1);
        continue;
      }
      const brightness =
        density === 'alpha' ? a / 255 : ((0.299 * r + 0.587 * g + 0.114 * b) / 255) * (a / 255);
      const pi = Math.min(POOLS.length - 1, Math.floor(brightness * (POOLS.length - 1) * 0.85));
      const pool = POOLS[pi] ?? ' ';
      rowChars.push(pool[Math.floor(rand() * pool.length)] ?? ' ');
      rowPools.push(pi);
      rowValues.push(brightness);
    }
    chars.push(rowChars);
    pools.push(rowPools);
    values.push(rowValues);
  }
  return { chars, pools, values, cols, rows };
}

export interface AsciiMosaicOptions {
  /** Hover ripple radius, in grid cells. */
  hoverRadius?: number;
  /** Fraction of the mosaic's non-blank cells that re-roll to a different
   * glyph from their OWN density pool every frame. 0.08 at 60fps means an
   * average cell changes ~5x/second — a continuous boil, not a slow drift.
   * Pass 0 to freeze (prefers-reduced-motion). */
  churn?: number;
  /** Hard ceiling on re-rolls per frame, so a huge grid costs the same per
   * frame as a small one instead of scaling its draw cost with cell count. */
  churnCap?: number;
  /** How long a pointer-hit cell stays flashed in the accent, in ms. */
  hitMs?: number;
}

/** Backing-store cap — beyond 2x the extra pixels aren't visible on this
 * kind of high-frequency glyph texture, they just cost fill rate. */
const MAX_DPR = 2;

/** Glyph size relative to the cell. Mirrors the DOM version's metrics
 * (monospace ~0.6em advance in a 1.1em cell) so art authored against that
 * grid keeps its proportions and sparseness. */
const FONT_RATIO = 1 / 1.1;
const MOSAIC_FONT = 'Consolas, Menlo, monospace';

/**
 * Owns one <canvas>'s render: the base mosaic (character + per-glyph opacity
 * from AsciiGrid.values), a continuous full-field glyph boil, and the
 * pointer ripple (flash to the density mirror in the accent).
 *
 * Canvas, not DOM. The previous version gave every non-blank cell its own
 * <span>, which capped how much of the mosaic could move: any mutation made
 * Blink rebuild the paint list for the surrounding box, so churn had to be
 * confined to one small roaming patch to stay affordable — tens of
 * thousands of layout boxes sitting idle, and a mosaic that barely moved.
 * Here a cell costs a clearRect + fillText into a bitmap the compositor
 * uploads once per frame, with no layout, no style recalc, and no DOM at
 * all, so the boil can cover the whole field.
 *
 * Only cells that actually change are redrawn each frame (a re-roll, a new
 * hit, an expiring hit) — the per-frame cost tracks the churn budget, not
 * the grid size, so a 26k-cell panel costs the same as a 3k-cell one.
 *
 * Colors come from CSS on the canvas element: `color` for the base glyphs,
 * `--ascii-hit-bg` / `--ascii-hit-fg` for the pointer flash — so theme
 * tokens keep working. Call `refresh()` after a theme switch.
 *
 * `setGrid` re-measures and repaints immediately; callers push new grids in
 * (image load, resize) and the controller does no polling of its own.
 */
export function createAsciiMosaic(canvas: HTMLCanvasElement, options: AsciiMosaicOptions = {}) {
  const hoverRadius = options.hoverRadius ?? 2.5;
  const churn = options.churn ?? 0.08;
  const churnCap = options.churnCap ?? 900;
  const hitMs = options.hitMs ?? 260;

  const ctx = canvas.getContext('2d');

  let grid: AsciiGrid = EMPTY_GRID;
  let noise: number[][] = [];
  let nonBlank: number[] = []; // flat y*cols+x indices, for O(1) churn/hit sampling
  const hits = new Map<number, number>(); // flat idx -> expiry timestamp (ms)

  let cellW = 0;
  let cellH = 0;
  let viewW = 0;
  let viewH = 0;
  let baseColor = '#888';
  let hitBg = '#888';
  let hitFg = '#000';

  let raf = 0;
  let onScreen = true;

  /** Base glyph color + accent flash pair, read from the element's own
   * computed style so the caller styles this in CSS like anything else. */
  function readColors() {
    const cs = getComputedStyle(canvas);
    baseColor = cs.color || '#888';
    hitBg = cs.getPropertyValue('--ascii-hit-bg').trim() || baseColor;
    hitFg = cs.getPropertyValue('--ascii-hit-fg').trim() || '#000';
  }

  /** Sizes the backing store to the element's CSS box and derives the cell
   * metrics. Returns false when there's nothing paintable yet. */
  function measure(): boolean {
    if (!ctx || !grid.cols || !grid.rows) return false;
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
    // Any width/height write resets the whole 2D state, so transform, font
    // and alignment are re-established here rather than once at setup.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cellW = viewW / grid.cols;
    cellH = viewH / grid.rows;
    ctx.font = `${(cellH * FONT_RATIO).toFixed(2)}px ${MOSAIC_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    return true;
  }

  function drawCell(y: number, x: number) {
    if (!ctx) return;
    const px = x * cellW;
    const py = y * cellH;
    ctx.clearRect(px, py, cellW, cellH);
    const pi = grid.pools[y]?.[x] ?? -1;
    if (pi <= 0) return;

    if (hits.has(y * grid.cols + x)) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = hitBg;
      ctx.fillRect(px, py, cellW, cellH);
      ctx.fillStyle = hitFg;
    } else {
      ctx.globalAlpha = opacityFor(grid.values[y]?.[x] ?? -1);
      ctx.fillStyle = baseColor;
    }
    ctx.fillText(grid.chars[y][x], px + cellW / 2, py + cellH / 2);
    ctx.globalAlpha = 1;
  }

  function drawAll() {
    if (!ctx) return;
    ctx.clearRect(0, 0, viewW, viewH);
    for (let i = 0; i < nonBlank.length; i++) {
      const flat = nonBlank[i];
      drawCell((flat / grid.cols) | 0, flat % grid.cols);
    }
  }

  /** Re-roll to a different glyph from the SAME density pool — texture
   * only, so the shape and its tonal range hold still while the characters
   * underneath it churn. */
  function reroll(flat: number) {
    const y = (flat / grid.cols) | 0;
    const x = flat % grid.cols;
    const pool = POOLS[grid.pools[y]?.[x] ?? -1] ?? '';
    if (pool.length < 2) return;
    grid.chars[y][x] = pool[(Math.random() * pool.length) | 0] ?? ' ';
    drawCell(y, x);
  }

  function frame() {
    raf = requestAnimationFrame(frame);
    if (!ctx || !nonBlank.length) return;

    const now = performance.now();
    for (const [flat, until] of hits) {
      if (now >= until) {
        hits.delete(flat);
        drawCell((flat / grid.cols) | 0, flat % grid.cols);
      }
    }

    if (churn > 0) {
      const budget = Math.min(churnCap, Math.round(nonBlank.length * churn));
      for (let i = 0; i < budget; i++) {
        const flat = nonBlank[(Math.random() * nonBlank.length) | 0];
        if (!hits.has(flat)) reroll(flat);
      }
    }
  }

  function start() {
    if (!raf && onScreen && !document.hidden) raf = requestAnimationFrame(frame);
  }
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function setGrid(next: AsciiGrid) {
    grid = next;
    noise = [];
    nonBlank = [];
    for (let y = 0; y < grid.rows; y++) {
      const nr: number[] = [];
      for (let x = 0; x < grid.cols; x++) {
        const h = Math.abs((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1);
        nr.push(h * 5 - 2.5);
        if ((grid.pools[y]?.[x] ?? -1) > 0) nonBlank.push(y * grid.cols + x);
      }
      noise.push(nr);
    }
    hits.clear();
    readColors();
    if (measure()) drawAll();
    start();
  }

  /** Re-read theme colors and repaint without rebuilding the grid. */
  function refresh() {
    readColors();
    if (measure()) drawAll();
  }

  /** Pointer hits: flash to the density-mirror pool in the accent, with the
   * per-cell noise jittering both the ripple edge and how long it holds. */
  function flashHit(y: number, x: number, now: number) {
    const pi = grid.pools[y]?.[x] ?? -1;
    if (pi <= 0) return;
    const pool = POOLS[POOLS.length - 1 - pi] ?? ' ';
    grid.chars[y][x] = pool[(Math.random() * pool.length) | 0] ?? ' ';
    const flat = y * grid.cols + x;
    hits.set(flat, now + hitMs * (Math.abs(noise[y]?.[x] ?? 0) > 1.25 ? 1 : 0.5));
    drawCell(y, x);
  }

  function onMove(e: MouseEvent) {
    if (!grid.cols || !cellW || !cellH) return;
    const rect = canvas.getBoundingClientRect();
    // The hero panels live under a CSS 3D transform, so the on-screen box
    // is a scaled version of the layout box the cell metrics describe —
    // normalize through the rect's own size rather than assuming 1:1.
    const mxC = ((e.clientX - rect.left) / rect.width) * grid.cols;
    const myC = ((e.clientY - rect.top) / rect.height) * grid.rows;
    const now = performance.now();
    const maxR = hoverRadius + 3;
    const yMin = Math.max(0, Math.floor(myC - maxR));
    const yMax = Math.min(grid.rows - 1, Math.ceil(myC + maxR));
    const xMin = Math.max(0, Math.floor(mxC - maxR));
    const xMax = Math.min(grid.cols - 1, Math.ceil(mxC + maxR));
    for (let y = yMin; y <= yMax; y++) {
      for (let x = xMin; x <= xMax; x++) {
        const dx = x - mxC;
        const dy = y - myC;
        const rr = hoverRadius + (noise[y]?.[x] ?? 0);
        if (dx * dx + dy * dy < rr * rr) flashHit(y, x, now);
      }
    }
  }
  canvas.addEventListener('mousemove', onMove);

  // Offscreen panels cost nothing: the boil is decoration, and a hero that
  // has scrolled away (or a backgrounded tab) has no reason to keep a rAF
  // loop alive.
  const io = new IntersectionObserver(
    ([entry]) => {
      onScreen = !!entry?.isIntersecting;
      if (onScreen) start();
      else stop();
    },
    { threshold: 0 }
  );
  io.observe(canvas);

  const onVisibility = () => {
    if (document.hidden) stop();
    else start();
  };
  document.addEventListener('visibilitychange', onVisibility);

  // Glyph colors are baked into the bitmap at draw time, so unlike a CSS
  // color they don't follow a theme swap on their own.
  const themeObserver = new MutationObserver(refresh);
  themeObserver.observe(document.documentElement, { attributeFilter: ['data-theme'] });

  return {
    setGrid,
    refresh,
    /** Re-measure after the element's CSS box changed (resize, font swap). */
    resize() {
      if (measure()) drawAll();
    },
    destroy() {
      stop();
      io.disconnect();
      themeObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('mousemove', onMove);
    },
  };
}
