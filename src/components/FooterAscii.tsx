import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { gsap, ScrollTrigger, ensureGsap } from '@/lib/gsap';

/** Character pools ordered from sparsest to densest — brightness picks a pool, hover swaps to its mirror. */
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

function roundedCapsule(ctx: CanvasRenderingContext2D, x: number, topY: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x - radius, 0);
  ctx.lineTo(x - radius, topY);
  ctx.arc(x, topY, radius, Math.PI, 0, false);
  ctx.lineTo(x + radius, 0);
  ctx.arc(x, 0, radius, 0, Math.PI, false);
  ctx.closePath();
  ctx.fill();
}

/** Draws a simple open-hand silhouette (palm + four fingers + thumb) — the built-in fallback when no image is supplied. */
function drawHand(ctx: CanvasRenderingContext2D, w: number, h: number, mirror: boolean) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  ctx.save();
  if (mirror) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }

  const palmCx = w * 0.5;
  const palmCy = h * 0.72;
  const palmRx = w * 0.32;
  const palmRy = h * 0.26;

  ctx.beginPath();
  ctx.ellipse(palmCx, palmCy, palmRx, palmRy, 0, 0, Math.PI * 2);
  ctx.fill();

  const fingers = [
    { dx: -0.26, len: 0.44, wid: 0.09, rot: -0.16 },
    { dx: -0.09, len: 0.56, wid: 0.1, rot: -0.04 },
    { dx: 0.09, len: 0.54, wid: 0.1, rot: 0.05 },
    { dx: 0.25, len: 0.4, wid: 0.09, rot: 0.2 },
  ];
  fingers.forEach((f) => {
    const baseX = palmCx + f.dx * w;
    const baseY = palmCy - palmRy * 0.55;
    ctx.save();
    ctx.translate(baseX, baseY);
    ctx.rotate(f.rot);
    roundedCapsule(ctx, 0, -f.len * h, (f.wid * w) / 2);
    ctx.restore();
  });

  ctx.save();
  ctx.translate(palmCx - palmRx * 0.9, palmCy - palmRy * 0.1);
  ctx.rotate(-0.85);
  roundedCapsule(ctx, 0, -h * 0.28, w * 0.1);
  ctx.restore();

  ctx.restore();
}

/**
 * Samples a source (canvas or already-loaded image) down to `cols` columns
 * and maps brightness to a character pool. Returns an empty grid (cols: 0)
 * if the source can't be read — e.g. a cross-origin image without CORS
 * headers taints the canvas — so the caller can fall back.
 */
function buildAsciiGrid(
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

function escapeChar(ch: string): string {
  if (ch === '<') return '&lt;';
  if (ch === '>') return '&gt;';
  if (ch === '&') return '&amp;';
  return ch;
}

/** Wires up hover-distortion on a <pre> given its current ascii grid (read via a getter so resizes/reloads stay live). */
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
  /** Optional image to render as ascii instead of the built-in hand silhouette (e.g. "/images/footer-hand-left.png"). */
  src?: string;
}

/**
 * Renders one ascii panel. Prefers `src` (any image you drop in) and falls
 * back to the procedural hand silhouette if no src is given, it fails to
 * load, or it can't be sampled (e.g. a cross-origin image without CORS).
 */
const AsciiPanel = forwardRef<HTMLPreElement, AsciiPanelProps>(function AsciiPanel({ side, src }, ref) {
  const preRef = useRef<HTMLPreElement>(null);
  const gridRef = useRef<AsciiGrid>(EMPTY_GRID);
  useImperativeHandle(ref, () => preRef.current as HTMLPreElement);

  useEffect(() => {
    const pre = preRef.current;
    if (!pre) return;
    let cancelled = false;
    let loadedImage: HTMLImageElement | null = null;

    const fallbackCanvas = document.createElement('canvas');
    fallbackCanvas.width = 240;
    fallbackCanvas.height = 300;
    const fctx = fallbackCanvas.getContext('2d');

    function applyGrid(grid: AsciiGrid) {
      if (cancelled || !grid.cols) return;
      gridRef.current = grid;
      pre.textContent = grid.chars.map((row) => row.join('')).join('\n');
    }

    function cols() {
      return window.innerWidth < 1400 ? 44 : 56;
    }

    function rebuildFallback() {
      if (!fctx) return;
      drawHand(fctx, fallbackCanvas.width, fallbackCanvas.height, side === 'right');
      applyGrid(
        buildAsciiGrid(fallbackCanvas, fallbackCanvas.width, fallbackCanvas.height, cols(), side === 'left' ? 11 : 97)
      );
    }

    function rebuild() {
      if (loadedImage) {
        const grid = buildAsciiGrid(loadedImage, loadedImage.naturalWidth, loadedImage.naturalHeight, cols(), side === 'left' ? 11 : 97);
        if (grid.cols) {
          applyGrid(grid);
          return;
        }
        // Sampling failed (tainted canvas) — drop the bad image and use the fallback from here on.
        loadedImage = null;
      }
      rebuildFallback();
    }

    if (src) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (cancelled) return;
        loadedImage = img;
        rebuild();
      };
      img.onerror = () => {
        if (cancelled) return;
        rebuild();
      };
      img.src = src;
    } else {
      rebuild();
    }

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(rebuild, 150);
    };
    window.addEventListener('resize', onResize);

    const detachHover = attachHover(pre, () => gridRef.current);

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
  /** Drop-in art for each hand — any image works (it's sampled down to ascii by brightness). Falls back to a procedural hand silhouette when omitted. */
  leftSrc?: string;
  rightSrc?: string;
}

/**
 * Decorative ascii-art layer for the footer: two hand silhouettes rendered
 * as text (your own image if you pass one, otherwise a built-in procedural
 * hand), sliding in from the edges as the footer enters view, drifting
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
          will-change: transform;
        }
        .footer-ascii-panel.left {
          justify-content: flex-start;
        }
        .footer-ascii-panel.right {
          justify-content: flex-end;
        }
        .footer-ascii {
          font-family: Consolas, Menlo, monospace;
          font-size: clamp(0.32rem, 0.45vw, 0.55rem);
          line-height: 1.1;
          letter-spacing: 0.4em;
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
