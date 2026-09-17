import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { WikimediaNetwork } from '../network.mjs';

test('HTTP cache persists across instances and honors no-store', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'scrollinglife-bot-test-'));
  try {
    const network = new WikimediaNetwork({ dataDir, userAgent: 'TestBot/1.0', log: () => {} });
    await network.init(); let calls = 0;
    network.wire = async url => { calls++; return { status: 200, headers: { 'set-cookie': 'session=never-persist-this', 'cache-control': url.endsWith('private') ? 'no-store' : 'max-age=3600', date: new Date().toUTCString() }, body: Buffer.from('cached') }; };
    await network.cached('https://es.wikipedia.org/wiki/Arte', {});
    await network.cached('https://es.wikipedia.org/wiki/Arte', {});
    assert.equal(calls, 1);
    const restarted = new WikimediaNetwork({ dataDir, userAgent: 'TestBot/1.0' });
    await restarted.init();
    restarted.wire = () => { throw new Error('cache should survive restart'); };
    assert.equal((await restarted.cached('https://es.wikipedia.org/wiki/Arte', {})).body.toString(), 'cached');
    assert.equal((await restarted.cached('https://es.wikipedia.org/wiki/Arte', {})).headers['set-cookie'], undefined);
    await network.cached('https://es.wikipedia.org/wiki/private', {});
    await network.cached('https://es.wikipedia.org/wiki/private', {});
    assert.equal(calls, 3);
    await network.pause(429, '7200');
    const resumed = new WikimediaNetwork({ dataDir, userAgent: 'TestBot/1.0' }); await resumed.init();
    assert.ok(resumed.pauseUntil > Date.now() + 7_190_000);
  } finally { await rm(dataDir, { recursive: true, force: true }); }
});

test('robots follows trusted redirects and applies rules to the initial host', async () => {
  const network = new WikimediaNetwork({ dataDir: '.', userAgent: 'ScrollingLifeBot/1.0' });
  const urls = [];
  network.cached = async url => {
    urls.push(url);
    return url.startsWith('https://thumb.')
      ? { status: 301, headers: { location: 'https://upload.wikimedia.org/robots.txt' }, body: Buffer.alloc(0) }
      : { status: 200, headers: {}, body: Buffer.from('User-agent: *\nDisallow: /wikipedia/commons/archive/') };
  };
  const rules = await network.getRobots('https://thumb.wikimedia.org');
  assert.equal(urls.length, 2);
  assert.equal(rules.isAllowed('https://thumb.wikimedia.org/wikipedia/commons/archive/x', 'ScrollingLifeBot'), false);
  assert.equal(rules.isAllowed('https://thumb.wikimedia.org/wikipedia/commons/thumb/x', 'ScrollingLifeBot'), true);
  network.cached = async () => ({ status: 301, headers: { location: 'https://evil.example/robots.txt' } });
  await assert.rejects(network.getRobots('https://commons.wikimedia.org'));
});

test('HTML in place of robots denies the host without retrying every image', async () => {
  const network = new WikimediaNetwork({ dataDir: '.', userAgent: 'ScrollingLifeBot/1.0', log: () => {} });
  let calls = 0;
  network.cached = async () => { calls++; return { status: 200, headers: {}, body: Buffer.from('<html>Not a robots file</html>') }; };
  const rules = await network.getRobots('https://thumb.wikimedia.org');
  assert.equal(rules.isAllowed('https://thumb.wikimedia.org/wikipedia/commons/thumb/x', 'ScrollingLifeBot'), false);
  await network.getRobots('https://thumb.wikimedia.org');
  assert.equal(calls, 1);
  assert.equal(network.pauseUntil, 0);
});
