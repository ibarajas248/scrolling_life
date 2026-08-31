import crypto from 'node:crypto';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'mysql',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'scrollinglife_tracker',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'scrollinglife_traffic',
  waitForConnections: true,
  connectionLimit: 4,
  namedPlaceholders: true,
  charset: 'utf8mb4',
});

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const nowSql = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

const DEFAULT_BASE_URLS = [
  'https://test.scrollinglife.com/',
  'https://test.scrollinglife.com/escritura-colectiva/',
  'https://scrollinglife.com/mantenimiento/',
];

const baseUrls = (process.env.DISCOVER_BASE_URLS || DEFAULT_BASE_URLS.join(','))
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const maxPages = Number(process.env.DISCOVER_MAX_PAGES || 300);
const allowedHostPattern = /(^|\.)scrollinglife\.com$/;
const ignoredPathPattern = /\.(?:png|jpe?g|gif|webp|svg|ico|css|js|map|json|txt|mp3|mp4|webm|pdf|zip|csv)$/i;

const normalizeUrl = (value, base) => {
  try {
    const raw = String(value || '').trim();
    if (!raw || raw.startsWith('#') || raw.startsWith('?')) return null;
    if (/^(?:javascript|mailto|tel|data):/i.test(raw)) return null;

    const hasProtocol = /^[a-z][a-z0-9+.-]*:/i.test(raw);
    const rootishBase = new URL('/', base).toString();
    let href = raw;
    let resolvedBase = base;
    if (!hasProtocol) {
      if (raw.startsWith('./')) {
        href = raw.slice(2);
        resolvedBase = rootishBase;
      } else if (raw.startsWith('../')) {
        href = raw.replace(/^(?:\.\.\/)+/, '');
        resolvedBase = rootishBase;
      } else if (!raw.startsWith('/')) {
        resolvedBase = rootishBase;
      }
    }
    const parsed = new URL(href, resolvedBase);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    if (!allowedHostPattern.test(parsed.hostname)) return null;
    parsed.hash = '';
    parsed.search = '';
    if (ignoredPathPattern.test(parsed.pathname)) return null;
    if (!parsed.pathname.endsWith('/')) {
      const last = parsed.pathname.split('/').pop() || '';
      if (!last.includes('.')) {
        parsed.pathname = `${parsed.pathname}/`;
      }
    }
    if (isLikelySyntheticPath(parsed.pathname)) return null;
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return null;
  }
};

const isLikelySyntheticPath = (pathname) => {
  const segments = pathname.split('/').filter(Boolean);
  const pagesSegmentCount = segments.filter((segment) => segment === 'pages').length;
  if (pagesSegmentCount > 1) return true;
  if (segments.length > 6) return true;
  return false;
};

const titleFromHtml = (html) => {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].replace(/\s+/g, ' ').trim().slice(0, 512) : '';
};

const linksFromHtml = (html, baseUrl) => {
  const links = new Set();
  const regex = /<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1/gi;
  let match;
  while ((match = regex.exec(html))) {
    const normalized = normalizeUrl(match[2], baseUrl);
    if (normalized) links.add(normalized);
  }
  return [...links];
};

const upsertPage = async (connection, page, discoveredBy, sourceUrl = null, httpStatus = null, contentType = null) => {
  const parsed = new URL(page.url);
  const urlHash = sha256(page.url);
  await connection.execute(
    `
      INSERT INTO tracked_pages
        (url_hash, url, host, path, title, first_seen, last_seen, discovered_by, source_url, status, last_http_status, content_type)
      VALUES
        (:urlHash, :url, :host, :path, :title, :firstSeen, :lastSeen, :discoveredBy, :sourceUrl, 'candidate', :httpStatus, :contentType)
      ON DUPLICATE KEY UPDATE
        last_seen = VALUES(last_seen),
        title = COALESCE(NULLIF(VALUES(title), ''), title),
        discovered_by = IF(discovered_by = 'traffic', VALUES(discovered_by), discovered_by),
        source_url = COALESCE(VALUES(source_url), source_url),
        last_http_status = COALESCE(VALUES(last_http_status), last_http_status),
        content_type = COALESCE(VALUES(content_type), content_type)
    `,
    {
      urlHash,
      url: page.url,
      host: parsed.hostname,
      path: parsed.pathname,
      title: page.title || '',
      firstSeen: nowSql(),
      lastSeen: nowSql(),
      discoveredBy,
      sourceUrl,
      httpStatus,
      contentType,
    },
  );
  return urlHash;
};

const upsertLink = async (connection, fromUrl, toUrl) => {
  await connection.execute(
    `
      INSERT INTO page_links
        (from_url_hash, to_url_hash, from_url, to_url, first_seen, last_seen)
      VALUES
        (:fromHash, :toHash, :fromUrl, :toUrl, :firstSeen, :lastSeen)
      ON DUPLICATE KEY UPDATE
        last_seen = VALUES(last_seen)
    `,
    {
      fromHash: sha256(fromUrl),
      toHash: sha256(toUrl),
      fromUrl,
      toUrl,
      firstSeen: nowSql(),
      lastSeen: nowSql(),
    },
  );
};

const addTrafficPages = async (connection) => {
  const [rows] = await connection.query(`
    SELECT host, path, MAX(title) AS title, MAX(event_time) AS last_seen, COUNT(*) AS visits
    FROM traffic_events
    WHERE event_type = 'pageview'
    GROUP BY host, path
    ORDER BY last_seen DESC
    LIMIT 5000
  `);

  for (const row of rows) {
    const url = `https://${row.host}${row.path}`;
    await upsertPage(connection, { url, title: row.title || '' }, 'traffic');
  }

  return rows.length;
};

const crawl = async (connection) => {
  const queue = [];
  const seen = new Set();
  let discovered = 0;
  let crawled = 0;

  for (const seed of baseUrls) {
    const normalized = normalizeUrl(seed, seed);
    if (normalized) queue.push({ url: normalized, source: null });
  }

  while (queue.length && crawled < maxPages) {
    const current = queue.shift();
    if (!current || seen.has(current.url)) continue;
    seen.add(current.url);

    let response;
    let html = '';
    let contentType = '';
    try {
      response = await fetch(current.url, { redirect: 'follow' });
      contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        html = await response.text();
      }
    } catch (error) {
      await upsertPage(connection, { url: current.url, title: '' }, 'crawler', current.source, 0, 'fetch-error');
      continue;
    }

    const finalUrl = normalizeUrl(response.url, current.url) || current.url;
    const title = html ? titleFromHtml(html) : '';
    await upsertPage(connection, { url: finalUrl, title }, 'crawler', current.source, response.status, contentType);
    crawled += 1;
    discovered += 1;

    if (!html) continue;

    for (const link of linksFromHtml(html, finalUrl)) {
      await upsertLink(connection, finalUrl, link);
      if (!seen.has(link) && queue.length + seen.size < maxPages * 3) {
        queue.push({ url: link, source: finalUrl });
      }
    }
  }

  return { crawled, discovered };
};

const main = async () => {
  const connection = await pool.getConnection();
  try {
    const trafficPages = await addTrafficPages(connection);
    const crawlResult = await crawl(connection);
    console.log(JSON.stringify({
      ok: true,
      trafficPages,
      ...crawlResult,
      baseUrls,
    }, null, 2));
  } finally {
    connection.release();
    await pool.end();
  }
};

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
