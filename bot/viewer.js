(() => {
  const canvas = document.querySelector('canvas');
  const context = canvas.getContext('2d', { alpha: false });
  let socket;
  let timer;
  let retries = 0;
  let active = true;
  let lastMessage = Date.now();
  context.fillStyle = '#f8f9fa'; context.fillRect(0, 0, canvas.width, canvas.height);
  function connect() {
    if (!active || document.hidden) return;
    const localPreview = ['localhost', '127.0.0.1'].includes(location.hostname) && location.port === '8080';
    const streamHost = localPreview ? '127.0.0.1:8096' : location.host;
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${streamHost}/bot/stream`);
    socket = ws; ws.binaryType = 'blob';
    ws.onopen = () => { lastMessage = Date.now(); };
    ws.onmessage = async event => {
      lastMessage = Date.now();
      if (!(event.data instanceof Blob)) return;
      try {
        const bitmap = await createImageBitmap(event.data);
        if (socket === ws && active) {
          if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) { canvas.width = bitmap.width; canvas.height = bitmap.height; }
          context.drawImage(bitmap, 0, 0); retries = 0;
        }
        bitmap.close();
      } catch {} finally { if (ws.readyState === WebSocket.OPEN) ws.send('ack'); }
    };
    ws.onerror = () => ws.close();
    ws.onclose = () => {
      if (ws !== socket || !active || document.hidden) return;
      timer = setTimeout(connect, Math.min(15_000, 500 * 2 ** Math.min(retries++, 5)) + Math.random() * 400);
    };
  }
  function disconnect() { clearTimeout(timer); const old = socket; socket = null; old?.close(); }
  document.addEventListener('visibilitychange', () => { disconnect(); if (!document.hidden) connect(); });
  window.addEventListener('pagehide', () => { active = false; disconnect(); });
  window.addEventListener('pageshow', () => { active = true; if (!socket) connect(); });
  // Detect silent transport loss without erasing the last successfully drawn frame.
  setInterval(() => { if (socket?.readyState === WebSocket.OPEN && Date.now() - lastMessage > 45_000) socket.close(); }, 10_000);
  connect();
})();
