// Manual acceptance run: talks only to the running service and its local health.
// No test pages, altered Wikipedia content, shortened dwell or injected frames.
import { chromium } from 'playwright';
import { WebSocket } from 'ws';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = process.env.BOT_TEST_URL || 'http://127.0.0.1:8094';
await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.BOT_CHROMIUM_PATH });
const viewers = []; const feeds = []; const hashes = [new Set(), new Set()];
const counts = [0, 0]; const sizes = [0, 0]; const screenshots = [];
const started = Date.now();
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage(); viewers.push(page);
    page.receivedFrames = 0; page.connections = 0;
    page.on('websocket', ws => { page.connections++; ws.on('framereceived', () => page.receivedFrames++); });
    await page.goto(`${base}/bot`);
    assert.equal(await page.locator('body > *').count(), 1);
    assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight));
  }
  for (let i = 0; i < 2; i++) {
    const ws = new WebSocket(base.replace(/^http/, 'ws') + '/bot/stream'); feeds.push(ws);
    ws.on('message', data => { hashes[i].add(createHash('sha256').update(data).digest('hex')); counts[i]++; sizes[i] += data.length; ws.send('ack'); });
  }
  let health;
  const deadline = Date.now() + 7 * 60_000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 5000));
    health = await (await fetch(`${base}/health`)).json();
    console.log(JSON.stringify({ elapsed: Math.round((Date.now() - started) / 1000), health, counts }));
    if (counts[0] > 5 && screenshots.length === 0) {
      for (let i = 0; i < viewers.length; i++) {
        const file = `artifacts/${i ? 'mobile' : 'desktop'}.png`;
        await viewers[i].screenshot({ path: file }); screenshots.push(file);
      }
    }
    if (health.transitions >= 3 && counts.every(n => n > 10)) break;
  }
  assert.ok(health.transitions >= 3, 'Three real link transitions required');
  assert.ok([...hashes[0]].filter(hash => hashes[1].has(hash)).length > 10, 'Both viewers receive matching real frames');
  const before = counts[1]; feeds[0].close(); await viewers[0].context().close();
  await new Promise(r => setTimeout(r, 7000));
  assert.ok(counts[1] > before, 'Second viewer continues after first disconnects');
  // Close the browser transport, then verify automatic reconnection and preserved canvas.
  await viewers[1].context().setOffline(true); await new Promise(r => setTimeout(r, 2000));
  const retained = await viewers[1].evaluate(() => document.querySelector('canvas').toDataURL());
  await new Promise(r => setTimeout(r, 1000));
  assert.equal(await viewers[1].evaluate(() => document.querySelector('canvas').toDataURL()), retained);
  const beforeReconnect = viewers[1].receivedFrames;
  await viewers[1].context().setOffline(false);
  const reconnectDeadline = Date.now() + 70_000;
  while (viewers[1].receivedFrames <= beforeReconnect && Date.now() < reconnectDeadline) await new Promise(r => setTimeout(r, 1000));
  assert.ok(viewers[1].receivedFrames > beforeReconnect, 'Viewer receives frames after restoring network');
  const report = { elapsedSeconds: (Date.now() - started) / 1000, health, counts, sizes, screenshots,
    matchingFrames: [...hashes[0]].filter(hash => hashes[1].has(hash)).length, secondViewerSurvived: counts[1] > before,
    reconnectReceivedFrames: viewers[1].receivedFrames - beforeReconnect, mobileConnections: viewers[1].connections, retainedFrame: true };
  await writeFile('artifacts/live-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { for (const ws of feeds) ws.terminate(); await browser.close(); }
