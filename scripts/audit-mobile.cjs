// Local comparison harness; external embeds are excluded from the measurements.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const pages = (process.env.AUDIT_PAGES || '/,/pages/cuerpo/,/pages/infinito/,/pages/ruido/,/pages/archivo/,/pages/pausa/,/pages/aaaaaa/pieza,/pages/embedding-rain/,/pages/ruido/mosquito-caos/,/pages/consulta-imagenes/').split(',');
const base = process.env.BASE_URL || 'http://localhost:8080';
const width = Number(process.env.AUDIT_WIDTH || 820);
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true });
  const results = [];
  try {
    for (const route of pages) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      const page = await context.newPage();
      const errors = [], external = new Set();
      await context.route('**/*', request => {
        const url = new URL(request.request().url());
        if (url.origin === new URL(base).origin) return request.continue();
        external.add(url.origin); return request.abort();
      });
      await page.addInitScript(() => {
        window.open = () => null;
        window.auditLongTasks = [];
        new PerformanceObserver(list => window.auditLongTasks.push(...list.getEntries().map(e => e.duration))).observe({ type: 'longtask', buffered: true });
      });
      page.on('pageerror', e => errors.push(e.message));
      const client = await context.newCDPSession(page);
      await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await client.send('Performance.enable');
      try {
        await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(5000);
        const data = await page.evaluate(() => ({
          requests: performance.getEntriesByType('resource').length,
          resourceBytes: performance.getEntriesByType('resource').reduce((sum, e) => sum + e.decodedBodySize, 0),
          transferBytes: performance.getEntriesByType('resource').reduce((sum, e) => sum + e.transferSize, 0),
          longTasks: window.auditLongTasks.length,
          longTaskMs: Math.round(window.auditLongTasks.reduce((a, b) => a + b, 0)),
          imagePixels: [...document.images].reduce((n, image) => n + image.naturalWidth * image.naturalHeight, 0),
          largest: performance.getEntriesByType('resource').filter(e => e.decodedBodySize).sort((a,b) => b.decodedBodySize-a.decodedBodySize).slice(0,3).map(e=>({url:e.name,bytes:e.decodedBodySize})),
          domNodes: document.querySelectorAll('*').length
        }));
        const metrics = Object.fromEntries((await client.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
        results.push({ route, width, ...data, scriptMs: Math.round(metrics.ScriptDuration * 1000), layoutMs: Math.round(metrics.LayoutDuration * 1000), external: [...external], errors });
      } catch (e) { results.push({ route, error: e.message }); }
      console.log(JSON.stringify(results.at(-1)));
      await context.close();
    }
    const output = process.env.AUDIT_OUTPUT || 'tmp/performance-audit.json';
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
