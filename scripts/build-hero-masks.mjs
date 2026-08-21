/**
 * Converts the raw lightbox engravings in art-src/hero/ into the alpha-mask
 * PNGs the Shadow Box hero consumes, written to public/hero/. Modes, per
 * source:
 *
 *  - "material": mask = alpha x lightness. The cut panel/figure renders
 *    solid (bright wood) and the engraved INK LINES become transparent
 *    slits — light bleeds through them like the physical lightbox.
 *    Used for the frieze and the engraved figures.
 *  - "ink": mask = alpha x darkness. The ink itself is the image — used
 *    for the dithered/stippled photographic hands.
 *  - "cutout": a photograph already masked to transparency. Takes the
 *    silhouette straight from the source alpha and writes the subject's
 *    CONTINUOUS shading into the output alpha. Unlike "ink" (which has to
 *    survive as line art) this keeps the full tonal range, which is what
 *    the ascii mosaic samples for density — so the form reads with real
 *    light and shadow instead of a flat silhouette. Auto-crops to the
 *    subject's own bounds, so the layer's `ar` in Hero.tsx MUST track what
 *    this emits or the art shears.
 *    Requires a real alpha channel. A source still sitting on its backdrop
 *    has to be masked first (in an editor) rather than segmented here —
 *    that was tried, and threshold heuristics chewed the wispy edges.
 *  - "photo": a rectangular photograph used as a whole PANEL, no silhouette
 *    involved — the far backdrop of the box. Luminance becomes alpha across
 *    the entire frame, tonally stretched across the photo's own range, so a
 *    screen has real light and shadow to sample. Unlike "cutout" there is no
 *    auto-crop (the frame IS the artwork) and no alpha floor: the darkest
 *    tones drop out COMPLETELY, which is what stops a full-width panel from
 *    reading as a rectangle with visible seams against the void.
 *    `invert: true` flips which end of the tonal range gets the ink. On the
 *    dark stage the glyphs are bone, so density follows LIGHT by default —
 *    for a landscape that inks the SKY and leaves the land open, which is
 *    usually backwards for a ridgeline and exactly right for a sunset.
 *
 * Re-run any time a source file is replaced: node scripts/build-hero-masks.mjs
 */
import path from 'node:path';
import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
/* Raw camera/scan art lives OUTSIDE public/ on purpose. Anything under
   public/ is copied verbatim into the build, so keeping the sources there
   published ~21MB of files no browser ever requests — 85% of the whole
   deploy. Drop new source art in art-src/hero/; only the built masks below
   belong in public/hero/. */
const srcDir = path.join(root, 'art-src', 'hero');
const dir = path.join(root, 'public', 'hero');

/* slot <- { src: raw export in art-src/hero/, mode, flop?, flip?, rotate?,
 *           crop? [left,top,w,h], largestOnly?, despeckle? (min ink-blob
 *           area in px to survive — kills scan grit along cut edges),
 *           invert?/gamma? (photo mode only) } */
const MAP = {
  // positive-space variant: the ink drawing itself (cloud linework + candle
  // outlines), no solid panel behind it; despeckled so scan grit along the
  // cut edges doesn't ride into the scene
  'clouds-ink.png': { src: 'clouds-frieze-source.png', mode: 'ink', despeckle: 140 },
  // largestOnly keeps just the connected figure — strips the tarot card's
  // floating stars/moon/numerals so no sky elements ride along with the prop
  'devil.png': { src: 'devil-tarot-source.png', mode: 'material', largestOnly: true },
  // flopped so it faces stage-center (it stands on the right side)
  'cockatrice.png': { src: 'cockatrice-tarot-source.png', mode: 'material', flop: true },
  // distant mountains, as in the physical lightbox: the cloud engraving
  // reused — candles cropped off, flipped so the wavy edge becomes the
  // ridgeline — same POSITIVE-SPACE treatment as clouds-ink (linework only,
  // no solid panel, despeckled) so they read as a faint far-off range behind
  // the brain rather than a solid wall (one mirrored variant for the far side)
  // the specific twin-peak/valley motif right beside the candle towers —
  // already peaks-up in its native orientation, no flip needed
  'mountains.png': { src: 'clouds-frieze-source.png', mode: 'ink', crop: [2900, 55, 620, 345], despeckle: 140 },
  // ink variants of the creatures for the light theme: there they render as
  // the original engravings — black ink on paper — instead of negatives
  'devil-ink.png': { src: 'devil-tarot-source.png', mode: 'ink', largestOnly: true },
  'cockatrice-ink.png': { src: 'cockatrice-tarot-source.png', mode: 'ink', flop: true },
  // The reaching hands, hand-dithered in Photoshop like the brain — same
  // trade, and it went the same way: the raw photo cutouts (still in
  // art-src/ as *-real.png) carry continuous shading, but the 1-bit stipple
  // has far more contrast and its dot pattern IS the texture.
  // NEVER flip or flop these — mirroring reverses handedness, so a left hand
  // comes out as a right one, which is glaring once a screen renders it with
  // enough tone to actually read as a hand.
  'hand-left.png': { src: 'left-hand-dither-source.png', mode: 'ink' },
  'hand-right.png': { src: 'right-hand-dither-source.png', mode: 'ink' },
  // The brain: the hand-dithered engraving, 1-bit black-and-white straight
  // out of Photoshop. A continuous-tone photo cutout of a real brain was
  // tried in its place (brain-real.png, still in art-src/) and lost — the
  // stipple's contrast is far punchier, and its dot pattern is the whole
  // texture of the piece. 'ink' mode is a no-op on a file that already
  // carries its shape in alpha, and still does the right thing if the
  // engraving is ever re-exported flat as black-on-white.
  'brain.png': { src: 'brain-dither-source.png', mode: 'ink' },
};

