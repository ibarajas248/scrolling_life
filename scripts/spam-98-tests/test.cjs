const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const base = process.env.BASE_URL || 'http://localhost:8080/pages/spam-98/';
const screenshots = process.env.SCREENSHOT_DIR || path.join(os.tmpdir(), 'scrollinglife-spam-98-tests');
const order = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8'];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function decodeImages(page) {
  const failures = await page.locator('img').evaluateAll((images) => Promise.all(images.map(async (image) => {
    try { await image.decode(); return null; }
    catch (error) { return `${image.src}: ${error.message}`; }
  })));
  assert.deepEqual(failures.filter(Boolean), []);
}

async function checkStep(page, cluster, step) {
  const current = page.locator('[data-cluster]');
  assert.equal(await current.count(), 1, 'Only one cluster is open');
  assert.equal(await current.getAttribute('data-cluster'), cluster);
  assert.equal(await current.getAttribute('data-step'), String(step));
  return current;
}

async function restoreWindow(page, current) {
  const title = await current.locator('.window-title').textContent();
  await page.locator('#start').click();
  await page.locator('#window-tabs').getByRole('button', { name: title, exact: true }).first().click();
}

async function checkGeometry(page) {
  const bounds = await page.locator('#popup-stage').boundingBox();
  const windows = await page.locator('.art-window:visible').evaluateAll((nodes) => nodes.map((node) => ({
    x: node.offsetLeft, y: node.offsetTop,
    right: node.offsetLeft + node.offsetWidth, bottom: node.offsetTop + node.offsetHeight
  })));
  for (const rect of windows) {
    assert.ok(rect.x >= 0 && rect.right <= bounds.width + 1, `Horizontal overflow: ${JSON.stringify(rect)}`);
    assert.ok(rect.y >= 0 && rect.bottom <= bounds.height + 1, `Vertical overflow: ${JSON.stringify(rect)}`);
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
}

async function verify(browser, mobile) {
  const name = mobile ? 'mobile' : 'desktop';
  const page = await browser.newPage({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.addInitScript(() => {
    let seed = 17;
    Math.random = () => ((seed = seed * 16807 % 2147483647) - 1) / 2147483646;
    window.audioStarts = 0;
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) { window.audioStarts++; return start.apply(this, args); };
  });
  await page.clock.install({ time: new Date('2026-09-02T12:00:00') });
  await page.clock.pauseAt(new Date('2026-09-02T12:00:10'));
  await page.goto(base);
  await page.waitForLoadState('networkidle');
  const manifest = await page.evaluate(() => window.SPAM_ASSETS);
  assert.deepEqual(manifest.clusters.map((cluster) => cluster.id), order);
  assert.equal(await page.locator('#popup-stage').getAttribute('data-phase'), 'inicio');
  assert.equal(await page.locator('.art-window').count(), 0);
  assert.equal(await page.locator('[data-command="inbox"]').isDisabled(), true);
  assert.equal(await page.locator('.piece-background').getAttribute('src'), './assets/AAAAAAAAAAAA.txt/INICIO/inicio.jpg');
  await decodeImages(page);
  await page.screenshot({ path: path.join(screenshots, `${name}-inicio.png`) });

  await page.clock.runFor(2000);
  const first = await checkStep(page, 'C1', 0);
  assert.equal(await first.locator('.artwork-button img').getAttribute('src'), 'assets/AAAAAAAAAAAA.txt/C1/1.Preparing setup.gif');
  // A passive visitor must not skip folders or reach the old timed ending.
  await page.clock.runFor(240000);
  await checkStep(page, 'C1', 0);
  assert.equal(await page.locator('.art-window').count(), 1);
  assert.equal(await page.locator('.is-final').count(), 0);

  if (!mobile) {
    const before = await first.boundingBox();
    await page.mouse.move(before.x + 80, before.y + 15);
    await page.mouse.down();
    await page.mouse.move(before.x + 165, before.y + 70, { steps: 8 });
    await page.mouse.up();
    assert.ok((await first.boundingBox()).x > before.x + 50);
    await first.getByRole('button', { name: 'Maximizar / restaurar' }).click();
    assert.ok((await first.boundingBox()).width > 1400);
    await first.getByRole('button', { name: 'Maximizar / restaurar' }).click();
    await first.getByRole('button', { name: 'Minimizar', exact: true }).click();
    assert.equal(await first.isVisible(), false);
    await page.locator('#session').click();
    assert.equal(await first.isVisible(), true);
  }
  await page.locator('#pause').click();
  await first.locator('.artwork-button').click();
  await page.clock.runFor(20000);
  await checkStep(page, 'C1', 0);
  await page.locator('#pause').click();

  let visited = 0;
  for (const cluster of manifest.clusters) {
    for (let index = 0; index < cluster.steps.length; index++) {
      const current = await checkStep(page, cluster.id, index);
      const item = cluster.steps[index];
      if (cluster.id === 'C1' || cluster.id === 'C2') {
        assert.equal(await page.locator('.art-window').count(), 1, 'No ALEATORIO before C3');
      }
      if (cluster.id === 'C1' && index === 1) {
        assert.equal(item.src, 'assets/AAAAAAAAAAAA.txt/C1/2.BlackCore/1.Iluvbc.gif');
        for (let attempt = 0; attempt < 40 && !(await page.evaluate(() => window.audioStarts)); attempt++) await sleep(200);
        assert.ok(await page.evaluate(() => window.audioStarts > 0), 'BlackCore WAV plays on appearance');
        await page.screenshot({ path: path.join(screenshots, `${name}-c1-blackcore.png`) });
      }
      if (cluster.id === 'C3' && index === 0) {
        assert.equal(await page.locator('[data-command="inbox"]').isDisabled(), false);
        await page.clock.runFor(120000);
        await checkStep(page, 'C3', 0);
        const count = await page.locator('.art-window').count();
        assert.ok(count >= 10 && count <= (mobile ? 12 : 24), 'ALEATORIO invades without advancing C3');
        await decodeImages(page);
        await checkGeometry(page);
        await page.screenshot({ path: path.join(screenshots, `${name}-invasion.png`) });
        const random = page.locator('.art-window:not([data-cluster])').filter({ has: page.locator('.artwork-button') }).first();
        await restoreWindow(page, random);
        await random.locator('.artwork-button').click();
        await checkStep(page, 'C3', 0);
        await page.locator('#pause').click();
        const pausedCount = await page.locator('.art-window').count();
        await page.clock.runFor(20000);
        assert.equal(await page.locator('.art-window').count(), pausedCount);
        await page.locator('#pause').click();
        if (mobile) {
          await page.setViewportSize({ width: 320, height: 568 });
          await checkGeometry(page);
          await page.screenshot({ path: path.join(screenshots, 'mobile-small-invasion.png') });
          await page.setViewportSize({ width: 390, height: 844 });
        }
      }
      await restoreWindow(page, current);
      if (item.url) {
        const link = current.getByRole('link', { name: 'Abrir enlace' });
        assert.equal(await link.getAttribute('href'), item.url);
        assert.equal(await link.getAttribute('target'), '_blank');
        assert.equal(await link.getAttribute('rel'), 'noopener noreferrer');
        await current.getByRole('button', { name: 'Continuar', exact: true }).click();
      } else {
        assert.equal(await current.locator('.artwork-button img').getAttribute('src'), item.src);
        await current.locator('.artwork-button img').evaluate((image) => image.decode());
        if (mobile && cluster.id === 'C1' && index === 0) {
          await current.getByRole('button', { name: 'Cerrar', exact: true }).click();
        } else await current.locator('.artwork-button').click();
      }
      visited++;
      if (cluster.id !== 'C8' || index !== cluster.steps.length - 1) {
        assert.equal(await page.locator('.is-active[data-cluster]').count(), 1, 'The next step stays in front of spam');
        assert.equal(await page.locator('.is-final').count(), 0, 'No premature ending');
      }
    }
  }
  assert.equal(visited, 22);
  assert.equal(await page.locator('#popup-stage').getAttribute('data-phase'), 'final');
  assert.equal(await page.locator('.art-window').count(), 1);
  assert.equal(await page.locator('.is-final').count(), 1);
  for (let attempt = 0; attempt < 40; attempt++) {
    if (await page.locator('video').evaluate((video) => video.videoWidth > 0 && video.currentTime > 0)) break;
    await sleep(250);
  }
  const video = await page.locator('video').evaluate((video) => ({ width: video.videoWidth, duration: video.duration, time: video.currentTime, error: video.error?.message }));
  assert.ok(video.width > 0 && video.duration > 39 && video.time > 0 && !video.error, 'Original FINAL plays');
  await checkGeometry(page);
  await page.screenshot({ path: path.join(screenshots, `${name}-final.png`) });
  await page.clock.runFor(65000);
  assert.equal(await page.locator('.art-window').count(), 1, 'Spam remains stopped after FINAL');
  await page.locator('.is-final').getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.locator('#session').click();
  assert.equal(await page.locator('.is-final').isVisible(), true);
  await page.locator('.notepad-footer').getByRole('button', { name: 'Reiniciar', exact: true }).click();
  assert.equal(await page.locator('#popup-stage').getAttribute('data-phase'), 'inicio');
  assert.equal(await page.locator('[data-command="inbox"]').isDisabled(), true);
  await page.clock.runFor(242000);
  await checkStep(page, 'C1', 0);
  assert.equal(await page.locator('.art-window').count(), 1, 'Restart clears ALEATORIO and progression');
  await page.locator('#start').click();
  await page.locator('[data-command="finish"]').click();
  assert.equal(await page.locator('.is-final').count(), 1, 'Manual ending remains available');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ viewport: name, visited, order, video, errors }));
  await page.close();
}

(async () => {
  fs.mkdirSync(screenshots, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true });
  try {
    await verify(browser, false);
    await verify(browser, true);
    console.log(`Passed: ${base}\nScreenshots: ${screenshots}`);
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
