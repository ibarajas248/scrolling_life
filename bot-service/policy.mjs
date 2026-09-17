import robotsParser from 'robots-parser';

export const ORIGIN = 'https://es.wikipedia.org';
export const SEEDS = ['Arte', 'Internet', 'Archivo', 'Imagen', 'Conocimiento'].map(t => `${ORIGIN}/wiki/${t}`);
export const HOSTS = new Set(['es.wikipedia.org', 'upload.wikimedia.org', 'thumb.wikimedia.org', 'commons.wikimedia.org']);

export function articleUrl(value, base = ORIGIN) {
  try {
    const u = new URL(value, base);
    const title = decodeURIComponent(u.pathname.slice(6));
    if (u.origin !== ORIGIN || u.username || u.password || u.search ||
        !u.pathname.startsWith('/wiki/') || !title || /[:/#?\\]/.test(title)) return null;
    u.hash = '';
    return u.href;
  } catch { return null; }
}

export function allowedResource(value, type) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.port || u.username || u.password || !HOSTS.has(u.hostname)) return false;
    if (type === 'document') return Boolean(articleUrl(value));
    if (!['stylesheet', 'script', 'image', 'font'].includes(type)) return false;
    return ['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(u.hostname)
      ? u.pathname.startsWith('/wikipedia/')
      : u.pathname === '/w/load.php' || u.pathname.startsWith('/static/');
  } catch { return false; }
}

export function parseRobots(origin, text) {
  // Fail closed when an intermediary sends an HTML challenge with status 200.
  if (!/^\s*user-agent\s*:/im.test(text) || /<html/i.test(text)) throw new Error('robots.txt no verificable');
  return robotsParser(`${origin}/robots.txt`, text);
}

export function retryDelay(status, header, failures = 0, now = Date.now()) {
  const seconds = header && /^\d+(\.\d+)?$/.test(header.trim()) ? Number(header) * 1000 : Date.parse(header || '') - now;
  const floor = status >= 500 || status === 403 ? 900_000 : 60_000;
  return Math.max(Number.isFinite(seconds) ? seconds : 0, Math.min(3_600_000, floor * 2 ** Math.min(failures, 6)));
}
