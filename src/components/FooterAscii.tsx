import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { gsap, ScrollTrigger, ensureGsap } from '@/lib/gsap';
import { HAND_ASCII_LEFT, HAND_ASCII_RIGHT } from '@/data/hand-ascii';
import { POOLS, EMPTY_GRID, buildAsciiGridFromImage, createAsciiMosaic, type AsciiGrid } from '@/lib/ascii';

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
  const values: number[][] = [];
  for (const row of rows) {
    const rowChars = [...row];
    while (rowChars.length < cols) rowChars.push(' ');
    chars.push(rowChars);
    const rowPools = rowChars.map((ch) => CHAR_TO_POOL.get(ch) ?? -1);
    pools.push(rowPools);
    // No continuous brightness for baked text art — approximate it from
    // which pool the literal character came from, so opacity still varies.
    values.push(rowPools.map((p) => (p <= 0 ? -1 : p / (POOLS.length - 1))));
  }
  return { chars, pools, values, cols, rows: chars.length };
}

const FALLBACK_GRID_LEFT = gridFromAsciiArt(HAND_ASCII_LEFT);
const FALLBACK_GRID_RIGHT = gridFromAsciiArt(HAND_ASCII_RIGHT);

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
function applySizeForRows(canvas: HTMLCanvasElement, grid: AsciiGrid) {
  if (!grid.rows) return;
  const span = contentRowSpan(grid);
  const targetPx = Math.min(340, Math.max(220, window.innerHeight * 0.3));
  const cellPx = targetPx / (span * LINE_HEIGHT);
  canvas.style.width = `${(grid.cols * cellPx).toFixed(2)}px`;
  canvas.style.height = `${(grid.rows * cellPx).toFixed(2)}px`;
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
const AsciiPanel = forwardRef<HTMLCanvasElement, AsciiPanelProps>(function AsciiPanel({ side, src }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridRef = useRef<AsciiGrid>(EMPTY_GRID);
  useImperativeHandle(ref, () => canvasRef.current as HTMLCanvasElement);

  useEffect(() => {
    if (!canvasRef.current) return;
    // Bind to a variable with an explicit non-nullable type: `canvasRef.current`
    // is narrowed by the guard above, but that narrowing doesn't carry into
    // the nested function declarations below (they could, in principle, be
    // invoked at any time), so TS still sees it as possibly-null there.
    const el: HTMLCanvasElement = canvasRef.current;
    let cancelled = false;
    let loadedImage: HTMLImageElement | null = null;
    const fallbackGrid = side === 'left' ? FALLBACK_GRID_LEFT : FALLBACK_GRID_RIGHT;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mosaic = createAsciiMosaic(el, { churn: reducedMotion ? 0 : 0.1 });

    function applyGrid(grid: AsciiGrid) {
      if (cancelled || !grid.cols) return;
      gridRef.current = grid;
      applySizeForRows(el, grid);
      mosaic.setGrid(grid);
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
        if (src) {
          rebuildFromImage();
        } else {
          applySizeForRows(el, gridRef.current);
          mosaic.resize();
        }
      }, 150);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelled = true;
      mosaic.destroy();
      window.removeEventListener('resize', onResize);
      window.clearTimeout(resizeTimer);
    };
  }, [side, src]);

  return <canvas ref={canvasRef} className={`footer-ascii footer-ascii-${side}`} aria-hidden="true" />;
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
  const leftPreRef = useRef<HTMLCanvasElement>(null);
  const rightPreRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    ensureGsap();
    const wrap = wrapRef.current;
    const leftPanel = leftPanelRef.current;
    const rightPanel = rightPanelRef.current;
    if (!wrap || !leftPanel || !rightPanel) return;

    // Reduced-motion fallback: skip the slide-in scrub and the pointer-follow
    // drift entirely — the hands just render in place. The hover ripple (wired
    // in AsciiPanel) stays, since it's direct feedback to the user's own
    // pointer, not autonomous motion. Only reaches visitors with the OS-level
    // "reduce motion" setting.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

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
        /* Square cells are the art's authoring assumption — the hand shape
           shears if they aren't. The canvas box is sized in JS to
           cols x rows of one cell (applySizeForRows), so the aspect is set
           there and this rule only carries color and behavior. */
        .footer-ascii {
          display: block;
          color: var(--accent);
          --ascii-hit-bg: var(--accent);
          --ascii-hit-fg: var(--bg);
          opacity: 0.85;
          user-select: none;
          pointer-events: auto;
          cursor: none;
          will-change: transform;
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
