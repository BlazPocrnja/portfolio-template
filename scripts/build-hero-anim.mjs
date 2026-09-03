/**
 * Builds the hero's ANIMATED plates — the layers whose art is a sheet of
 * stills the scroll steps through rather than one picture — into
 * public/hero/<slot>.png (+ -ink), as a grid frame ATLAS.
 *
 * Two of them so far, both the same tarot engravings as their stills, both
 * animated by Firefly: the devil lifts his chin and breathes fire, and the
 * cockatrice beats its wings. Each clip is decoded here, run through the
 * SAME material/ink mask maths as build-hero-masks.mjs, and tiled into one
 * PNG so the runtime can show frame N by drawing a sub-rect — no video
 * element, no seeking, and a frame index that is a pure function of scroll.
 * Hero.tsx maps the dolly onto them; see THE FLYBY there.
 *
 * WHY A BROWSER DECODES IT
 *
 * There is no ffmpeg in this toolchain and sharp does not read video. Chrome
 * does, it is already on any machine that builds this, and it is driven here
 * over CDP with nothing but node's own WebSocket — no new dependency. The
 * frames come back as PNG data URLs and everything after that is sharp, like
 * every other asset in scripts/.
 *
 * WHY THE MASKS ARE DERIVED, NOT COPIED
 *
 * `material` (the dark stage) is a straight port: mask = alpha x lightness,
 * and the clips' backgrounds are pure black at full alpha, so the background
 * falls to zero for free and the ink lines become transparent slits exactly
 * as they do on the stills.
 * `ink` (paper) cannot be. mask = alpha x DARKNESS would ink the black
 * background solid across the whole frame, because a video has no alpha to
 * multiply it away. So the silhouette is recovered first — a flood fill
 * inwards from the frame border across everything dark — and that matte
 * stands in for the still's hand-cut alpha. Dark pixels ENCLOSED by the
 * figure are never reached by the fill, which is mostly the point: they are
 * the engraving's own lines and they have to stay. The exception is the
 * background the figure happens to wall in — see THE HOLES.
 *
 * WHY ONE BOUNDING BOX FOR ALL FRAMES
 *
 * Each frame is cropped to the UNION of every frame's bounds, not its own.
 * Per-frame crops would each be tight to a different silhouette, so the
 * figure would jitter against the layer box as it moves — the crop would be
 * animating, not the creature. It also means a layer's `w`/`ar`/`y` in
 * Hero.tsx describe THIS box, not the still's, and have to be re-derived
 * when a clip is replaced (the tail of this script prints what it measured).
 *
 * Re-run when a clip changes: node scripts/build-hero-anim.mjs [name ...]
 */
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'art-src', 'hero');
const outDir = path.join(root, 'public', 'hero');
/* One entry per animated layer.
 *
 * `start`/`span` cut a WINDOW out of the clip, in seconds, and the window is
 * allowed to run past the end and wrap — the clips are loops, so t and
 * t + duration are the same pose. That matters because a window is rarely
 * the whole clip:
 *
 *  - the DEVIL's loop is one gesture (chin, jaw, flame, out) followed by
 *    nine frames of him standing there having finished. Sampling those is
 *    two thirds of a megabyte of one pose, so the window stops at the end of
 *    the arc.
 *  - the COCKATRICE's loop has its deepest downstroke CLIPPED, and its loop
 *    point is not seamless, so its window has to dodge both. See its entry.
 *
 * `frames` is how many stills the window is cut into. The plate is only
 * re-rasterised when the index CHANGES, so this is also the number of times
 * the renderer does any work across the entire dolly — the reason these are
 * atlases and not scrubbed <video>s. 20 holds roughly the clips' own ~7fps.
 * Stepping is the right register anyway: everything else here is a 1-bit
 * plate.
 *
 * `frameW` is the emitted frame width. The devil's 555 matches his still so
 * he rasterises at the grain the layer was tuned at; the cockatrice's box is
 * far wider than its still's (it has to hold a wingspan the standing pose
 * never needed) so it gets more pixels for the same figure. */