const EDGE_TRIM = 6; // px of canvas border cleared (scan/card-edge slivers)

/** 4-connected component labeling over an alpha plane. Returns per-pixel
 * labels (0 = background) plus the area of each label. */
function labelComponents(alpha, width, height, thresh = 40) {
  const labels = new Int32Array(width * height);
  const areas = [0];
  let next = 1;
  const stack = [];
  for (let start = 0; start < width * height; start++) {
    if (alpha[start] <= thresh || labels[start] !== 0) continue;
    const label = next++;
    areas[label] = 0;
    stack.push(start);
    labels[start] = label;
    while (stack.length) {
      const i = stack.pop();
      areas[label]++;
      const x = i % width;
      if (x > 0 && labels[i - 1] === 0 && alpha[i - 1] > thresh) { labels[i - 1] = label; stack.push(i - 1); }
      if (x + 1 < width && labels[i + 1] === 0 && alpha[i + 1] > thresh) { labels[i + 1] = label; stack.push(i + 1); }
      if (i >= width && labels[i - width] === 0 && alpha[i - width] > thresh) { labels[i - width] = label; stack.push(i - width); }
      if (i + width < width * height && labels[i + width] === 0 && alpha[i + width] > thresh) { labels[i + width] = label; stack.push(i + width); }
    }
  }
  return { labels, areas };
}

