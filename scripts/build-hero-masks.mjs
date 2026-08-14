/**
 * Converts the raw lightbox engravings in public/hero/ into the alpha-mask
 * PNGs the Shadow Box hero consumes. Two conversion modes, per source:
 *
 *  - "material": mask = alpha x lightness. The cut panel/figure renders
 *    solid (bright wood) and the engraved INK LINES become transparent
 *    slits — light bleeds through them like the physical lightbox.
 *    Used for the frieze and the engraved figures.
 *  - "ink": mask = alpha x darkness. The ink itself is the image — used
 *    for the dithered/stippled photographic hands.
 *
 * Re-run any time a source file is replaced: node scripts/build-hero-masks.mjs
 */
import path from 'node:path';
import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'hero');

/* slot <- { src: raw export in public/hero/, mode, flop?, flip?, rotate?,
 *           crop? [left,top,w,h], largestOnly?, despeckle? (min ink-blob
 *           area in px to survive — kills scan grit along cut edges) } */
const MAP = {
  'clouds.png': { src: 'Group 1-2.png', mode: 'material' },
  // positive-space variant: the ink drawing itself (cloud linework + candle
  // outlines), no solid panel behind it; despeckled so scan grit along the
  // cut edges doesn't ride into the scene
  'clouds-ink.png': { src: 'Group 1-2.png', mode: 'ink', despeckle: 140 },
  // largestOnly keeps just the connected figure — strips the tarot card's
  // floating stars/moon/numerals so no sky elements ride along with the prop
  'devil.png': { src: '04c0843e119df1ba5b48cf7ee0d43da7.png', mode: 'material', largestOnly: true },
  // flopped so it faces stage-center (it stands on the right side)
  'cockatrice.png': { src: '89f5a844b4a3042ba66d17bc93a00d28.png', mode: 'material', flop: true },
  // distant mountains, as in the physical lightbox: the cloud engraving
  // reused — candles cropped off, flipped so the wavy edge becomes the
  // ridgeline — same POSITIVE-SPACE treatment as clouds-ink (linework only,
  // no solid panel, despeckled) so they read as a faint far-off range behind
  // the brain rather than a solid wall (one mirrored variant for the far side)
  // the specific twin-peak/valley motif right beside the candle towers —
  // already peaks-up in its native orientation, no flip needed
  'mountains.png': { src: 'Group 1-2.png', mode: 'ink', crop: [2900, 55, 620, 345], despeckle: 140 },
  // ink variants of the creatures for the light theme: there they render as
  // the original engravings — black ink on paper — instead of negatives
  'devil-ink.png': { src: '04c0843e119df1ba5b48cf7ee0d43da7.png', mode: 'ink', largestOnly: true },
  'cockatrice-ink.png': { src: '89f5a844b4a3042ba66d17bc93a00d28.png', mode: 'ink', flop: true },
  'hand-left.png': { src: '20260215_113326.png', mode: 'ink' },
  'hand-right.png': { src: '20260215_113355.png', mode: 'ink' },
  // The user's frontal lightbox brain stipple, re-dithered at display
  // resolution: the blur in dither mode reconstructs continuous tone from
  // the existing dots, then Floyd-Steinberg lays down a clean new stipple.
  'brain.png': { src: 'brain-lightbox.png', mode: 'dither' },
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

for (const [slot, { src, mode, flop, flip, rotate, crop, largestOnly, despeckle }] of Object.entries(MAP)) {
  const srcPath = path.join(dir, src);
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
  if (mode === 'dither') {
    // white-paper sources: flatten, blur to reconstruct continuous tone from
    // any existing stipple, resize to display grain
    pipeline = pipeline.flatten({ background: '#ffffff' }).blur(1.6).resize(460);
  }
  pipeline = pipeline.ensureAlpha();
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;

  if (mode === 'dither') {
    // tone -> 1-bit stipple: dot density follows darkness (same language as
    // the dithered hand exports). Near-white after the flatten = paper =
    // outside the object.
    const dark = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const lum = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
      dark[i] = lum > 242 ? 0 : (1 - lum / 255) * 0.94 + 0.05;
    }
    const out = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const v = dark[i];
        const dot = v > 0.5 ? 1 : 0;
        const err = v - dot;
        if (x + 1 < width) dark[i + 1] += err * 7 / 16;
        if (y + 1 < height) {
          if (x > 0) dark[i + width - 1] += err * 3 / 16;
          dark[i + width] += err * 5 / 16;
          if (x + 1 < width) dark[i + width + 1] += err * 1 / 16;
        }
        out[i * 4 + 3] = dot ? 255 : 0;
      }
    }
    await sharp(out, { raw: { width, height, channels: 4 } })
      .png()
      .toFile(path.join(dir, slot));
    console.log(`built ${slot} <- ${src} (dither, ${width}x${height})`);
    continue;
  }

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
  const starsSrc = path.join(dir, 'stars.png');
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
