/**
 * Generates placeholder silhouette PNGs for the Shadow Box hero scene into
 * public/hero/. These are stand-ins for the real laser-cut lightbox
 * engravings — overwrite any of them with your own black-on-TRANSPARENT
 * PNG of the same filename and the scene picks it up with zero code changes
 * (Hero.tsx uses them as CSS alpha masks, so only the alpha channel matters;
 * dithered/stippled art works beautifully).
 *
 * Expected files (drop-in specs):
 *   clouds-ink.png  wide frieze strip, ~2000x460
 *   devil.png       standing figure, ~520x880
 *   cockatrice.png  rooster-dragon, ~720x640
 *   brain.png       frontal brain, ~420x560
 *   hand-left.png   hand entering from the LEFT edge, ~500x640
 *   hand-right.png  hand entering from the RIGHT edge, ~500x640
 *
 * If your exports have a white background instead of transparency, run
 * `node scripts/prep-hero-assets.mjs` after dropping them in.
 *
 * Usage: node scripts/hero-placeholders.mjs
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'hero');

/* Deterministic rng so regeneration is stable. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Medieval-print "lumpy blob" outline (clouds, brain lobes): walks an
 * ellipse and bulges outward with an arc between successive points. */
function lumpyBlob(cx, cy, rx, ry, lumps, rng, jitter = 0.14) {
  const pts = [];
  for (let i = 0; i < lumps; i++) {
    const a = (i / lumps) * Math.PI * 2;
    const j = 1 + (rng() * 2 - 1) * jitter;
    pts.push([cx + Math.cos(a) * rx * j, cy + Math.sin(a) * ry * j]);
  }
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i <= lumps; i++) {
    const [x, y] = pts[i % lumps];
    const [px, py] = pts[i - 1];
    const r = Math.hypot(x - px, y - py) / 1.55;
    d += ` A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d + ' Z';
}

function svgDoc(w, h, inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${inner}</svg>`;
}

/* ---------------------------------------------------------------- clouds */
function cloudsSvg() {
  const W = 2000;
  const H = 460;
  const rng = mulberry32(7);
  let inner = `<rect x="0" y="0" width="${W}" height="70" fill="#000"/>`;
  // bulging under-puffs along the band — two overlapping rows so the strip
  // reads as roiling cloud, not a solid awning
  let x = 20;
  while (x < W - 120) {
    const r = 55 + rng() * 45;
    const cy = 60 + rng() * 40;
    inner += `<circle cx="${x.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(0)}" fill="#000"/>`;
    x += r * (0.9 + rng() * 0.4);
  }
  x = 70;
  while (x < W - 160) {
    const r = 50 + rng() * 60;
    const cy = 135 + rng() * 55;
    inner += `<circle cx="${x.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(0)}" fill="#000"/>`;
    x += r * (1.3 + rng() * 0.6);
  }
  // two decorative curls hanging beneath
  const curl = (cx, cy, s) =>
    `<path d="M ${cx - 90 * s} ${cy - 40 * s} C ${cx - 30 * s} ${cy + 55 * s} ${cx + 70 * s} ${cy + 45 * s} ${cx + 62 * s} ${cy - 12 * s} C ${cx + 56 * s} ${cy - 46 * s} ${cx + 8 * s} ${cy - 44 * s} ${cx + 12 * s} ${cy - 14 * s}" fill="none" stroke="#000" stroke-width="${(20 * s).toFixed(0)}" stroke-linecap="round"/>`;
  inner += curl(360, 285, 1);
  inner += curl(1430, 275, 0.85);
  // the two hanging columns at the right end (like the engraving's towers)
  inner += `<rect x="1806" y="120" width="46" height="250" rx="10" fill="#000"/>`;
  inner += `<rect x="1878" y="120" width="46" height="290" rx="10" fill="#000"/>`;
  return svgDoc(W, H, inner);
}

/* ----------------------------------------------------------------- devil */
function devilSvg() {
  const inner = `
    <g fill="#000">
      <ellipse cx="265" cy="380" rx="88" ry="132" transform="rotate(-6 265 380)"/>
      <circle cx="262" cy="185" r="58"/>
      <path d="M 232 142 C 208 92 218 52 252 24 C 230 68 236 106 254 136 Z"/>
      <path d="M 292 142 C 316 92 306 52 272 24 C 294 68 288 106 270 136 Z"/>
      <path d="M 312 172 L 358 194 L 310 206 Z"/>
      <path d="M 300 224 l 12 22 l -20 -6 l 9 21 l -19 -8 l 5 19 l -15 -13 Z"/>
      <path d="M 216 276 C 152 210 96 184 54 194 C 90 216 100 240 92 266 C 130 256 152 276 148 306 C 176 296 196 316 196 346 C 206 330 214 320 222 314 Z"/>
      <path d="M 296 300 C 330 270 360 250 390 238 L 402 258 C 372 268 342 292 316 322 Z"/>
      <circle cx="398" cy="246" r="21"/>
      <path d="M 450 132 L 463 143 L 353 408 L 340 397 Z"/>
      <path d="M 236 480 C 226 560 220 640 212 718 L 258 718 C 252 640 254 560 262 490 Z"/>
      <path d="M 236 714 L 164 754 L 242 752 Z"/>
      <path d="M 298 478 C 306 558 310 638 314 716 L 268 718 C 268 640 266 558 262 490 Z"/>
      <path d="M 292 712 L 362 752 L 286 750 Z"/>
      <path d="M 152 588 L 187 546 L 192 594 Z"/>
    </g>
    <path d="M 202 470 C 130 500 100 540 108 585 C 114 622 152 636 176 616 C 192 602 186 574 166 570" fill="none" stroke="#000" stroke-width="21" stroke-linecap="round"/>`;
  return svgDoc(520, 880, inner);
}

