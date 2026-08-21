import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1512, height: 950 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
await p.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
await p.waitForTimeout(6000);
await p.evaluate(() => {
  window.__h = [];
  const wrap = document.querySelector('[data-prop="brain"] .hero-ascii-art-wrap');
  const cv = document.querySelector('[data-prop="brain"] canvas');
  new ResizeObserver((es) => window.__h.push('wrap devicePx: ' + JSON.stringify(es[0].devicePixelContentBox?.[0] ?? null)))
    .observe(wrap, { box: 'device-pixel-content-box' });
  new ResizeObserver(() => window.__h.push('wrap cssBox')).observe(wrap);
  new ResizeObserver((es) => window.__h.push('canvas devicePx: ' + JSON.stringify(es[0].devicePixelContentBox?.[0] ?? null)))
    .observe(cv, { box: 'device-pixel-content-box' });
});
await p.waitForTimeout(500);
await p.evaluate(() => { window.__h = []; });
const cdp = await ctx.newCDPSession(p);
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1512, height: 950, deviceScaleFactor: 2, mobile: false });
await p.waitForTimeout(1500);
console.log('dpr:', await p.evaluate(() => window.devicePixelRatio));
console.log((await p.evaluate(() => window.__h)).join('\n') || '(nothing fired)');
await b.close();
