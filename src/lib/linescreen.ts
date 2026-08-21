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
  /** Pointer bulge radius in CSS px; lines fatten toward the cursor. */
  hoverRadius?: number;
  /** Peak extra half-width under the cursor, as a fraction of the lane. */
  hoverGain?: number;
}

/** Backing-store cap — past 2x the extra pixels just cost fill rate. */
const MAX_DPR = 2;

/**
 * Owns one canvas's line-screen render.
 *
 * Mirrors createAsciiMosaic's contract on purpose — refresh/destroy, colour
 * read from the element's own CSS — so the two renderers stay swappable
 * behind one component. Unlike the mosaic there is no frame loop: the
 * screen is static, and only a pointer bulge or a resize repaints it.
 */
export function createLineScreen(canvas: HTMLCanvasElement, options: LineScreenOptions = {}) {
  const pixel = Math.max(1, options.pixel ?? 3);
  const pitch = Math.max(2, options.pitch ?? 3);
  const weight = options.weight ?? 0.72;
  const floorW = options.floor ?? 0.12;
  const opacityDefault = options.opacity ?? 0.62;
  const hoverRadius = options.hoverRadius ?? 90;
  const hoverGain = options.hoverGain ?? 0.9;

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
  let hoverRaf = 0;

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

    // Pointer in RENDERED pixels, so the bulge lands where the cursor
    // actually is regardless of the upscale factor.
    const hx = pointerX >= 0 ? pointerX / pixel : -1;
    const hy = pointerY / pixel;
    const hr = hoverRadius / pixel;
    const hr2 = hr * hr;

    for (let y = 0; y < oh; y++) {
      const toneOff = y * cols;
      const rowOff = y * ow;
      for (let c = 0; c < cols; c++) {
        const v = tone[toneOff + c] ?? 0;
        if (v <= 0.02) continue;
        const centre = (c + 0.5) * lane;
        let half = minHalf + (maxHalf - minHalf) * v;
        if (hx >= 0) {
          const dx = centre - hx;
          const dy = y - hy;
          const d2 = dx * dx + dy * dy;
          if (d2 < hr2) {
            const k = 1 - d2 / hr2;
            half += lane * hoverGain * 0.5 * k * k;
          }
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
  function scheduleHover() {
    if (hoverRaf) return;
    hoverRaf = requestAnimationFrame(() => {
      hoverRaf = 0;
      render();
    });
  }
  function onMove(e: MouseEvent) {
    // offsetX/Y, NOT clientX minus the bounding rect. Every hero layer is
    // laid out oversized and scaled back down by the stage's perspective
    // transform, so the bounding rect is the PROJECTED box (the brain: 347px
    // on screen) while everything else in here — clientWidth, the buffer,
    // the grain — is in the element's own LAYOUT space (731px). Subtracting
    // the rect hands back projected pixels, and dividing those by a layout
    // width put the hover at less than half the distance from the corner it
    // should have been. offsetX is already in the target's own untransformed
    // coordinates, which is the space the rest of this renderer speaks.
    pointerX = e.offsetX;
    pointerY = e.offsetY;
    scheduleHover();
  }
  function onLeave() {
    pointerX = -1;
    pointerY = -1;
    scheduleHover();
  }
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseleave', onLeave);

  return {
    setImage,
    refresh,
    destroy() {
      if (hoverRaf) cancelAnimationFrame(hoverRaf);
      themeObserver.disconnect();
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseleave', onLeave);
    },
  };
}
