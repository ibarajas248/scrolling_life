import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WikimediaNetwork } from './network.mjs';
import { createStream } from './stream.mjs';
import { Wanderer } from './wander.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(process.env.BOT_DATA_DIR || path.join(dir, '.data'));
const contact = process.env.BOT_CONTACT?.trim();
const project = process.env.BOT_PROJECT_URL || 'https://scrollinglife.com';
const integer = (name, fallback, min, max) => Math.min(max, Math.max(min, Number.parseInt(process.env[name], 10) || fallback));
const log = value => console.log(typeof value === 'string' ? value : JSON.stringify(value));
let bot;
const publicDir = path.resolve(process.env.BOT_PUBLIC_DIR || path.join(dir, '../bot'));
const files = new Map([
  ['/bot', ['index.html', 'text/html; charset=utf-8']], ['/bot/', ['index.html', 'text/html; charset=utf-8']],
  ['/bot/viewer.js', ['viewer.js', 'text/javascript; charset=utf-8']], ['/bot/viewer.css', ['viewer.css', 'text/css']]
]);
const server = http.createServer(async (req, res) => {
  const target = files.get(req.url);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
  if (req.url === '/health') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: bot?.status || 'contact-required', viewers: stream.viewers, transitions: bot?.transitions || 0 })); return;
  }
  if (!target) { res.writeHead(404).end(); return; }
  try {
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src blob:; frame-ancestors 'self'");
    res.setHeader('Content-Type', target[1]);
    const body = await readFile(path.join(publicDir, target[0]));
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(404).end(); }
});
const stream = createStream(server, { maxViewers: integer('BOT_MAX_VIEWERS', 80, 1, 200), origin: process.env.BOT_PUBLIC_ORIGIN,
  onAudience: viewers => log({ event: 'audience', viewers }) });
await new Promise(resolve => server.listen(integer('BOT_PORT', 8094, 1, 65535), process.env.BOT_HOST || '127.0.0.1', resolve));
if (contact && !/[\r\n()]/.test(contact) && (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) || /^https:\/\/[^\s]+$/.test(contact))) {
  const userAgent = `ScrollingLifeBot/1.0 (${project}; ${contact}) Playwright/1.58.2`;
  const network = new WikimediaNetwork({ userAgent, dataDir, log });
  await network.init();
  bot = new Wanderer({ network, stream, dataDir, userAgent, log, executablePath: process.env.BOT_CHROMIUM_PATH,
    fps: integer('BOT_FPS', 12, 4, 20), quality: integer('BOT_JPEG_QUALITY', 70, 40, 85) });
  void bot.run().catch(error => { log({ event: 'fatal', message: error.message }); void shutdown(); });
} else log({ event: 'contact-required', message: 'Configura BOT_CONTACT con el contacto real del operador para iniciar Wikipedia.' });
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  const force = setTimeout(() => process.exit(1), 10_000); force.unref();
  stream.close(); server.close();
  await bot?.stop();
  clearTimeout(force);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Only the local acceptance harness imports these; no HTTP control route exists.
export { bot, shutdown };
