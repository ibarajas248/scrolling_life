import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { createStream } from '../stream.mjs';

test('one feed, isolated disconnects, bounded slow-client queue and no remote commands', async () => {
  const server = http.createServer(); const stream = createStream(server);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `ws://127.0.0.1:${server.address().port}/bot/stream`;
  const a = new WebSocket(url), b = new WebSocket(url);
  try {
    await Promise.all([once(a, 'open'), once(b, 'open')]);
    const first = [once(a, 'message'), once(b, 'message')]; stream.publish(Buffer.from('frame-1'));
    assert.deepEqual((await first[0])[0], (await first[1])[0]);
    stream.publish(Buffer.from('discarded')); stream.publish(Buffer.from('newest'));
    const latest = once(b, 'message'); b.send('ack'); assert.equal((await latest)[0].toString(), 'newest');
    const closed = once(a, 'close'); a.close(); await closed;
    const next = once(b, 'message'); b.send('ack'); stream.publish(Buffer.from('still-running'));
    assert.equal((await next)[0].toString(), 'still-running');
    const rejected = once(b, 'close'); b.send('navigate:https://evil.example');
    assert.equal((await rejected)[0], 1008);
  } finally { a.terminate(); b.terminate(); stream.close(); await new Promise(r => server.close(r)); }
});
