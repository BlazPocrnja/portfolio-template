import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { gsap, ScrollTrigger, ensureGsap } from '@/lib/gsap';
import { HAND_ASCII_LEFT, HAND_ASCII_RIGHT } from '@/data/hand-ascii';

/** Character pools ordered from sparsest to densest — brightness (or, for the baked art, a reverse lookup) picks a pool; hover swaps a cell to its density mirror. */
const POOLS = [
  ' ',
  '·.,',
  ':;`-~^',
  '=+<>?!:;',
  '|/\\()[]{}«»',
  '÷×±–—≈≠≤≥∞∆∇',
  '¤†‡§¶©®™°¬',
  '%&#$@¥€£¢',
];

interface AsciiGrid {
  chars: string[][];
  pools: number[][];
  cols: number;
  rows: number;
}

const EMPTY_GRID: AsciiGrid = { chars: [], pools: [], cols: 0, rows: 0 };

function makeRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/** Reverse lookup: which pool a literal character belongs to, so the baked ascii art can still ripple on hover. */
const CHAR_TO_POOL = new Map<string, number>();
POOLS.forEach((pool, i) => {
  for (const ch of pool) CHAR_TO_POOL.set(ch, i);
});

/** Turns a block of pre-rendered ascii text (equal-width rows) into the same grid shape the image sampler produces. */
function gridFromAsciiArt(rows: string[]): AsciiGrid {
  const cols = Math.max(0, ...rows.map((r) => [...r].length));
  const chars: string[][] = [];
  const pools: number[][] = [];
  for (const row of rows) {
    const rowChars = [...row];
    while (rowChars.length < cols) rowChars.push(' ');
    chars.push(rowChars);
    pools.push(rowChars.map((ch) => CHAR_TO_POOL.get(ch) ?? -1));
  }
  return { chars, pools, cols, rows: chars.length };
}

const FALLBACK_GRID_LEFT = gridFromAsciiArt(HAND_ASCII_LEFT);
const FALLBACK_GRID_RIGHT = gridFromAsciiArt(HAND_ASCII_RIGHT);

/**
 * Samples a source image down to `cols` columns and maps brightness to a
 * character pool. Returns an empty grid (cols: 0) if the source can't be
 * read — e.g. a cross-origin image without CORS headers taints the canvas
 * — so the caller can fall back to the baked-in hand art.
 */
function buildAsciiGridFromImage(
  source: CanvasImageSource,
  sourceW: number,
  sourceH: number,
  cols: number,
  seed: number
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
  for (let y = 0; y < rows; y++) {
    const rowChars: string[] = [];
    const rowPools: number[] = [];
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const a = data[i + 3] ?? 0;
      if (a < 15) {
        rowChars.push(' ');
        rowPools.push(-1);
        continue;
      }
      const brightness = ((0.299 * r + 0.587 * g + 0.114 * b) / 255) * (a / 255);
      const pi = Math.min(POOLS.length - 1, Math.floor(brightness * (POOLS.length - 1) * 0.85));
      const pool = POOLS[pi] ?? ' ';
      rowChars.push(pool[Math.floor(rand() * pool.length)] ?? ' ');
      rowPools.push(pi);
    }
    chars.push(rowChars);
    pools.push(rowPools);
  }
  return { chars, pools, cols, rows };
}

const LINE_HEIGHT = 1.1;

/** First..last row index that has any non-blank (pool > 0) cell — the rows that are actually visible hand, not padding. */
function contentRowSpan(grid: AsciiGrid): number {
  let first = -1;
  let last = -1;
  for (let y = 0; y < grid.rows; y++) {
    if (grid.pools[y]?.some((p) => p > 0)) {
      if (first === -1) first = y;
      last = y;
    }
  }
  return first === -1 ? grid.rows : last - first + 1;
}

/**
 * Different art has wildly different total row counts (the left hand's
 * baked art is 37 rows, nearly all hand; the right is ~107, mostly blank
 * padding that pushes it lower in its panel). Sizing off total rows made
 * both blocks the same overall height, which shrank the right hand to a
 * fraction of the left's visible size — the blank padding ate the "budget".
 * Sizing off the CONTENT span instead (ignoring blank rows) keeps the
 * actual hand a consistent visual size regardless of how much padding
 * surrounds it; the extra blank rows just add invisible height beyond that,
 * which is what shifts it lower once centered in the panel.
 */
