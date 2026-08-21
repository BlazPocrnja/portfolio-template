import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1512, height: 950 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
await p.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
await p.waitForTimeout(6500);
const read = () => p.evaluate(() => {
  const c = document.querySelector('[data-prop="brain"] canvas');
  return { dpr: window.devicePixelRatio, backing: c.width + 'x' + c.height, css: Math.round(c.clientWidth) + 'x' + Math.round(c.clientHeight) };
});
console.log('start          ', await read());
const cdp = await ctx.newCDPSession(p);
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1512, height: 950, deviceScaleFactor: 2, mobile: false });
await p.waitForTimeout(1200);
console.log('after dpr 1->2 ', await read());
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1512, height: 950, deviceScaleFactor: 1, mobile: false });
await p.waitForTimeout(1200);
console.log('after dpr 2->1 ', await read());
await b.close();