const CLIPS = {
  devil: {
    src: 'devil-breath-source.mp4',
    slot: 'devil-anim.png',
    slotInk: 'devil-anim-ink.png',
    start: 0,
    span: 2.62,
    frames: 20,
    frameW: 555,
  },
  cockatrice: {
    src: 'cockatrice-flap-source.mp4',
    slot: 'cockatrice-anim.png',
    slotInk: 'cockatrice-anim-ink.png',
    /* The clip's OTHER clean stretch, and the only window that satisfies all
       three things this layer needs at once. Two earlier ones did not:

        - 2.167 -> 4.0 -> 0.77 WRAPPED, and this clip's loop is not actually
          seamless. The bird stopped mid-stroke and snapped back to something
          very like its resting pose a third of the way through — a visible
          hitch. Any window that crosses t=4.0 has it.
        - 3.667 -> 1.5 ran BACKWARDS to get the resting pose into frame 0 and
          the wings' full spread at the flyby, which are otherwise in the
          wrong order. It reads as wrong. A wingbeat is not symmetric enough
          to survive reversal: the recovery is slower than the stroke, and
          played backwards a bird looks like it is being pulled through the
          air rather than driving itself through it.

       Forward, no wrap, and 0 is the pose the still had — upright, wings
       folded back. What follows is one whole beat: the wings open, sweep
       down and forward as the body extends, then come back up spread, which
       is where the flyby catches it. It stops at 0.85 because the deepest
       downstroke, from 0.9 to 1.45, is CLIPPED by the bottom of the video —
       the near wing swings below the frame and comes back with a
       dead-straight edge across it (measured: the figure clears the bottom
       edge by 172px all through the loop and by 0 across that span).
       0.85s is short, but the sheet's smoothness is set by its FRAME COUNT,
       not by how much of the clip it spans. */
    start: 0,
    span: 2.4,
    frames: 20,
    frameW: 700,
  },
};

/* Alpha is quantised to this many levels before the PNG is written. The mask
   is continuous tone and twenty copies of it is the largest asset in the
   scene; at 12 levels a plate is indistinguishable from the unquantised one
   at 1:1 (checked against devil.png's own grain) and the file drops by a
   third, because what PNG is really paying for here is the clips' video
   noise.
   DENOISING IT IS NOT AN OPTION, though it is worth three times as much:
   a 3x3 median takes the devil from 1.9MB to 765KB and turns the engraving's
   stipple into soft blotches. That stipple is the whole reason these layers
   are drawn by lib/dither.ts rather than re-screened — see its header. */
const ALPHA_STEPS = 12;

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

function findChrome() {
  for (const c of CHROME_CANDIDATES) if (fs.existsSync(c)) return c;
  throw new Error('No Chrome/Edge found — this script needs one to decode the mp4.');
}

/** Decodes `count` evenly-spaced stills out of the window [start, start+span]
 *  of the clip, wrapping past the end — the clips are loops, so a window may
 *  legitimately run through t=duration and out the other side. */