function applyFontSizeForRows(pre: HTMLPreElement, grid: AsciiGrid) {
  if (!grid.rows) return;
  const span = contentRowSpan(grid);
  const targetPx = Math.min(340, Math.max(220, window.innerHeight * 0.3));
  const fontPx = targetPx / (span * LINE_HEIGHT);
  pre.style.fontSize = `${fontPx.toFixed(2)}px`;
}

function escapeChar(ch: string): string {
  if (ch === '<') return '&lt;';
  if (ch === '>') return '&gt;';
  if (ch === '&') return '&amp;';
  return ch;
}

/** Wires up hover-distortion on a <pre> given its current ascii grid (read via a getter so image reloads stay live). */
function attachHover(pre: HTMLPreElement, getGrid: () => AsciiGrid) {
  const radius = 2.5;
  let noise: number[][] = [];
  let hitTime: number[][] = [];
  let cellDuration: number[][] = [];
  let noiseCols = -1;
  let noiseRows = -1;
  let animating = false;
  let raf = 0;

  function ensureNoise(grid: AsciiGrid) {
    if (noiseCols === grid.cols && noiseRows === grid.rows) return;
    noiseCols = grid.cols;
    noiseRows = grid.rows;
    noise = [];
    hitTime = [];
    cellDuration = [];
    for (let y = 0; y < grid.rows; y++) {
      const nr: number[] = [];
      const ht: number[] = [];
      const cd: number[] = [];
      for (let x = 0; x < grid.cols; x++) {
        const h = Math.abs((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1);
        nr.push(h * 5 - 2.5);
        ht.push(0);
        cd.push(h > 0.5 ? 200 : 100);
      }
      noise.push(nr);
      hitTime.push(ht);
      cellDuration.push(cd);
    }
  }

  function tick() {
    const grid = getGrid();
    if (!grid.cols) {
      animating = false;
      return;
    }
    const now = performance.now();
    let anyActive = false;
    let html = '';
    for (let y = 0; y < grid.rows; y++) {
      for (let x = 0; x < grid.cols; x++) {
        const pi = grid.pools[y]?.[x] ?? -1;
        if (pi <= 0) {
          html += ' ';
          continue;
        }
        const last = hitTime[y]?.[x] ?? 0;
        const dur = cellDuration[y]?.[x] ?? 0;
        const elapsed = now - last;
        if (last > 0 && elapsed < dur) {
          anyActive = true;
          const idx = POOLS.length - 1 - pi;
          const pool = POOLS[idx] ?? ' ';
          const ch = pool[Math.floor(Math.random() * pool.length)] ?? ' ';
          html += `<span class="fa-hit">${escapeChar(ch)}</span>`;
        } else {
          html += escapeChar(grid.chars[y]?.[x] ?? ' ');
        }
      }
      html += '\n';
    }
    pre.innerHTML = html;
    if (anyActive) {
      raf = requestAnimationFrame(tick);
    } else {
      animating = false;
      pre.textContent = grid.chars.map((row) => row.join('')).join('\n');
    }
  }

  function onMove(e: MouseEvent) {
    const grid = getGrid();
    if (!grid.cols) return;
    ensureNoise(grid);
    const rect = pre.getBoundingClientRect();
    const charW = rect.width / grid.cols;
    const charH = rect.height / grid.rows;
    const mxC = (e.clientX - rect.left) / charW;
    const myC = (e.clientY - rect.top) / charH;
    const now = performance.now();
    const maxR = radius + 3;
    const yMin = Math.max(0, Math.floor(myC - maxR));
    const yMax = Math.min(grid.rows - 1, Math.ceil(myC + maxR));
    const xMin = Math.max(0, Math.floor(mxC - maxR));
    const xMax = Math.min(grid.cols - 1, Math.ceil(mxC + maxR));
    for (let y = yMin; y <= yMax; y++) {
      for (let x = xMin; x <= xMax; x++) {
        const dx = x - mxC;
        const dy = y - myC;
        const rr = radius + (noise[y]?.[x] ?? 0);
        if (dx * dx + dy * dy < rr * rr) {
          if (hitTime[y]) hitTime[y][x] = now;
        }
      }
    }
    if (!animating) {
      animating = true;
      tick();
    }
  }

  pre.addEventListener('mousemove', onMove);
  return () => {
    pre.removeEventListener('mousemove', onMove);
    cancelAnimationFrame(raf);
  };
}

interface AsciiPanelProps {
  side: 'left' | 'right';
  /** Optional image to render as ascii instead of the baked-in hand art (e.g. "/images/footer-hand-left.png"). */
  src?: string;
}

/**
 * Renders one ascii panel. Prefers `src` (any image you drop in) and falls
 * back to the baked-in hand art if no src is given, it fails to load, or it
 * can't be sampled (e.g. a cross-origin image without CORS).
 */
const AsciiPanel = forwardRef<HTMLPreElement, AsciiPanelProps>(function AsciiPanel({ side, src }, ref) {
  const preRef = useRef<HTMLPreElement>(null);
  const gridRef = useRef<AsciiGrid>(EMPTY_GRID);
  useImperativeHandle(ref, () => preRef.current as HTMLPreElement);

  useEffect(() => {
    if (!preRef.current) return;
    // Bind to a variable with an explicit non-nullable type: `preRef.current`
    // is narrowed by the guard above, but that narrowing doesn't carry into
    // the nested function declarations below (they could, in principle, be
    // invoked at any time), so TS still sees it as possibly-null there.
    const el: HTMLPreElement = preRef.current;
    let cancelled = false;
    let loadedImage: HTMLImageElement | null = null;
    const fallbackGrid = side === 'left' ? FALLBACK_GRID_LEFT : FALLBACK_GRID_RIGHT;

    function applyGrid(grid: AsciiGrid) {
      if (cancelled || !grid.cols) return;
      gridRef.current = grid;
      el.textContent = grid.chars.map((row) => row.join('')).join('\n');
      applyFontSizeForRows(el, grid);
    }

    function useFallback() {
      applyGrid(fallbackGrid);
    }

    function rebuildFromImage() {
      if (!loadedImage) {
        useFallback();
        return;
      }
      const cols = window.innerWidth < 1400 ? 44 : 56;
      const grid = buildAsciiGridFromImage(loadedImage, loadedImage.naturalWidth, loadedImage.naturalHeight, cols, side === 'left' ? 11 : 97);
      if (grid.cols) {
        applyGrid(grid);
      } else {
        // Sampling failed (tainted canvas) — drop the bad image and use the fallback from here on.
        loadedImage = null;
        useFallback();
      }
    }

    if (src) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (cancelled) return;
        loadedImage = img;
        rebuildFromImage();
      };
      img.onerror = () => {
        if (cancelled) return;
        useFallback();
      };
      img.src = src;
      useFallback(); // show something immediately while the image loads
    } else {
      useFallback();
    }

    // The image path also needs its column count recomputed (viewport-
    // dependent); the baked art's grid is fixed, so it only needs a
    // font-size rescale to the new viewport height.
    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (src) rebuildFromImage();
        else applyFontSizeForRows(el, gridRef.current);
      }, 150);
    };
    window.addEventListener('resize', onResize);

    const detachHover = attachHover(el, () => gridRef.current);

    return () => {
      cancelled = true;
      detachHover();
      window.removeEventListener('resize', onResize);
      window.clearTimeout(resizeTimer);
    };
  }, [side, src]);

  return <pre ref={preRef} className={`footer-ascii footer-ascii-${side}`} aria-hidden="true" />;
});