for (const [slot, { src, mode, flop, flip, rotate, crop, largestOnly, despeckle, invert, gamma }] of Object.entries(MAP)) {
  const srcPath = path.join(srcDir, src);
  try {
    await access(srcPath);
  } catch {
    console.log(`skip ${slot} — source not found: ${src}`);
    continue;
  }
  let pipeline = sharp(srcPath);
  if (crop) pipeline = pipeline.extract({ left: crop[0], top: crop[1], width: crop[2], height: crop[3] });
  if (rotate) pipeline = pipeline.rotate(rotate);
  if (flip) pipeline = pipeline.flip();
  if (flop) pipeline = pipeline.flop();
  if (mode === 'cutout') {
    // 1200px is well past what the mosaic can resolve (it tops out near 140
    // columns) but leaves headroom for the auto-crop to throw pixels away.
    const { data, info } = await pipeline
      .resize({ width: 1200, withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width, height } = info;
    const n = width * height;

    // The silhouette IS the source's alpha — the background was removed by
    // hand, so there is nothing to segment and no threshold to misjudge.
    // That also means the matte's own antialiased edge carries straight
    // through instead of being re-derived from a hard binary mask.
    const matte = new Float32Array(n);
    const lum = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      matte[i] = data[i * 4 + 3] / 255;
      lum[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    }

    // Tonal stretch across the subject's OWN range, measured only over
    // solidly-opaque pixels so the semi-transparent rim doesn't drag the
    // endpoints. This normalises where the tones sit without touching their
    // spacing, so contrast decisions already made in an editor survive.
    const inside = [];
    for (let i = 0; i < n; i++) if (matte[i] > 0.5) inside.push(lum[i]);
    inside.sort((a, b) => a - b);
    const lo = inside[Math.floor(inside.length * 0.03)] ?? 0;
    const hi = inside[Math.floor(inside.length * 0.97)] ?? 255;
    const range = Math.max(1e-4, hi - lo);
    // Density follows LIGHT: the stage is dark and the glyphs are bone, so
    // the lit face of the form has to be the dense part for it to read as a
    // lit object rather than its own negative. Shadows thin out and let the
    // scene behind show through, which is where the depth cue comes from.
    // FLOOR keeps the darkest recess from dropping out entirely and
    // breaking the silhouette.
    const FLOOR = 0.2;
    // The mosaic's own ramp costs a lot of headroom before a cell looks
    // present: alpha picks the glyph pool (sparse punctuation low down,
    // dense symbols only near the top) AND scales per-glyph opacity, so
    // both compound against mid-tones. A straight tonal mapping lands most
    // of the subject in thin marks at partial opacity and the whole thing
    // reads as a faint smudge. Lifting with a gamma pushes the lit face up
    // into the pools that actually render as mass. No S-curve here — the
    // sources arrive already contrast-graded, and stacking another one on
    // top crushes the mid-tones that carry the form.
    const GAMMA = 0.55;

    // Crop to the WHOLE subject plus a margin. An earlier version forced a
    // fixed portrait aspect here, which cannot contain a wide hand in a
    // landscape frame: the window sliced straight through the fingers and
    // left a dead-straight edge of dense glyphs across them. The subject's
    // own bounds decide the aspect instead, and the layer in Hero.tsx is
    // authored to whatever comes out.
    let minX = width, maxX = 0, minY = height, maxY = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (matte[y * width + x] <= 0.06) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.04);
    const cx = Math.max(0, minX - pad);
    const cy = Math.max(0, minY - pad);
    const cw = Math.min(width - cx, maxX - minX + 1 + pad * 2);
    const ch = Math.min(height - cy, maxY - minY + 1 + pad * 2);
    // Soften only the edges WE chose to cut. An edge that coincides with
    // the source frame is one the subject genuinely runs off (the forearm
    // leaving the photo), and fading there deletes real content — it ate
    // the outer slice of the arm. Those stay hard; the subject continues
    // past them, which is exactly what the framing wants to say.
    const FADE = Math.max(4, Math.round(Math.min(cw, ch) * 0.03));
    const fadeL = cx > 0 ? FADE : 0;
    const fadeR = cx + cw < width ? FADE : 0;
    const fadeT = cy > 0 ? FADE : 0;
    const fadeB = cy + ch < height ? FADE : 0;
    const rgba = Buffer.alloc(n * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const lit = Math.min(1, Math.max(0, (lum[i] - lo) / range));
        const shaped = Math.pow(lit, GAMMA);
        const edge = Math.min(
          1,
          fadeL ? (x - cx) / fadeL : 1,
          fadeR ? (cx + cw - 1 - x) / fadeR : 1,
          fadeT ? (y - cy) / fadeT : 1,
          fadeB ? (cy + ch - 1 - y) / fadeB : 1
        );
        const a = matte[i] * (FLOOR + shaped * (1 - FLOOR)) * Math.max(0, edge);
        rgba[i * 4 + 3] = Math.round(Math.min(1, a) * 255);
      }
    }

    await sharp(rgba, { raw: { width, height, channels: 4 } })
      .extract({ left: cx, top: cy, width: cw, height: ch })
      .resize(750)
      .png()
      .toFile(path.join(dir, slot));
    console.log(`built ${slot} <- ${src} (cutout, crop ${cw}x${ch} @ ${cx},${cy}, tone ${lo.toFixed(1)}..${hi.toFixed(1)})`);
    continue;
  }

  if (mode === 'photo') {
    // 1400px is past what any of the screens resolve across a backdrop this
    // wide, but keeps headroom if the panel is ever framed tighter.
    const { data, info } = await pipeline
      .resize({ width: 1400, withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width, height } = info;
    const n = width * height;

    const lum = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      lum[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    }
    // Stretch across the photo's OWN range, clipping the extreme 2% at each
    // end so a single blown highlight or black clipped shadow cannot decide
    // the mapping for the whole frame.
    const sorted = Float32Array.from(lum).sort();
    const lo = sorted[Math.floor(n * 0.02)] ?? 0;
    const hi = sorted[Math.floor(n * 0.98)] ?? 255;
    const range = Math.max(1e-4, hi - lo);
    const g = gamma ?? 0.8;

    const out = Buffer.alloc(n * 4);
    for (let i = 0; i < n; i++) {
      let t = Math.min(1, Math.max(0, (lum[i] - lo) / range));
      if (invert) t = 1 - t;
      out[i * 4 + 3] = Math.round(Math.pow(t, g) * 255);
    }
    await sharp(out, { raw: { width, height, channels: 4 } })
      .png()
      .toFile(path.join(dir, slot));
    console.log(`built ${slot} <- ${src} (photo, ${width}x${height}, tone ${lo.toFixed(1)}..${hi.toFixed(1)}${invert ? ', inverted' : ''}) — set the layer's ar to ${width}/${height}`);
    continue;
  }

  pipeline = pipeline.ensureAlpha();
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;

  const out = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const lum = (data[i] + data[i + 1] + data[i + 2]) / 3 / 255;
      const a = data[i + 3] / 255;
      const edge = x < EDGE_TRIM || y < EDGE_TRIM || x >= width - EDGE_TRIM || y >= height - EDGE_TRIM;
      const mask = edge ? 0 : mode === 'material' ? a * lum : a * (1 - lum);
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = Math.round(mask * 255);
    }
  }
  if (despeckle) {
    // kill faint scan noise, then drop ink blobs too small to be real
    // linework — the grit along imperfect cut edges vanishes, drawing stays
    for (let i = 0; i < width * height; i++) {
      if (out[i * 4 + 3] < 46) out[i * 4 + 3] = 0;
    }
    const alpha = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) alpha[i] = out[i * 4 + 3];
    const { labels, areas } = labelComponents(alpha, width, height, 40);
    for (let i = 0; i < width * height; i++) {
      const l = labels[i];
      if (l !== 0 && areas[l] < despeckle) out[i * 4 + 3] = 0;
    }
  }
  if (largestOnly) {
    // Connectivity must be judged on the SOURCE cutout's alpha (the figure
    // silhouette, solidly connected) — the material mask itself is
    // fragmented by its own ink lines and would amputate the figure.
    const srcAlpha = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) srcAlpha[i] = data[i * 4 + 3];
    const { labels, areas } = labelComponents(srcAlpha, width, height, 128);
    let keep = 0;
    for (let l = 1; l < areas.length; l++) if (areas[l] > areas[keep]) keep = l;
    for (let i = 0; i < width * height; i++) {
      if (labels[i] !== keep) out[i * 4 + 3] = 0;
    }
  }
  await sharp(out, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(path.join(dir, slot));
  console.log(`built ${slot} <- ${src} (${mode}, ${width}x${height})`);
}

