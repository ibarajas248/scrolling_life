const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { chromium } = require('playwright');
const source = fs.readFileSync(require('node:path').join(__dirname, '../assets/scripts/home-performance.js'), 'utf8');

function policy({ connection, delay = 0, mobile = false } = {}) {
  const root = { dataset: {}, classList: { toggle() {} } };
  let ready, frame;
  const document = { documentElement: root, hidden: false, querySelectorAll: () => [], addEventListener(type, fn) { if (type === 'DOMContentLoaded') ready = fn; } };
  vm.runInNewContext(source, {
    document, navigator: { connection }, matchMedia: () => ({ matches: mobile, addEventListener() {} }),
    performance: { getEntriesByType: () => [{ requestStart: 10, responseStart: 10 + delay }] },
    IntersectionObserver: class { observe() {} }, requestAnimationFrame(fn) { frame = fn; }
  });
  ready();
  return { root, tick(time) { const fn = frame; frame = null; fn?.(time); } };
}
const network = props => ({ ...props, addEventListener() {} });
assert.equal(policy().root.dataset.homeQuality, 'full');
assert.equal(policy({ mobile: true }).root.dataset.homeQuality, 'light');
for (const props of [{ saveData: true }, { effectiveType: '3g' }, { downlink: 0.8 }, { rtt: 500 }]) {
  assert.equal(policy({ connection: network(props) }).root.dataset.homeQuality, 'light');
}
assert.equal(policy({ connection: network({ effectiveType: '4g', downlink: 20, rtt: 30 }) }).root.dataset.homeQuality, 'full');
assert.equal(policy({ delay: 1500 }).root.dataset.homeQuality, 'light');
const slow = policy();
for (let t = 5001; t < 12000; t += 90) slow.tick(t);
assert.equal(slow.root.dataset.homeQualityReason, 'frame-rate');
const brief = policy();
for (let t = 5001; t < 8500; t += 90) brief.tick(t);
for (let t = 8500; t < 15000; t += 16) brief.tick(t);
assert.equal(brief.root.dataset.homeQuality, 'full');
console.log('Policy: fast/slow/unknown connection, response delay, mobile, sustained vs brief jank passed');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    for (const [name, width, slowNetwork, expected] of [['desktop', 1440, false, 'full'], ['slow-desktop', 1440, true, 'light'], ['phone', 390, false, 'light']]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addInitScript(slowNetwork => {
        window.open = () => null;
        Object.defineProperty(navigator, 'connection', { configurable: true, value: { effectiveType: slowNetwork ? '3g' : '4g', downlink: slowNetwork ? 0.8 : 20, rtt: slowNetwork ? 500 : 20, addEventListener() {} } });
        Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, value: 8 });
        Object.defineProperty(navigator, 'deviceMemory', { configurable: true, value: 8 });
      }, slowNetwork);
      const page = await context.newPage(), errors = [], probes = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/*', r => {
        const url = new URL(r.request().url());
        if (url.pathname.includes('datasets/')) probes.push(url.pathname);
        return url.hostname === 'localhost' ? r.continue() : r.abort();
      });
      await page.goto((process.env.BASE_URL || 'http://localhost:8080') + '/');
      await page.waitForTimeout(3500);
      assert.equal(await page.locator('html').getAttribute('data-home-quality'), expected);
      if (expected === 'light') {
        assert.equal(probes.length, 0);
        assert.equal(await page.locator('.netart-item').count(), 6);
        assert.equal(await page.locator('.poster-shape').first().evaluate(e => getComputedStyle(e).animationName), 'none');
      }
      await page.evaluate(() => scrollTo({ top: document.querySelector('.hero').getBoundingClientRect().bottom + scrollY + 100, behavior: 'instant' }));
      await page.waitForTimeout(300);
      assert(await page.locator('.hero').evaluate(e => e.classList.contains('home-offscreen')));
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      await page.waitForTimeout(1000);
      assert(await page.locator('.hero').evaluate(e => !e.classList.contains('home-offscreen')));
      assert.deepEqual(errors, []);
      await page.screenshot({ path: `tmp/home-adaptive-${name}.png` });
      console.log(`${name}: ${expected}, navigation and offscreen pause/resume passed`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
