import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { bot, shutdown } from '../server.mjs';
const base = `http://127.0.0.1:${process.env.BOT_PORT || 8094}`;
const waitUntil = async (predicate, timeout = 150_000) => {
  const until = Date.now() + timeout;
  while (!await predicate()) {
    assert.ok(Date.now() < until, 'Acceptance deadline');
    await new Promise(r => setTimeout(r, 500));
  }
};
const browser = await chromium.launch({ headless: true, executablePath: process.env.BOT_CHROMIUM_PATH });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  // Instrument only the spectator's native socket to induce a real disconnect.
  await page.addInitScript(() => {
    const NativeSocket = window.WebSocket;
    window.testSockets = [];
    window.WebSocket = class extends NativeSocket {
      constructor(...args) { super(...args); window.testSockets.push(this); }
    };
  });
  let frames = 0, connections = 0;
  page.on('websocket', ws => { connections++; ws.on('framereceived', () => frames++); });
  await page.goto(base + '/bot');
  await waitUntil(() => frames > 3 && bot.canPublish);
  await context.setOffline(true);
  await page.evaluate(() => window.testSockets.at(-1).close());
  await page.waitForTimeout(1000);
  const retained = await page.evaluate(() => document.querySelector('canvas').toDataURL());
  await page.waitForTimeout(1500);
  assert.equal(await page.evaluate(() => document.querySelector('canvas').toDataURL()), retained);
  const before = frames;
  await context.setOffline(false);
  await waitUntil(() => frames > before && connections >= 2, 60_000);
  const old = bot.browser;
  await old.close();
  const beforeRecovery = frames;
  await waitUntil(() => bot.browser !== old && bot.canPublish && frames > beforeRecovery);
  assert.equal(bot.browser.contexts().length, 1);
  assert.equal(bot.browser.contexts()[0].pages().length, 1);
  const transitionBefore = bot.transitions;
  await waitUntil(() => bot.transitions > transitionBefore, 120_000);
  const report = { forcedSocketReconnect: true, connections, retainedFrame: true,
    browserRecovered: true, onlyOneBrowserPage: true, realLinkAfterRecovery: true, frames };
  await writeFile('artifacts/recovery-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await browser.close(); await shutdown(); }
