import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { buildAsciiGridFromImage, createAsciiMosaic } from '@/lib/ascii';
import { createLineScreen } from '@/lib/linescreen';
import { createDotScreen } from '@/lib/halftone';
import { createDither } from '@/lib/dither';

const TARGET_CELL_PX = 7; // ON-SCREEN glyph cell width to solve for — fine enough to keep the finger separation legible, coarse enough that each glyph still reads as a mark
const MAX_COLS = 140; // near-camera layers (the reaching hands) sit in a box far larger than the viewport, off-screen edges included — this bounds the grid instead of sampling detail nobody sees

/* Line-screen grain, in CSS px: PIXEL is the nearest-neighbour upscale
   (how chunky each rendered pixel looks) and LANE * PIXEL is the distance
   between line centres on screen. Both live here rather than in the
   renderer so the hero's grain is tuned next to the ascii cell size it
   sits beside. */
/* Much finer than the grain the hands wore when they carried this screen.
   A line screen has NO horizontal resolution inside a lane — the whole lane
   is one column of tone — so the lane count across the subject is the only
   thing deciding whether a figure survives. The hands were half the stage
   wide and could spend 5px lanes; the creatures are 16-19% wide and sit deep
   enough that the box is projected down again, which left the devil about 36
   lanes for a whole standing figure and rendered him as a striped smear. */
const LINE_PIXEL = 1;
const LINE_PITCH = 3;

/* Dot-screen grain, same units as the line screen. Finer on both counts
   because the layers wearing it (the creatures) are small and deep in the
   box: at the line screen's grain a 16%-wide prop only gets ~30 cells
   across, which is not enough lattice to resolve a horned figure from a
   blob. DOT_PIXEL 1 also keeps the dots round rather than square-ish. */
const DOT_PIXEL = 1;
const DOT_PITCH = 3;
/* Tone shaping for the dot screen. The `material` masks are bright almost
   everywhere (alpha = coverage x lightness of a lit panel), so an unshaped
   ramp parks most of the figure at full dot and the lattice reads as a grey
   slab. Crushing the mid-tones spreads the radii back out, which is where
   the printed-stipple character actually lives. */
const DOT_GAMMA = 1.4;

/* Stitch-screen grain. Coarser than the dot screen on purpose: a cell has to
   be wide enough to hold a legible x, and below ~5 rendered px the glyph
   alphabet collapses back into indistinguishable specks. CROSS_PITCH 6 lands
   5px marks with a 1px gutter, so the lattice stays visible between them. */
const CROSS_PIXEL = 1;
const CROSS_PITCH = 6;
/* Crushed harder than the dot screen's curve. The ramp is only eight marks
   long, and the material masks are bright nearly everywhere — at a gentle
   gamma almost the whole figure indexes into the top two (near-solid) marks
   and the stitching disappears under its own ink. Pushing the mid-tones down
   parks the bulk of the figure on the plain x, which is where the woven
   character actually lives. */
const CROSS_GAMMA = 1.6;
/* Higher than the dot screen's floor: an x is mostly negative space, so a
   cell has to carry real tone before it earns a mark. Left at the dot
   screen's 0.06 the mask's soft outer rim sprouts a wide halo of stray
   stitches and the figure loses its silhouette against the stage. */
const CROSS_CUTOFF = 0.12;

/* Screen angle, shared by both mark vocabularies. UPRIGHT, deliberately.
   Print screens a single colour at 45deg because an axis-aligned lattice is
   the most conspicuous arrangement there is, and turning it does measurably
   work here: axis-aligned lattice energy drops from 5.83 to 0.82 at 15deg.
   But it was tried at 15/30/45 and the upright screen simply looked better
   in the scene — the tilted lattice reads as a woven fabric laid over the
   art, where the upright one reads as the art's own grain. The measurement
   was answering a narrower question than the one that matters.

   Two things to know before reaching for this again. These marks are
   axis-aligned square stamps, not round dots, so the lattice can only turn
   as far as the stamps still clear each other (the renderer derives the
   stamp size from that, so a big angle silently shrinks the glyphs rather
   than fusing them). And the grid this was meant to break up is really the
   heavy end of the ramp saturating across neighbouring cells — the tone
   curve is the more direct lever on that. */
