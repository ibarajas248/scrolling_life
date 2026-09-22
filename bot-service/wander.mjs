import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { articleUrl, SEEDS } from './policy.mjs';

const random = (min, max) => min + Math.random() * (max - min);
const pick = list => list[Math.floor(Math.random() * list.length)];
const sleep = ms => new Promise(r => setTimeout(r, ms));

export class Wanderer {
  constructor({ network, stream, dataDir, userAgent, log = console.log, executablePath, fps = 12, quality = 70 }) {
    Object.assign(this, { network, stream, dataDir, userAgent, log, executablePath, fps, quality });
    this.stopped = false;
    this.history = [];
    this.status = 'starting';
    this.transitions = 0;
    this.canPublish = false;
  }
  async wait(ms) {
    const end = Date.now() + ms;
    while (!this.stopped && Date.now() < end) await sleep(Math.min(250, end - Date.now()));
    if (this.stopped) throw new Error('stopped');
  }
  async remember(url, via) {
    this.history.push(url); this.history = this.history.slice(-24);
    await writeFile(path.join(this.dataDir, 'history.json'), JSON.stringify(this.history));
    if (via === 'link') this.transitions++;
    this.log(JSON.stringify({ event: 'article', url, via, transitions: this.transitions, at: new Date().toISOString() }));
  }
  async validate(page, via) {
    await page.locator('#mw-content-text .mw-parser-output').first().waitFor({ timeout: 90_000 });
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    const url = articleUrl(canonical);
    if (!url || !articleUrl(page.url())) throw new Error('Not an article');
    await this.remember(url, via);
    this.canPublish = true;
    this.status = 'running';
    this.network.failures = 0;
  }
  async scroll(page, distance) {
    // This changes the scroll position of the actual Wikipedia document.
    let timeout;
    try { await Promise.race([page.evaluate(({ distance, duration }) => new Promise(resolve => {
      const start = scrollY, began = performance.now();
      function step(now) {
        const t = Math.min(1, (now - began) / duration);
        scrollTo(0, start + distance * (t * t * (3 - 2 * t)));
        if (t < 1) requestAnimationFrame(step); else resolve();
      }
      requestAnimationFrame(step);
    }), { distance, duration: random(1100, 2600) }), new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error('Renderer scroll timeout')), 15_000);
    })]); } finally { clearTimeout(timeout); }
  }
  async chooseLink(page) {
    const links = await page.locator('#mw-content-text .mw-parser-output a[href]').evaluateAll(nodes => nodes.map((a, index) => {
      const r = a.getBoundingClientRect();
      const style = getComputedStyle(a);
      // Wikipedia keeps many template and navigation links in the DOM while
      // hiding their parents. A non-zero rectangle alone is not enough: those
      // links make Playwright wait forever for a click that can never happen.
      const rendered = a.getClientRects().length > 0 && a.offsetParent !== null &&
        style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse' &&
        Number(style.opacity) > 0 && (!a.checkVisibility || a.checkVisibility({ visibilityProperty: true, opacityProperty: true }));
      return { href: a.href, index, visible: rendered && r.top > 90 && r.bottom < innerHeight - 30 && r.left >= 0 && r.right <= innerWidth,
        usable: rendered && r.width > 0 && r.height > 0 && !a.classList.contains('new') && !a.hasAttribute('download') && !a.closest('.navbox, .metadata, .reflist, .mw-editsection') };
    }));
    const candidates = links.filter(a => a.usable && articleUrl(a.href) && !this.history.includes(articleUrl(a.href)));
    const visible = candidates.filter(a => a.visible);
    const selected = pick(visible.length ? visible : candidates);
    if (!selected) return false;
    const locator = page.locator('#mw-content-text .mw-parser-output a[href]').nth(selected.index);
    if (!selected.visible) {
      await locator.scrollIntoViewIfNeeded({ timeout: 15_000 });
      await this.wait(random(900, 1800));
    }
    const box = await locator.evaluate(a => {
      const r = a.getBoundingClientRect();
      const s = getComputedStyle(a);
      const rendered = a.getClientRects().length > 0 && a.offsetParent !== null &&
        s.display !== 'none' && s.visibility !== 'hidden' && s.visibility !== 'collapse' &&
        Number(s.opacity) > 0 && (!a.checkVisibility || a.checkVisibility({ visibilityProperty: true, opacityProperty: true }));
      return rendered && r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth
        ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
    });
    if (!box) return false;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await this.wait(random(300, 800));
    this.canPublish = false;
    await Promise.all([
      page.waitForURL(u => articleUrl(u.href) !== this.history.at(-1), { waitUntil: 'domcontentloaded', timeout: 120_000 }),
      locator.click({ timeout: 15_000, noWaitAfter: true })
    ]);
    await this.validate(page, 'link');
    return true;
  }
  async session() {
    this.browser = await chromium.launch({ headless: true, executablePath: this.executablePath,
      args: ['--disable-background-networking', '--disable-component-update', '--disable-features=SpeculationRules,Prerender2', '--disable-quic'] });
    const context = await this.browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1,
      userAgent: this.userAgent, locale: 'es-ES', serviceWorkers: 'block', acceptDownloads: false });
    await context.route('**/*', route => this.network.route(route));
    context.on('requestfailed', request => this.network.cancelled.add(request));
    await context.routeWebSocket('**/*', ws => ws.close());
    const page = await context.newPage();
    this.page = page;
    page.setDefaultTimeout(20_000);
    context.on('page', other => { if (other !== page) void other.close().catch(() => {}); });
    page.on('dialog', dialog => void dialog.dismiss().catch(() => {}));
    const cdp = await context.newCDPSession(page);
    let lastSent = 0;
    let bytes = 0;
    let windowStart = Date.now();
    cdp.on('Page.screencastFrame', ({ data, sessionId }) => {
      const now = Date.now();
      if (now - windowStart >= 1000) { windowStart = now; bytes = 0; }
      if (this.canPublish && this.stream.viewers && now - lastSent >= 1000 / this.fps) {
        const jpeg = Buffer.from(data, 'base64');
        if (bytes + jpeg.length <= 1024 * 1024) { this.stream.publish(jpeg); lastSent = now; bytes += jpeg.length; }
      }
      void cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    });
    // One capture source for everyone. Stop capture while nobody is watching.
    let capturing = false;
    let captureBusy = false;
    const captureTick = setInterval(async () => {
      if (captureBusy) return;
      captureBusy = true;
      try {
        if (this.stream.viewers && !capturing) {
          await cdp.send('Page.startScreencast', { format: 'jpeg', quality: this.quality, maxWidth: 1280, maxHeight: 800, everyNthFrame: 2 });
          capturing = true;
        } else if (!this.stream.viewers && capturing) {
          await cdp.send('Page.stopScreencast'); capturing = false;
        }
        // A still frame also refreshes after a navigation or a late join during a pause.
        if (this.canPublish && this.stream.viewers && Date.now() - lastSent > 2000) {
          const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: this.quality, captureBeyondViewport: false });
          if (this.canPublish) { this.stream.publish(Buffer.from(data, 'base64')); lastSent = Date.now(); }
        }
      } catch {} finally { captureBusy = false; }
    }, 1000);
    try {
      await this.network.ready();
      await page.goto(this.history.at(-1) || pick(SEEDS), { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await this.validate(page, 'recovery');
      while (!this.stopped) {
        const until = Date.now() + random(25_000, 70_000);
        await this.wait(random(2500, 5000));
        while (Date.now() < until - 4000) {
          await this.network.ready();
          await this.scroll(page, Math.random() < 0.17 ? -random(100, 260) : random(160, 580));
          const nearFeature = await page.locator('#mw-content-text img, #mw-content-text h2, #mw-content-text h3').evaluateAll(nodes => nodes.some(n => {
            const r = n.getBoundingClientRect(); return r.height > 20 && r.top >= 0 && r.top < innerHeight * 0.8;
          }));
          await this.wait(Math.min(until - Date.now(), nearFeature && Math.random() < 0.45 ? random(4000, 8000) : random(900, 2800)));
        }
        await this.network.ready();
        if (!await this.chooseLink(page)) {
          this.canPublish = false;
          const target = this.history.at(-2) || pick(SEEDS.filter(u => u !== this.history.at(-1)));
          await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 120_000 });
          await this.validate(page, 'recovery');
        }
      }
    } finally {
      clearInterval(captureTick); this.canPublish = false;
      await this.browser.close().catch(() => {});
    }
  }
  async run() {
    try { this.history = JSON.parse(await readFile(path.join(this.dataDir, 'history.json'), 'utf8')).filter(u => articleUrl(u)).slice(-24); } catch {}
    let errors = 0;
    while (!this.stopped) {
      const began = Date.now();
      try { await this.session(); }
      catch (error) {
        this.canPublish = false;
        await this.browser?.close().catch(() => {});
        if (this.stopped) return;
        if (Date.now() - began > 120_000) errors = 0;
        this.status = 'recovering';
        this.log(JSON.stringify({ event: 'browser-recovery', message: error.message }));
        if (++errors >= 3) this.history.pop();
        await this.wait(Math.min(300_000, 5000 * 2 ** Math.min(errors, 6))).catch(() => {});
      }
    }
  }
  async stop() { this.stopped = true; this.network.stop(); await this.browser?.close().catch(() => {}); }
}
