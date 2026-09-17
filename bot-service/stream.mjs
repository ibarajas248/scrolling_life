import { WebSocketServer, WebSocket } from 'ws';

export function createStream(server, { maxViewers = 80, origin, onAudience = () => {} } = {}) {
  const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false, maxPayload: 32 });
  let latest = null;
  let sequence = 0;
  const send = ws => {
    if (!latest || ws.busy || ws.seen === sequence || ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > 256 * 1024) return;
    ws.busy = Date.now(); ws.seen = sequence;
    ws.send(latest, { binary: true }, error => { if (error) ws.terminate(); });
  };
  server.on('upgrade', (req, socket, head) => {
    if (req.url !== '/bot/stream' || wss.clients.size >= maxViewers ||
        (origin && req.headers.origin !== origin)) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return;
    }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
  });
  wss.on('connection', ws => {
    ws.alive = true; ws.busy = 0; ws.seen = -1;
    ws.on('error', () => ws.terminate());
    ws.on('pong', () => { ws.alive = true; });
    ws.on('message', (data, binary) => {
      // Only a frame acknowledgment is understood. There is no remote input protocol.
      if (binary || data.toString() !== 'ack') return ws.close(1008);
      ws.busy = 0; send(ws);
    });
    ws.on('close', () => onAudience(wss.clients.size));
    onAudience(wss.clients.size); send(ws);
  });
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.alive || (ws.busy && Date.now() - ws.busy > 30_000)) { ws.terminate(); continue; }
      ws.alive = false; ws.ping();
    }
  }, 15_000);
  heartbeat.unref();
  return {
    get viewers() { return wss.clients.size; },
    publish(jpeg) { latest = jpeg; sequence++; for (const ws of wss.clients) send(ws); },
    close() { clearInterval(heartbeat); for (const ws of wss.clients) ws.terminate(); wss.close(); latest = null; }
  };
}
