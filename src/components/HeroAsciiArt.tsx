import { useEffect, useRef } from 'react';
import { buildAsciiGridFromImage, createAsciiMosaic } from '@/lib/ascii';
import { createLineScreen } from '@/lib/linescreen';

const TARGET_CELL_PX = 7; // ON-SCREEN glyph cell width to solve for — fine enough to keep the finger separation legible, coarse enough that each glyph still reads as a mark
const MAX_COLS = 140; // near-camera layers (the reaching hands) sit in a box far larger than the viewport, off-screen edges included — this bounds the grid instead of sampling detail nobody sees

/* Line-screen grain, in CSS px: PIXEL is the nearest-neighbour upscale
   (how chunky each rendered pixel looks) and LANE * PIXEL is the distance
   between line centres on screen. Both live here rather than in the
   renderer so the hero's grain is tuned next to the ascii cell size it
   sits beside. */
const LINE_PIXEL = 1.5;
const LINE_PITCH = 5;

interface Props {
  /** Built alpha-mask PNG in /hero (brain.png, hand-left.png, ...) — NOT the raw -source.png, which hasn't been through build-hero-masks.mjs's alpha extraction yet. */
  src: string;
  /** Varies the random glyph pick within a pool bucket so different panels don't share identical noise. */
  seed?: number;
  /** Ripple radius in grid cells for the hover glitch. */
  hoverRadius?: number;
  /** Which renderer draws this layer. 'ascii' is the symbol mosaic;
   * 'lines' is the engraving-style line screen (see lib/linescreen.ts). */
  variant?: 'ascii' | 'lines';
}

/**
 * Any lightbox engraving layer, rendered as the same sparse symbol mosaic as
 * the footer hands instead of a masked image — real content, hoverable,
 * glitching to denser glyphs under the cursor via the shared ascii ripple.
 *
 * The built masks are 'ink'/'dither' alpha-only art (build-hero-masks.mjs):
 * pure black RGB, all the signal is in alpha. Canvas antialiases the
 * downscale, so the shrunk alpha channel already IS local density —
 * sampling with density: 'alpha' reads that directly instead of luminance
 * (which would see uniform black ink and collapse every cell to one bucket).
 *
 * Sized off its own box (ResizeObserver), not the viewport: this panel sits
 * inside the hero's 3D dolly, where apparent size comes from a CSS
 * perspective transform on a fixed-layout box, not a layout resize.
 */
export default function HeroAsciiArt({ src, seed = 61, hoverRadius = 3, variant = 'ascii' }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    let cancelled = false;
    let loadedImage: HTMLImageElement | null = null;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const renderer =
      variant === 'lines'
        ? createLineScreen(canvas, { pixel: LINE_PIXEL, pitch: LINE_PITCH })
        : createAsciiMosaic(canvas, { hoverRadius, churn: reducedMotion ? 0 : 0.1 });

    // Cols is solved from the box's ACTUAL ON-SCREEN width (getBoundingClientRect,
    // post-perspective) rather than clientWidth or a fixed constant. clientWidth
    // is this layer's pre-projection layout size — deliberately pre-scaled up
    // (or, for near-camera layers, deliberately oversized so its hard export
    // edges sit off-screen) so translateZ inside the hero's perspective lands
    // it at the intended apparent size. Using that number here would badly
    // mis-set cols relative to what's actually visible.
    function rebuild() {
      if (!loadedImage || !wrap) return;
      const visualWidth = wrap.getBoundingClientRect().width;
      if (!visualWidth) return;
      if (variant === 'lines') {
        // The screen rasterises straight off the source image at its own
        // resolution, so there is no grid for the caller to solve here.
        (renderer as ReturnType<typeof createLineScreen>).setImage(loadedImage);
        return;
      }
      const cols = Math.min(MAX_COLS, Math.max(16, Math.round(visualWidth / TARGET_CELL_PX)));
      const next = buildAsciiGridFromImage(loadedImage, loadedImage.naturalWidth, loadedImage.naturalHeight, cols, seed, 'alpha');
      if (!next.cols) return;
      (renderer as ReturnType<typeof createAsciiMosaic>).setGrid(next);
    }

    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      loadedImage = img;
      rebuild();
    };
    img.src = src;

    let resizeTimer = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(rebuild, 150);
    });
    ro.observe(wrap);

    return () => {
      cancelled = true;
      ro.disconnect();
      renderer.destroy();
      window.clearTimeout(resizeTimer);
    };
  }, [src, seed, hoverRadius, variant]);

  return (
    <div ref={wrapRef} className="hero-ascii-art-wrap">
      <canvas ref={canvasRef} className="hero-ascii-art" aria-hidden="true" />
      {/* dangerouslySetInnerHTML avoids a React SSR/hydration text-escaping mismatch for raw-text elements like <style> */}
      <style dangerouslySetInnerHTML={{ __html: `
        .hero-ascii-art-wrap {
          position: absolute;
          inset: 0;
        }
        /* The canvas fills the layer box exactly, so the grid's cols:rows —
           taken from the source image's aspect, which the layer's own \`ar\`
           also matches — lands square cells on screen. */
        .hero-ascii-art {
          display: block;
          width: 100%;
          height: 100%;
          color: color-mix(in srgb, var(--fg) 96%, var(--bg));
          --ascii-hit-bg: var(--accent);
          --ascii-hit-fg: var(--bg);
          /* line-screen ink strength — see lib/linescreen.ts */
          --linescreen-alpha: 0.55;
          pointer-events: auto;
          cursor: none;
        }
        :root[data-theme='light'] .hero-ascii-art {
          --linescreen-alpha: 0.9;
        }
      ` }} />
    </div>
  );
}