const SCREEN_ANGLE = 0;

/* Patch radius for the line screen, in ITS cells — a lane across, a band
   deep. Bigger than the number the stitch screens get because a line-screen
   cell is half a stitch cell (LINE_PITCH 3 against CROSS_PITCH 6), so it
   takes about twice as many of them to cover the same area of the picture.
   Both land the patch at roughly the same size on screen, which is the point:
   the cursor is one size, whatever grain it happens to be over. */
const LINE_PATCH_CELLS = 6;

interface Props {
  /** Built alpha-mask PNG in /hero (brain.png, hand-left.png, ...) — NOT the raw -source.png, which hasn't been through build-hero-masks.mjs's alpha extraction yet. */
  src: string;
  /** Varies the random glyph pick within a pool bucket so different panels don't share identical noise. */
  seed?: number;
  /** Patch radius in grid cells for the cursor effect. Cells, not px, so it
   * covers the same number of marks on every layer — see `patchRadius` in
   * lib/halftone.ts for why a px radius made the hands' patch three times
   * the brain's. */
  hoverRadius?: number;
  /** Which renderer draws this layer. 'ascii' is the symbol mosaic;
   * 'lines' is the engraving-style line screen (see lib/linescreen.ts);
   * 'dots' is the halftone dot screen and 'cross' the stitched glyph screen
   * (both lib/halftone.ts); 'dither' shows the art AS AUTHORED and only
   * glitches it under the cursor (lib/dither.ts). */
  variant?: 'ascii' | 'lines' | 'dots' | 'cross' | 'dither';
  /** Per-layer ink strength, overriding the variant's CSS default. A screen
   * inks at one fixed strength, which is right for a subject carrying real
   * tonal mass and wrong for hairline artwork: thin linework averaged into
   * cells lands in the middle of the ramp and the whole layer goes grey. */
  ink?: number;
  /** Share of cells re-rolling their mark each tick, 0 to freeze. The scene
   * derives this from the layer's depth — see churnForDepth in Hero.tsx. */
  churn?: number;
  /** Dresses this layer's cursor patch in the ACCENT — solid tiles with
   * their marks knocked out, the ascii mosaic's glitch. Off, the same patch
   * simply brightens: its marks come back at the top of their alphabet at
   * full strength. One layer wears the accent; see `accent` in
   * lib/halftone.ts. 'cross' only. */
  glitch?: boolean;
  /** Alternate mask used under the light theme. The creatures ship both a
   * `material` negative (bright figure, for the dark stage) and an `ink`
   * positive (the original black engraving, for paper) — the screens read
   * alpha as tone, so handing them the wrong one inverts the figure. */
  srcLight?: string;
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
export default function HeroAsciiArt({ src, seed = 61, hoverRadius = 3, variant = 'ascii', srcLight, ink, churn, glitch }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /* The renderers already re-read their COLOUR on a theme flip; swapping the
     source ART is a different job, and it has to re-enter the effect so the
     new image loads and re-rasterises. Starts on the dark source so SSR and
     the first client render agree, then corrects after mount. */
  const [light, setLight] = useState(false);

  useEffect(() => {
    if (!srcLight) return;
    const read = () => setLight(document.documentElement.dataset.theme === 'light');
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, [srcLight]);

  const source = light && srcLight ? srcLight : src;

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    let cancelled = false;
    let loadedImage: HTMLImageElement | null = null;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const renderer =
      variant === 'lines'
        ? createLineScreen(canvas, { pixel: LINE_PIXEL, pitch: LINE_PITCH, patchRadius: LINE_PATCH_CELLS })
        : variant === 'dots'
          ? createDotScreen(canvas, { pixel: DOT_PIXEL, pitch: DOT_PITCH, gamma: DOT_GAMMA, angle: SCREEN_ANGLE, churn: reducedMotion ? 0 : churn, patchRadius: hoverRadius })
          : variant === 'cross'
            ? createDotScreen(canvas, { mark: 'cross', pixel: CROSS_PIXEL, pitch: CROSS_PITCH, gamma: CROSS_GAMMA, cutoff: CROSS_CUTOFF, angle: SCREEN_ANGLE, churn: reducedMotion ? 0 : churn, accent: glitch, patchRadius: hoverRadius })
            : variant === 'dither'
              ? createDither(canvas)
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
      if (variant === 'dither') {
        // Needs the file's own dimensions: its buffer is sized off the ART,
        // not off the box, so that the 1-bit stipple is never resampled into
        // greys. See the note at the top of lib/dither.ts.
        (renderer as ReturnType<typeof createDither>).setImage(
          loadedImage,
          loadedImage.naturalWidth,
          loadedImage.naturalHeight
        );
        return;
      }
      if (variant !== 'ascii') {
        // Every screen rasterises straight off the source image at its own
        // fixed grain, so there is no grid for the caller to solve here.
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
    img.src = source;

    let resizeTimer = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(rebuild, 150);
    });
    /* device-pixel-content-box, not the default content box. Each renderer
       reads devicePixelRatio when it sizes its backing store, but only ever
       does so on a resize — and dragging the window to a monitor with a
       different pixel ratio changes no CSS size at all. The canvas then
       keeps a buffer scaled for the old display and the browser stretches
       it, which is about the worst thing that can happen to a screen whose
       whole character is hard-edged nearest-neighbour pixels. Watching the
       DEVICE pixel box catches the ratio change as a resize, because in
       device pixels it genuinely is one. */
    try {
      ro.observe(wrap, { box: 'device-pixel-content-box' });
    } catch {
      // Older engines: fall back to the CSS box and accept that a
      // monitor-to-monitor drag needs a real resize to correct itself.
      ro.observe(wrap);
    }

    /* Second path to the same correction, because there is no dpr event and
       the two signals fail in different places: device-pixel-content-box is
       unsupported on older engines, and this query does not fire under
       headless CDP emulation (it stops MATCHING, but dispatches nothing) —
       which is exactly how the ResizeObserver route got found. The query
       tests one exact ratio, so it has to be rebuilt from the new value
       every time it fires. */
    let dprQuery: MediaQueryList | null = null;
    const watchDpr = () => {
      dprQuery?.removeEventListener('change', onDpr);
      dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      dprQuery.addEventListener('change', onDpr);
    };
    function onDpr() {
      watchDpr();
      rebuild();
    }
    watchDpr();

    return () => {
      cancelled = true;
      ro.disconnect();
      dprQuery?.removeEventListener('change', onDpr);
      renderer.destroy();
      window.clearTimeout(resizeTimer);
    };
  }, [source, seed, hoverRadius, variant, churn, glitch]);

  return (
    <div ref={wrapRef} className="hero-ascii-art-wrap">
      {/* Inline, so it beats the variant's class rule — which sets the var on
          the canvas itself, where an inherited value would never reach. */}
      <canvas
        ref={canvasRef}
        className="hero-ascii-art"
        data-variant={variant}
        style={ink != null ? ({ '--linescreen-alpha': `${ink}` } as CSSProperties) : undefined}
        aria-hidden="true"
      />
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
          /* NOT auto. A canvas hit-tests as its BOX, and these layers are
             overlapping rectangles of mostly-empty art — so whichever
             rectangle sat nearest the camera took the cursor for everything
             behind it (measured: the clouds panel owned the top half of the
             brain, the cockatrice its bottom-right corner, and the brain's
             hover response was unreachable there). The renderers watch the
             window instead and each decides whether the cursor is over its
             own ART. See lib/pointer.ts. */
          pointer-events: none;
        }
        :root[data-theme='light'] .hero-ascii-art {
          --linescreen-alpha: 0.9;
        }
        /* The stitch screen inks harder than the hatching does. Its marks are
           small and mostly hollow, so at the line screen's strength the
           creatures read as a grey haze instead of as figures. */
        .hero-ascii-art[data-variant='cross'] {
          --linescreen-alpha: 0.72;
        }
        :root[data-theme='light'] .hero-ascii-art[data-variant='cross'] {
          --linescreen-alpha: 1;
        }
        /* The dithered engraving inks at full strength in both themes — the
           contrast is the reason it is here, and thinning it would undo the
           whole point of choosing it over a re-screened photo. */
        .hero-ascii-art[data-variant='dither'] {
          --linescreen-alpha: 1;
        }
      ` }} />
    </div>
  );
}