interface Props {
  /** Drop-in art for each hand — any image works (it's sampled down to ascii by brightness). Falls back to the baked-in hand art when omitted. */
  leftSrc?: string;
  rightSrc?: string;
}

/**
 * Decorative ascii-art layer for the footer: two hand silhouettes rendered
 * as text (your own image if you pass one, otherwise the baked-in hand
 * art), sliding in from the edges as the footer enters view, drifting
 * toward the cursor, and rippling to denser characters on hover.
 */
export default function FooterAscii({ leftSrc, rightSrc }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const leftPreRef = useRef<HTMLPreElement>(null);
  const rightPreRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    ensureGsap();
    const wrap = wrapRef.current;
    const leftPanel = leftPanelRef.current;
    const rightPanel = rightPanelRef.current;
    if (!wrap || !leftPanel || !rightPanel) return;

    gsap.set(leftPanel, { xPercent: -100 });
    gsap.set(rightPanel, { xPercent: 100 });

    const trigger = ScrollTrigger.create({
      trigger: wrap,
      start: 'top bottom',
      end: 'top 40%',
      scrub: true,
      onUpdate: (self) => {
        gsap.set(leftPanel, { xPercent: -100 * (1 - self.progress) });
        gsap.set(rightPanel, { xPercent: 100 * (1 - self.progress) });
      },
    });

    // Mouse-follow drift + a touch of rotation, applied to the <pre>s
    // themselves rather than the panels above: GSAP writes `transform` as an
    // inline style, so sharing one element with the scroll-reveal tween
    // would make the two effects overwrite each other every frame.
    const leftPre = leftPreRef.current;
    const rightPre = rightPreRef.current;
    const setLeftX = leftPre ? gsap.quickTo(leftPre, 'x', { duration: 0.7, ease: 'power3.out' }) : null;
    const setLeftY = leftPre ? gsap.quickTo(leftPre, 'y', { duration: 0.7, ease: 'power3.out' }) : null;
    const setLeftRot = leftPre ? gsap.quickTo(leftPre, 'rotation', { duration: 0.7, ease: 'power3.out' }) : null;
    const setRightX = rightPre ? gsap.quickTo(rightPre, 'x', { duration: 0.7, ease: 'power3.out' }) : null;
    const setRightY = rightPre ? gsap.quickTo(rightPre, 'y', { duration: 0.7, ease: 'power3.out' }) : null;
    const setRightRot = rightPre ? gsap.quickTo(rightPre, 'rotation', { duration: 0.7, ease: 'power3.out' }) : null;

    let visible = false;
    const onMove = (e: MouseEvent) => {
      if (!visible) return;
      const nx = (e.clientX / window.innerWidth - 0.5) * 2; // -1..1
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      setLeftX?.(Math.min(0, nx * -40 - 12));
      setRightX?.(Math.max(0, nx * 40 + 12));
      setLeftY?.(ny * -22);
      setRightY?.(ny * -22);
      setLeftRot?.(nx * 4);
      setRightRot?.(-nx * 4);
    };
    window.addEventListener('mousemove', onMove, { passive: true });

    const io = new IntersectionObserver(
      (entries) => {
        visible = !!entries[0]?.isIntersecting;
      },
      { threshold: 0.05 }
    );
    io.observe(wrap);

    return () => {
      trigger.kill();
      io.disconnect();
      window.removeEventListener('mousemove', onMove);
    };
  }, []);

  return (
    <div ref={wrapRef} className="footer-ascii-wrap">
      <div ref={leftPanelRef} className="footer-ascii-panel left">
        <AsciiPanel ref={leftPreRef} side="left" src={leftSrc} />
      </div>
      <div ref={rightPanelRef} className="footer-ascii-panel right">
        <AsciiPanel ref={rightPreRef} side="right" src={rightSrc} />
      </div>
      {/* dangerouslySetInnerHTML avoids a React SSR/hydration text-escaping mismatch for raw-text elements like <style> */}
      <style dangerouslySetInnerHTML={{ __html: `
        .footer-ascii-wrap {
          position: absolute;
          inset: 0;
          display: flex;
          justify-content: space-between;
          overflow: hidden;
          pointer-events: none;
          z-index: 0;
        }
        .footer-ascii-panel {
          display: flex;
          align-items: center;
          height: 100%;
          width: 46%;
          max-width: 46%;
          overflow: hidden;
          will-change: transform;
        }
        .footer-ascii-panel.left {
          justify-content: flex-start;
        }
        .footer-ascii-panel.right {
          justify-content: flex-end;
        }
        .footer-ascii {
          /* letter-spacing 0.5em is load-bearing, not decorative: a
             monospace glyph's advance is ~0.6em, so 0.6 + 0.5 = 1.1em wide —
             matching line-height 1.1 gives a roughly square character cell.
             That's the aspect ratio this art was authored against; a
             smaller letter-spacing (however tempting for fit) squashes the
             hand shape horizontally instead of just shrinking it. Fit is
             controlled by font-size alone. */
          font-family: Consolas, Menlo, monospace;
          font-size: clamp(0.26rem, 0.5vw, 0.42rem);
          line-height: 1.1;
          letter-spacing: 0.5em;
          color: var(--accent);
          opacity: 0.85;
          white-space: pre;
          user-select: none;
          pointer-events: auto;
          cursor: default;
          margin: 0;
          will-change: transform;
        }
        .fa-hit {
          color: var(--bg);
          background: var(--accent);
        }
        @media (max-width: 1200px) {
          .footer-ascii-panel.right {
            display: none;
          }
        }
        @media (max-width: 640px) {
          .footer-ascii-wrap {
            display: none;
          }
        }
      ` }} />
    </div>
  );
}