async function decodeFrames(videoPath, { start, span, count }) {
  const size = fs.statSync(videoPath).size;
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/clip.mp4')) {
      /* RANGE REQUESTS ARE NOT OPTIONAL. Chrome's media stack seeks by
         asking for byte ranges; served a plain 200 it can only ever play
         forward through what it happened to buffer, and every
         `currentTime =` below is silently ignored — which produces N copies
         of frame 0 rather than an error. */
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
      const head = { 'content-type': 'video/mp4', 'accept-ranges': 'bytes' };
      if (!range) {
        res.writeHead(200, { ...head, 'content-length': size });
        return fs.createReadStream(videoPath).pipe(res);
      }
      const start = range[1] ? Number(range[1]) : 0;
      const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
      res.writeHead(206, {
        ...head,
        'content-range': `bytes ${start}-${end}/${size}`,
        'content-length': end - start + 1,
      });
      return fs.createReadStream(videoPath, { start, end }).pipe(res);
    }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<!doctype html><body><video id=v src="/clip.mp4" muted playsinline preload=auto></video><canvas id=c></canvas>');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'devil-anim-'));
  const dbg = 9411;
  const chrome = spawn(findChrome(), [
    '--headless=new', '--remote-debugging-port=' + dbg, '--user-data-dir=' + profile,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--mute-audio',
    'http://127.0.0.1:' + port + '/',
  ], { stdio: 'ignore' });

  let wsUrl = null;
  for (let i = 0; i < 120 && !wsUrl; i++) {
    await new Promise((r) => setTimeout(r, 200));
    try {
      const list = await (await fetch('http://127.0.0.1:' + dbg + '/json/list')).json();
      const page = list.find((t) => t.type === 'page' && t.url.includes(String(port)));
      wsUrl = page ? page.webSocketDebuggerUrl : null;
    } catch { /* browser not up yet */ }
  }
  if (!wsUrl) { chrome.kill(); server.close(); throw new Error('headless browser never came up'); }

  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const evaluate = async (expression) => {
    const r = await new Promise((res) => {
      const mid = ++id;
      pending.set(mid, res);
      ws.send(JSON.stringify({ id: mid, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
    });
    if (r.result && r.result.exceptionDetails) {
      throw new Error(r.result.exceptionDetails.text || JSON.stringify(r.result.exceptionDetails));
    }
    return r.result && r.result.result ? r.result.result.value : undefined;
  };

  try {
    /* The debugger attaches to the target as soon as it exists, which is
       before its document does — so the <video> may still be nothing at all
       for the first evaluate or two. Wait for it rather than racing it. */
    for (let i = 0; i < 100; i++) {
      if (await evaluate("!!document.getElementById('v')")) break;
      await new Promise((r) => setTimeout(r, 100));
    }

    /* Held until the whole clip is buffered, not merely playable. Seeking
       into an unbuffered region is the slow path and, on a source this
       small, waiting once is cheaper than N range round-trips.
       readyState is CHECKED, not just listened for: the poll above can burn
       enough time for a local 4MB file to finish buffering before this
       runs, and an event that has already fired never fires again — which
       hangs the build outright rather than failing it. */
    const meta = await evaluate(
      "(async()=>{const v=document.getElementById('v');" +
      "if(v.error)throw new Error('decode failed: '+v.error.message);" +
      "if(v.readyState<4)await new Promise((r,j)=>{v.oncanplaythrough=r;" +
      "v.onerror=()=>j(new Error('decode failed'))});" +
      "return {w:v.videoWidth,h:v.videoHeight,dur:v.duration};})()"
    );

    const frames = [];
    for (let i = 0; i < count; i++) {
      /* Sampled INCLUSIVE of both ends of the window: frame 0 is the pose the
         layer holds before the dolly starts and the last is where it ends up,
         and the mapping in Hero.tsx needs to be able to land on both exactly.
         Wrapped into the clip, so a window may cross the loop point. */
      /* `span` may be NEGATIVE, which runs the window backwards through the
         clip — see the cockatrice's entry for why that is sometimes the only
         way to get both the right resting pose and the right peak. Modulo
         has to be the positive kind for that to wrap correctly. */
      const raw = start + (i / (count - 1)) * span;
      let t = ((raw % meta.dur) + meta.dur) % meta.dur;
      t = Math.min(Math.max(t, 0), meta.dur - 0.001);
      const shot = await evaluate(
        "(async()=>{const v=document.getElementById('v'),c=document.getElementById('c');" +
        "c.width=v.videoWidth;c.height=v.videoHeight;" +
        "if(Math.abs(v.currentTime-" + t + ")>1e-3){v.currentTime=" + t + ";" +
        "await new Promise(r=>{v.onseeked=r});}" +
        "c.getContext('2d').drawImage(v,0,0);" +
        "return {at:v.currentTime,url:c.toDataURL('image/png')};})()"
      );
      /* A seek that goes nowhere is the failure mode this script had, and it
         is invisible downstream — it just yields one pose repeated. Fail loud
         instead. Tolerance is a shade over a frame at 30fps. */
      if (Math.abs(shot.at - t) > 0.04) {
        throw new Error('seek to ' + t.toFixed(3) + 's landed at ' + shot.at.toFixed(3) + 's — the clip is not seekable');
      }
      frames.push(Buffer.from(shot.url.split(',')[1], 'base64'));
      process.stdout.write('\r  decoded ' + (i + 1) + '/' + count);
    }
    process.stdout.write('\n');
    return { frames, w: meta.w, h: meta.h, dur: meta.dur };
  } finally {
    ws.close(); chrome.kill(); server.close();
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* windows file locks */ }
  }
}

/** The figure's matte: everything the background flood fill can NOT reach.
 * Dark pixels walled in by the figure are its own ink lines, and they stay. */
function backgroundFill(lum, w, h, thresh) {
  const outside = new Uint8Array(w * h);
  const stack = [];
  const push = (i) => { if (!outside[i] && lum[i] <= thresh) { outside[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w;
    if (x > 0) push(i - 1);
    if (x + 1 < w) push(i + 1);
    if (i >= w) push(i - w);
    if (i + w < w * h) push(i + w);
  }
  return outside;
}

/* THE HOLES. The flood fill above comes in from the frame border, so it can
 * only find background that the border can REACH — and the devil encloses
 * two pieces of it that it cannot: the eye of his own tail, and the wedge
 * between his chin and the arm holding the snakes. Left in the matte those
 * two read as figure, which costs the dark stage nothing (they are black, so
 * material's alpha x lightness zeroes them anyway) and wrecks the light one,
 * where ink prints DARKNESS and they came out as solid black slabs.
 *
 * They are separated from the engraving's own dark by how dark they are, and
 * the two populations do not overlap at all: measured over the clip, walled-in
 * BACKGROUND averages luminance 1, while every enclosed piece of drawing —
 * the open mouth included, which has to stay black — averages 10 to 13. So a
 * blob is a hole if its MEAN is at the floor, and the mouth is never in
 * danger. Judged on the mean and not on area or shape because a big dark
 * passage of engraving is a perfectly ordinary thing for this plate to have.
 *
 * Per frame, not once: the figure moves, so what it walls in moves with it. */
const HOLE_LUM = 6;
function openEnclosedHoles(lum, outside, w, h, thresh) {
  const n = w * h;
  const seen = new Uint8Array(n);
  for (let s = 0; s < n; s++) {
    if (lum[s] > thresh || outside[s] || seen[s]) continue;
    const stack = [s];
    const blob = [];
    seen[s] = 1;
    let sum = 0;
    while (stack.length) {
      const i = stack.pop();
      blob.push(i);
      sum += lum[i];
      const x = i % w;
      const step = (j) => { if (!seen[j] && !outside[j] && lum[j] <= thresh) { seen[j] = 1; stack.push(j); } };
      if (x > 0) step(i - 1);
      if (x + 1 < w) step(i + 1);
      if (i >= w) step(i - w);
      if (i + w < n) step(i + w);
    }
    if (sum / blob.length <= HOLE_LUM) for (const i of blob) outside[i] = 1;
  }
}

const BG = 30; // luminance at or under which a pixel may be background

async function buildClip(name, cfg) {
  const videoPath = path.join(srcDir, cfg.src);
  if (!fs.existsSync(videoPath)) {
    console.log('skip ' + name + ' — source not found: ' + cfg.src);
    return;
  }

  console.log('\n' + name + ': decoding ' + cfg.src + ' ...');
  const { frames, w, h, dur } = await decodeFrames(videoPath, { start: cfg.start, span: cfg.span, count: cfg.frames });
  console.log('  ' + w + 'x' + h + ', ' + dur.toFixed(2) + 's clip -> ' + cfg.frames +
    ' frames over t ' + cfg.start + '..' + (cfg.start + cfg.span).toFixed(2) + (cfg.start + cfg.span > dur ? ' (wrapping)' : ''));

  /* Pass one: luminance and silhouette per frame, plus the union of every
     frame's bounds. The masks themselves are built in pass two, off these. */
  const n = w * h;
  const lums = [];
  const outsides = [];
  let minX = w, maxX = 0, minY = h, maxY = 0;
  for (let f = 0; f < frames.length; f++) {
    const { data } = await sharp(frames[f]).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const lum = new Uint8Array(n);
    for (let i = 0; i < n; i++) lum[i] = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
    const outside = backgroundFill(lum, w, h, BG);
    openEnclosedHoles(lum, outside, w, h, BG);
    for (let i = 0; i < n; i++) {
      if (outside[i]) continue;
      const x = i % w, y = (i / w) | 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    lums.push(lum);
    outsides.push(outside);
    process.stdout.write('\r  read ' + (f + 1) + '/' + frames.length);
  }
  process.stdout.write('\n');

  /* The shared crop: the union of every frame's bounds, padded. Every frame
     is cut to THIS box, not to its own — see WHY ONE BOUNDING BOX above.
     A figure that touches an edge of the CLIP is a figure the clip cut off,
     and no crop can put back what was never filmed — so say so rather than
     shipping a sliced wing. */
  const pad = 4;
  const touches = [minX <= 1 && 'left', maxX >= w - 2 && 'right', minY <= 1 && 'top', maxY >= h - 2 && 'bottom'].filter(Boolean);
  if (touches.length) {
    console.log('  WARNING: the figure reaches the ' + touches.join(' and ') +
      ' edge of the clip in at least one sampled frame, so it is cut off there. Move the window (start/span) off that part of the loop.');
  }
  const cx = Math.max(0, minX - pad);
  const cy = Math.max(0, minY - pad);
  const cw = Math.min(w - cx, maxX - minX + 1 + pad * 2);
  const ch = Math.min(h - cy, maxY - minY + 1 + pad * 2);
  const frameW = cfg.frameW;
  const frameH = Math.round((ch / cw) * frameW);
  console.log('  union crop ' + cw + 'x' + ch + ' @ ' + cx + ',' + cy + ' -> ' + frameW + 'x' + frameH + ' per frame');

  /** The mask for one frame, at source resolution.
   *  `material` (dark stage): lightness IS the mask, and the black surround
   *  zeroes itself — a straight port of build-hero-masks.mjs.
   *  `ink` (paper): the engraving's own darkness, held inside the recovered
   *  matte — so the brightest things on the plate (the devil's flame, the
   *  cockatrice's lit wing) print as their own outlines and leave the paper
   *  open inside. That is the same read the horns and the moon-face already
   *  get, and it is the whole convention of the positive: light is where
   *  there is no ink.
   *  Inking the flame SOLID instead was tried and taken back out. It needs
   *  the flame told apart from every other bright thing, and nothing
   *  separates them: keying on which pixels are bright and TRANSIENT selects
   *  the head, the horns and the wing as well, because the head lifts — on
   *  paper that came out as a second ghost pair of horns. Growing the resting
   *  silhouette to absorb that motion then eats the base of the flame and
   *  still clips a horn. The convention is not the thing that was wrong. */
  function maskFrame(f, variant) {
    const lum = lums[f];
    const outside = outsides[f];
    const out = Buffer.alloc(n * 4);
    for (let i = 0; i < n; i++) {
      if (outside[i]) continue;
      out[i * 4 + 3] = variant === 'material' ? lum[i] : 255 - lum[i];
    }
    return out;
  }

  /* Pass two: crop to the shared box, scale to the plate's grain, quantise,
     and tile.
     A GRID, not a strip. Twenty tall frames end to end is a 19,000px image,
     past both WebP's 16,383px limit and the point where browsers start
     refusing to decode — and the runtime draws one tile out of this with a
     single drawImage either way, so the shape of the sheet is free. Squarest
     layout that holds the frames. */
  const COLS = Math.max(1, Math.round(Math.sqrt((cfg.frames * frameH) / frameW)));
  const ROWS = Math.ceil(cfg.frames / COLS);
  const QUANT = 255 / (ALPHA_STEPS - 1);
  const sheetW = COLS * frameW;
  const sheetH = ROWS * frameH;

  for (const variant of ['material', 'ink']) {
    const sheet = Buffer.alloc(sheetW * sheetH * 4);
    for (let f = 0; f < cfg.frames; f++) {
      const raw = await sharp(maskFrame(f, variant), { raw: { width: w, height: h, channels: 4 } })
        .extract({ left: cx, top: cy, width: cw, height: ch })
        .resize(frameW, frameH, { kernel: 'lanczos3' })
        .raw()
        .toBuffer();
      const gx = (f % COLS) * frameW;
      const gy = Math.floor(f / COLS) * frameH;
      for (let y = 0; y < frameH; y++) {
        for (let x = 0; x < frameW; x++) {
          const a = raw[(y * frameW + x) * 4 + 3];
          // RGB stays black like every other mask here — all the signal is
          // in alpha, which is what the dither renderer reads.
          sheet[((gy + y) * sheetW + gx + x) * 4 + 3] = Math.round(Math.round(a / QUANT) * QUANT);
        }
      }
    }
    const slot = variant === 'material' ? cfg.slot : cfg.slotInk;
    await sharp(sheet, { raw: { width: sheetW, height: sheetH, channels: 4 } })
      .png({ compressionLevel: 9, effort: 10 })
      .toFile(path.join(outDir, slot));
    const kb = (fs.statSync(path.join(outDir, slot)).size / 1024).toFixed(0);
    console.log('  built ' + slot + ' — ' + cfg.frames + ' frames of ' + frameW + 'x' + frameH +
      ' in a ' + COLS + 'x' + ROWS + ' sheet (' + kb + ' KB)');
  }

  /* Everything Hero.tsx has to be told, measured rather than guessed — and
     the per-frame bounds, which say whether the figure wanders inside its
     box. A wide spread is a wingbeat doing its job; on a standing figure it
     would mean the crop is animating instead of the creature. */
  const spread = [];
  for (let f = 0; f < cfg.frames; f++) {
    const outside = outsides[f];
    let a = w, b = 0, c = h, d = 0;
    for (let i = 0; i < n; i++) {
      if (outside[i]) continue;
      const x = i % w, y = (i / w) | 0;
      if (x < a) a = x;
      if (x > b) b = x;
      if (y < c) c = y;
      if (y > d) d = y;
    }
    spread.push({ f, w: b - a + 1, h: d - c + 1 });
  }
  const ws = spread.map((q) => q.w), hs = spread.map((q) => q.h);
  console.log('  Hero.tsx: frames ' + cfg.frames + ', frameCols ' + COLS +
    ', ar ' + frameW + '/' + frameH + ' = ' + (frameW / frameH).toFixed(4));
  console.log('  per-frame figure: w ' + Math.min(...ws) + '..' + Math.max(...ws) +
    ', h ' + Math.min(...hs) + '..' + Math.max(...hs) + ' inside a ' + cw + 'x' + ch + ' box');
}

const wanted = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const names = wanted.length ? wanted : Object.keys(CLIPS);
for (const name of names) {
  const cfg = CLIPS[name];
  if (!cfg) {
    console.log('no such clip: ' + name + ' (have: ' + Object.keys(CLIPS).join(', ') + ')');
    continue;
  }
  await buildClip(name, cfg);
}
