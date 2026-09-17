// Read-only smoke check for existing static pages, without Wikipedia requests.
import http from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const root = path.resolve('..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  try {
    let file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403).end(); return; }
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    const body = await readFile(file); res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); res.end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.BOT_CHROMIUM_PATH });
const results = [];
try {
  const context = await browser.newContext();
  await context.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
  for (const route of ['/', '/pages/archivo/', '/pages/infinito/', '/pages/scroll-vertical/', '/pages/ruido/']) {
    const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    const response = await page.goto(origin + route, { waitUntil: 'domcontentloaded' });
    assert.equal(response.status(), 200, route);
    assert.ok(await page.locator('body').count());
    await page.waitForTimeout(1000);
    results.push({ route, status: response.status(), title: await page.title(), scriptErrors: errors });
    await page.close();
  }
  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/site-smoke.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} finally { await browser.close(); server.closeAllConnections(); await new Promise(r => server.close(r)); }
