/**
 * Prepares real lightbox engravings for the Shadow Box hero: the scene uses
 * the PNGs in public/hero/ as CSS ALPHA masks, so art exported black-on-white
 * would render as a solid rectangle. This converts luminance to alpha
 * (black art -> opaque, white background -> transparent) in place, and is a
 * no-op-safe re-run: already-transparent art keeps its alpha shape.
 *
 * Drop your PNGs into public/hero/ (see scripts/hero-placeholders.mjs for
 * the expected filenames/sizes), then: node scripts/prep-hero-assets.mjs
 */
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'hero');

for (const name of await readdir(dir)) {
  if (!name.endsWith('.png')) continue;
  const file = path.join(dir, name);
  const img = sharp(file);
  const { hasAlpha } = await img.metadata();
  if (hasAlpha) {
    // If any real transparency exists, trust the export as-is.
    const alpha = await img.clone().extractChannel(3).stats();
    if (alpha.channels[0].min < 250) {
      console.log('skip (already transparent):', name);
      continue;
    }
  }
  // luminance -> alpha: dark ink becomes opaque black, white paper vanishes
  const { data, info } = await sharp(file)
    .flatten({ background: '#ffffff' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < info.width * info.height; i++) {
    out[i * 4] = 0;
    out[i * 4 + 1] = 0;
    out[i * 4 + 2] = 0;
    out[i * 4 + 3] = 255 - data[i];
  }
  await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(file + '.tmp');
  const { rename } = await import('node:fs/promises');
  await rename(file + '.tmp', file);
  console.log('converted to alpha:', name, `${info.width}x${info.height}`, (await stat(file)).size, 'bytes');
}