/* ------------------------------------------------------------ cockatrice */
function cockatriceSvg() {
  const inner = `
    <g fill="#000">
      <ellipse cx="470" cy="330" rx="140" ry="150"/>
      <path d="M 540 270 C 556 210 558 165 545 122 L 602 142 C 598 192 586 238 566 280 Z"/>
      <circle cx="575" cy="115" r="48"/>
      <path d="M 540 85 C 534 54 556 38 566 60 C 570 30 596 28 599 55 C 616 34 632 50 623 76 Z"/>
      <path d="M 614 98 L 692 80 L 622 118 Z"/>
      <path d="M 618 122 L 680 147 L 616 138 Z"/>
      <path d="M 588 154 C 600 186 584 197 574 180 Z"/>
      <path d="M 430 202 C 350 120 258 68 174 64 C 200 95 206 126 190 152 C 240 152 262 182 253 216 C 300 210 323 240 316 280 C 356 276 381 302 378 336 C 395 316 411 300 429 292 Z"/>
      <path d="M 440 466 L 432 546 L 453 546 L 459 469 Z"/>
      <path d="M 504 460 L 512 540 L 533 538 L 522 462 Z"/>
      <path d="M 442 543 L 402 576 L 445 558 L 428 588 L 456 561 L 463 590 L 466 550 Z"/>
      <path d="M 512 537 L 476 574 L 517 553 L 505 585 L 530 556 L 541 584 L 540 545 Z"/>
      <path d="M 238 398 L 267 430 L 233 437 Z"/>
    </g>
    <path d="M 352 428 C 262 480 200 470 186 421 C 172 376 206 341 246 356 C 273 366 279 400 253 412" fill="none" stroke="#000" stroke-width="26" stroke-linecap="round"/>`;
  return svgDoc(720, 640, inner);
}

/* ----------------------------------------------------------------- brain */
function brainSvg() {
  const rng = mulberry32(11);
  const hemis = lumpyBlob(210, 175, 148, 132, 24, rng);
  const cereb = lumpyBlob(225, 345, 105, 54, 14, rng, 0.1);
  const inner = `
    <defs>
      <mask id="groove">
        <rect width="420" height="560" fill="#fff"/>
        <path d="M 208 40 C 200 100 216 160 204 230 C 200 262 208 284 212 300" fill="none" stroke="#000" stroke-width="10"/>
      </mask>
    </defs>
    <g fill="#000" mask="url(#groove)">
      <path d="${hemis}"/>
      <path d="${cereb}"/>
      <path d="M 195 355 C 200 402 210 440 230 472 L 260 460 C 241 432 232 396 230 360 Z"/>
    </g>`;
  return svgDoc(420, 560, inner);
}

/* ----------------------------------------------------------------- hands */
const POINTING_HAND = `
  M 40 640
  C 60 520 90 470 140 430
  C 152 400 166 370 200 350
  C 212 340 226 331 240 330
  C 275 300 320 220 345 150
  C 352 130 368 122 378 132
  C 388 142 384 158 376 172
  C 350 240 310 310 280 350
  C 310 360 345 380 352 405
  C 358 425 348 440 330 442
  C 300 446 270 430 255 415
  C 262 440 258 470 240 478
  C 250 492 244 516 224 520
  C 230 536 220 556 200 556
  C 170 560 140 570 120 600
  C 100 620 80 635 60 640 Z`;

const GRASPING_HAND = `
  M 40 640
  C 60 500 95 440 150 400
  C 175 380 205 360 235 355
  C 258 340 280 330 292 342
  C 300 352 296 366 284 372
  C 296 380 298 396 286 404
  C 298 412 296 430 282 436
  C 292 446 290 462 276 468
  C 284 480 278 494 264 496
  C 235 505 205 505 185 495
  C 150 520 120 560 100 600
  C 85 622 65 636 50 640 Z`;

function handLeftSvg() {
  return svgDoc(500, 640, `<path d="${POINTING_HAND}" fill="#000"/>`);
}

function handRightSvg() {
  // grasping hand mirrored to enter from the right, holding a rune-disc ring
  const inner = `
    <g transform="translate(500,0) scale(-1,1)">
      <path d="${GRASPING_HAND}" fill="#000"/>
      <circle cx="318" cy="408" r="88" fill="none" stroke="#000" stroke-width="26"/>
    </g>`;
  return svgDoc(500, 640, inner);
}

/* ------------------------------------------------------------------ main */
const FILES = {
  'clouds-ink.png': cloudsSvg(),
  'devil.png': devilSvg(),
  'cockatrice.png': cockatriceSvg(),
  'brain.png': brainSvg(),
  'hand-left.png': handLeftSvg(),
  'hand-right.png': handRightSvg(),
};

await mkdir(outDir, { recursive: true });
for (const [name, svg] of Object.entries(FILES)) {
  await sharp(Buffer.from(svg)).png().toFile(path.join(outDir, name));
  console.log('wrote', path.join('public', 'hero', name));
}