/* ---- star glyphs: slice stars.png into individual particle masks ------- */
const GLYPH_COUNT = 8;
try {
  const starsSrc = path.join(srcDir, 'stars.png');
  await access(starsSrc);
  const { data, info } = await sharp(starsSrc)
    .flatten({ background: '#ffffff' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const alpha = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const lum = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
    alpha[i] = 255 - lum; // ink -> opaque
  }
  const { labels, areas } = labelComponents(alpha, width, height, 60);
  const boxes = new Map();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const l = labels[y * width + x];
      if (l === 0) continue;
      const b = boxes.get(l) ?? { minX: x, maxX: x, minY: y, maxY: y };
      if (x < b.minX) b.minX = x;
      if (x > b.maxX) b.maxX = x;
      if (y < b.minY) b.minY = y;
      if (y > b.maxY) b.maxY = y;
      boxes.set(l, b);
    }
  }
  const glyphs = [...boxes.entries()]
    .filter(([l]) => areas[l] >= 60)
    .sort((a, b) => areas[b[0]] - areas[a[0]])
    .slice(0, GLYPH_COUNT);
  for (let g = 0; g < GLYPH_COUNT; g++) {
    const [label, b] = glyphs[g % glyphs.length];
    const bw = b.maxX - b.minX + 1;
    const bh = b.maxY - b.minY + 1;
    const side = Math.max(bw, bh) + 8; // square canvas so ar stays 1
    const ox = Math.floor((side - bw) / 2);
    const oy = Math.floor((side - bh) / 2);
    const buf = Buffer.alloc(side * side * 4);
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        const si = (b.minY + y) * width + (b.minX + x);
        if (labels[si] !== label) continue;
        const di = ((oy + y) * side + (ox + x)) * 4;
        buf[di + 3] = alpha[si];
      }
    }
    await sharp(buf, { raw: { width: side, height: side, channels: 4 } })
      .png()
      .toFile(path.join(dir, `spark-${g}.png`));
  }
  console.log(`built ${GLYPH_COUNT} spark glyphs from stars.png (${glyphs.length} unique)`);
} catch {
  console.log('skip spark glyphs — stars.png not found');
}
