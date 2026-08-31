import http from 'node:http';
import crypto from 'node:crypto';
import { URL } from 'node:url';
import mysql from 'mysql2/promise';

const PORT = Number(process.env.PORT || 8090);
const MAX_BODY_BYTES = 64 * 1024;
const ADMIN_TOKEN = process.env.TRACKER_ADMIN_TOKEN || '';
const IP_HASH_SALT = process.env.IP_HASH_SALT || 'scrollinglife-local-salt';

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'mysql',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'scrollinglife_tracker',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'scrollinglife_traffic',
  waitForConnections: true,
  connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
  namedPlaceholders: true,
  charset: 'utf8mb4',
});

const nowSql = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

const uuidish = (value) => {
  if (typeof value !== 'string') return crypto.randomUUID();
  const trimmed = value.trim().slice(0, 64);
  return /^[a-zA-Z0-9_-]{16,64}$/.test(trimmed) ? trimmed : crypto.randomUUID();
};

const safeText = (value, limit = 255) => {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, limit);
};

const safePath = (value) => {
  if (typeof value !== 'string') return '/';
  const trimmed = value.trim();
  return trimmed.startsWith('/') ? trimmed.slice(0, 2048) : `/${trimmed.slice(0, 2047)}`;
};

const normalizePage = (rawUrl, fallbackHost = '') => {
  try {
    const parsed = new URL(rawUrl);
    return {
      host: parsed.hostname.toLowerCase(),
      path: parsed.pathname || '/',
      url: `${parsed.origin}${parsed.pathname || '/'}`,
    };
  } catch {
    return {
      host: fallbackHost.toLowerCase(),
      path: '/',
      url: fallbackHost ? `https://${fallbackHost}/` : '',
    };
  }
};

const firstHeader = (headers, key) => {
  const value = headers[key.toLowerCase()];
  return Array.isArray(value) ? value[0] : value || '';
};

const clientIpFromHeaders = (req) => {
  const cfIp = firstHeader(req.headers, 'cf-connecting-ip');
  if (cfIp) return cfIp;
  const xff = firstHeader(req.headers, 'x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.socket.remoteAddress || '';
};

const jsonResponse = (res, status, body, extraHeaders = {}) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(payload),
    ...extraHeaders,
  });
  res.end(payload);
};

const textResponse = (res, status, body, contentType = 'text/plain; charset=utf-8', extraHeaders = {}) => {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
    ...extraHeaders,
  });
  res.end(body);
};

const corsHeaders = (req) => {
  const origin = firstHeader(req.headers, 'origin');
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-Admin-Token',
    'Vary': 'Origin',
  };
};

const readBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  let total = 0;

  req.on('data', (chunk) => {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      reject(Object.assign(new Error('Payload demasiado grande.'), { status: 413 }));
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });

  req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  req.on('error', reject);
});

const parseJsonBody = async (req) => {
  const raw = await readBody(req);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw Object.assign(new Error('JSON invalido.'), { status: 400 });
  }
};

const initDb = async () => {
  const connection = await pool.getConnection();
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS traffic_visitors (
        visitor_id VARCHAR(64) PRIMARY KEY,
        first_seen DATETIME NOT NULL,
        last_seen DATETIME NOT NULL,
        first_host VARCHAR(255),
        first_path VARCHAR(2048),
        last_host VARCHAR(255),
        last_path VARCHAR(2048),
        cf_country VARCHAR(8),
        ip_hash CHAR(64),
        user_agent_hash CHAR(64),
        events_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
        pageviews_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
        INDEX idx_last_seen (last_seen),
        INDEX idx_country (cf_country)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS traffic_sessions (
        session_id VARCHAR(64) PRIMARY KEY,
        visitor_id VARCHAR(64) NOT NULL,
        started_at DATETIME NOT NULL,
        last_seen DATETIME NOT NULL,
        entry_host VARCHAR(255),
        entry_path VARCHAR(2048),
        last_host VARCHAR(255),
        last_path VARCHAR(2048),
        referrer VARCHAR(2048),
        events_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
        pageviews_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
        INDEX idx_visitor (visitor_id),
        INDEX idx_last_seen (last_seen)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS traffic_events (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        event_time DATETIME NOT NULL,
        received_at DATETIME NOT NULL,
        event_type VARCHAR(64) NOT NULL,
        visitor_id VARCHAR(64) NOT NULL,
        session_id VARCHAR(64) NOT NULL,
        host VARCHAR(255) NOT NULL,
        path VARCHAR(2048) NOT NULL,
        url VARCHAR(2300) NOT NULL,
        title VARCHAR(512),
        referrer VARCHAR(2048),
        cf_country VARCHAR(8),
        cf_ray VARCHAR(128),
        ip_hash CHAR(64),
        user_agent_hash CHAR(64),
        user_agent VARCHAR(768),
        language VARCHAR(64),
        timezone_name VARCHAR(128),
        screen_width INT,
        screen_height INT,
        viewport_width INT,
        viewport_height INT,
        device_pixel_ratio DECIMAL(6,2),
        connection_type VARCHAR(64),
        details JSON,
        INDEX idx_event_time (event_time),
        INDEX idx_visitor_time (visitor_id, event_time),
        INDEX idx_session_time (session_id, event_time),
        INDEX idx_host_path (host, path(255)),
        INDEX idx_event_type (event_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tracked_pages (
        url_hash CHAR(64) PRIMARY KEY,
        url VARCHAR(2300) NOT NULL,
        host VARCHAR(255) NOT NULL,
        path VARCHAR(2048) NOT NULL,
        title VARCHAR(512),
        first_seen DATETIME NOT NULL,
        last_seen DATETIME NOT NULL,
        discovered_by VARCHAR(64) NOT NULL,
        source_url VARCHAR(2300),
        status VARCHAR(32) NOT NULL DEFAULT 'candidate',
        last_http_status INT,
        content_type VARCHAR(255),
        visits_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
        notes TEXT,
        UNIQUE KEY uniq_url (url(768)),
        INDEX idx_host_path (host, path(255)),
        INDEX idx_status (status),
        INDEX idx_last_seen (last_seen)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS page_links (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        from_url_hash CHAR(64) NOT NULL,
        to_url_hash CHAR(64) NOT NULL,
        from_url VARCHAR(2300) NOT NULL,
        to_url VARCHAR(2300) NOT NULL,
        first_seen DATETIME NOT NULL,
        last_seen DATETIME NOT NULL,
        UNIQUE KEY uniq_link (from_url_hash, to_url_hash),
        INDEX idx_to (to_url_hash)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } finally {
    connection.release();
  }
};

const recordPageCandidate = async (connection, page, payload, receivedAt, eventType) => {
  const urlHash = sha256(page.url);
  const title = safeText(payload.title, 512);
  const isPageview = eventType === 'pageview' ? 1 : 0;
  await connection.execute(
    `
      INSERT INTO tracked_pages
        (url_hash, url, host, path, title, first_seen, last_seen, discovered_by, source_url, visits_count)
      VALUES
        (:urlHash, :url, :host, :path, :title, :firstSeen, :lastSeen, 'traffic', NULL, :visits)
      ON DUPLICATE KEY UPDATE
        last_seen = VALUES(last_seen),
        title = COALESCE(NULLIF(VALUES(title), ''), title),
        visits_count = visits_count + VALUES(visits_count)
    `,
    {
      urlHash,
      url: page.url,
      host: page.host,
      path: page.path,
      title,
      firstSeen: receivedAt,
      lastSeen: receivedAt,
      visits: isPageview,
    },
  );
};

const collectEvent = async (req, payload) => {
  const receivedAt = nowSql();
  const eventType = safeText(payload.eventType || 'event', 64) || 'event';
  const visitorId = uuidish(payload.visitorId);
  const sessionId = uuidish(payload.sessionId);
  const page = normalizePage(payload.url || '', firstHeader(req.headers, 'host'));
  const title = safeText(payload.title, 512);
  const referrer = safeText(payload.referrer, 2048);
  const userAgent = safeText(firstHeader(req.headers, 'user-agent'), 768);
  const userAgentHash = userAgent ? sha256(userAgent) : null;
  const clientIp = clientIpFromHeaders(req);
  const ipHash = clientIp ? sha256(`${IP_HASH_SALT}:${clientIp}`) : null;
  const cfCountry = safeText(firstHeader(req.headers, 'cf-ipcountry'), 8);
  const cfRay = safeText(firstHeader(req.headers, 'cf-ray'), 128);
  const eventTime = payload.eventTime ? nowSqlFromClient(payload.eventTime) : receivedAt;
  const isPageview = eventType === 'pageview';
  const details = JSON.stringify(payload.details && typeof payload.details === 'object' ? payload.details : {});

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `
        INSERT INTO traffic_visitors
          (visitor_id, first_seen, last_seen, first_host, first_path, last_host, last_path, cf_country, ip_hash, user_agent_hash, events_count, pageviews_count)
        VALUES
          (:visitorId, :firstSeen, :lastSeen, :host, :path, :host, :path, :cfCountry, :ipHash, :userAgentHash, 1, :pageviews)
        ON DUPLICATE KEY UPDATE
          last_seen = VALUES(last_seen),
          last_host = VALUES(last_host),
          last_path = VALUES(last_path),
          cf_country = COALESCE(NULLIF(VALUES(cf_country), ''), cf_country),
          ip_hash = COALESCE(VALUES(ip_hash), ip_hash),
          user_agent_hash = COALESCE(VALUES(user_agent_hash), user_agent_hash),
          events_count = events_count + 1,
          pageviews_count = pageviews_count + VALUES(pageviews_count)
      `,
      {
        visitorId,
        firstSeen: receivedAt,
        lastSeen: receivedAt,
        host: page.host,
        path: page.path,
        cfCountry,
        ipHash,
        userAgentHash,
        pageviews: isPageview ? 1 : 0,
      },
    );

    await connection.execute(
      `
        INSERT INTO traffic_sessions
          (session_id, visitor_id, started_at, last_seen, entry_host, entry_path, last_host, last_path, referrer, events_count, pageviews_count)
        VALUES
          (:sessionId, :visitorId, :startedAt, :lastSeen, :host, :path, :host, :path, :referrer, 1, :pageviews)
        ON DUPLICATE KEY UPDATE
          last_seen = VALUES(last_seen),
          last_host = VALUES(last_host),
          last_path = VALUES(last_path),
          events_count = events_count + 1,
          pageviews_count = pageviews_count + VALUES(pageviews_count)
      `,
      {
        sessionId,
        visitorId,
        startedAt: receivedAt,
        lastSeen: receivedAt,
        host: page.host,
        path: page.path,
        referrer,
        pageviews: isPageview ? 1 : 0,
      },
    );

    await connection.execute(
      `
        INSERT INTO traffic_events
          (event_time, received_at, event_type, visitor_id, session_id, host, path, url, title, referrer, cf_country, cf_ray, ip_hash, user_agent_hash, user_agent, language, timezone_name, screen_width, screen_height, viewport_width, viewport_height, device_pixel_ratio, connection_type, details)
        VALUES
          (:eventTime, :receivedAt, :eventType, :visitorId, :sessionId, :host, :path, :url, :title, :referrer, :cfCountry, :cfRay, :ipHash, :userAgentHash, :userAgent, :language, :timezoneName, :screenWidth, :screenHeight, :viewportWidth, :viewportHeight, :devicePixelRatio, :connectionType, CAST(:details AS JSON))
      `,
      {
        eventTime,
        receivedAt,
        eventType,
        visitorId,
        sessionId,
        host: page.host,
        path: page.path,
        url: page.url,
        title,
        referrer,
        cfCountry,
        cfRay,
        ipHash,
        userAgentHash,
        userAgent,
        language: safeText(payload.language, 64),
        timezoneName: safeText(payload.timezone, 128),
        screenWidth: numericOrNull(payload.screenWidth),
        screenHeight: numericOrNull(payload.screenHeight),
        viewportWidth: numericOrNull(payload.viewportWidth),
        viewportHeight: numericOrNull(payload.viewportHeight),
        devicePixelRatio: numericOrNull(payload.devicePixelRatio),
        connectionType: safeText(payload.connectionType, 64),
        details,
      },
    );

    await recordPageCandidate(connection, page, payload, receivedAt, eventType);
    await connection.commit();

    return { ok: true, visitorId, sessionId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const nowSqlFromClient = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return nowSql();
  return date.toISOString().slice(0, 19).replace('T', ' ');
};

const numericOrNull = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const adminAllowed = (req, url) => {
  if (!ADMIN_TOKEN) return false;
  const headerToken = firstHeader(req.headers, 'x-admin-token');
  const queryToken = url.searchParams.get('token') || '';
  const candidate = Buffer.from(headerToken || queryToken || '');
  const expected = Buffer.from(ADMIN_TOKEN);
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
};

const csvEscape = (value) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const rowsToCsv = (rows) => {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')),
  ].join('\n');
};

const adminCsv = async (name) => {
  const queries = {
    visitors: `
      SELECT visitor_id, first_seen, last_seen, first_host, first_path, last_host, last_path,
             cf_country, ip_hash, user_agent_hash, events_count, pageviews_count
      FROM traffic_visitors
      ORDER BY last_seen DESC
      LIMIT 20000
    `,
    sessions: `
      SELECT session_id, visitor_id, started_at, last_seen, entry_host, entry_path,
             last_host, last_path, referrer, events_count, pageviews_count
      FROM traffic_sessions
      ORDER BY last_seen DESC
      LIMIT 20000
    `,
    events: `
      SELECT id, event_time, event_type, visitor_id, session_id, host, path, title,
             referrer, cf_country, cf_ray, language, timezone_name, viewport_width,
             viewport_height, connection_type
      FROM traffic_events
      ORDER BY event_time DESC
      LIMIT 50000
    `,
    pages: `
      SELECT url, host, path, title, first_seen, last_seen, discovered_by, status,
             last_http_status, content_type, visits_count, source_url
      FROM tracked_pages
      ORDER BY last_seen DESC
      LIMIT 20000
    `,
  };

  if (!queries[name]) return null;
  const [rows] = await pool.query(queries[name]);
  return rowsToCsv(rows);
};

const summary = async () => {
  const [[visitors]] = await pool.query('SELECT COUNT(*) AS total FROM traffic_visitors');
  const [[sessions]] = await pool.query('SELECT COUNT(*) AS total FROM traffic_sessions');
  const [[events]] = await pool.query('SELECT COUNT(*) AS total FROM traffic_events');
  const [[pages]] = await pool.query('SELECT COUNT(*) AS total FROM tracked_pages');
  const [recentPages] = await pool.query(`
    SELECT host, path, title, visits_count, last_seen
    FROM tracked_pages
    ORDER BY visits_count DESC, last_seen DESC
    LIMIT 20
  `);
  return {
    visitors: visitors.total,
    sessions: sessions.total,
    events: events.total,
    pages: pages.total,
    recentPages,
  };
};

const clampDays = (value) => {
  const days = Number.parseInt(value, 10);
  if (!Number.isFinite(days)) return 14;
  return Math.min(Math.max(days, 1), 90);
};

const firstRow = (rows, fallback = {}) => rows[0] || fallback;

const trafficDashboard = async (days) => {
  const [[totals]] = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM traffic_visitors) AS visitors,
      (SELECT COUNT(*) FROM traffic_sessions) AS sessions,
      (SELECT COUNT(*) FROM traffic_events) AS events,
      (SELECT COUNT(*) FROM traffic_events WHERE event_type = 'pageview') AS pageviews,
      (SELECT COUNT(*) FROM tracked_pages) AS tracked_pages
  `);

  const [last24Rows] = await pool.query(`
    SELECT
      COUNT(DISTINCT visitor_id) AS visitors,
      COUNT(DISTINCT session_id) AS sessions,
      COUNT(*) AS events,
      COALESCE(SUM(event_type = 'pageview'), 0) AS pageviews
    FROM traffic_events
    WHERE event_time >= UTC_TIMESTAMP() - INTERVAL 1 DAY
  `);

  const [byDay] = await pool.query(`
    SELECT
      DATE(CONVERT_TZ(event_time, '+00:00', '-05:00')) AS day,
      COUNT(DISTINCT visitor_id) AS visitors,
      COUNT(DISTINCT session_id) AS sessions,
      COUNT(*) AS events,
      COALESCE(SUM(event_type = 'pageview'), 0) AS pageviews
    FROM traffic_events
    WHERE DATE(CONVERT_TZ(event_time, '+00:00', '-05:00')) >=
      DATE_SUB(DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '-05:00')), INTERVAL ${days - 1} DAY)
    GROUP BY DATE(CONVERT_TZ(event_time, '+00:00', '-05:00'))
    ORDER BY day ASC
  `);

  const [topPages] = await pool.query(`
    SELECT
      host,
      path,
      COALESCE(NULLIF(title, ''), path) AS title,
      visits_count AS visits,
      CONVERT_TZ(last_seen, '+00:00', '-05:00') AS last_seen_colombia
    FROM tracked_pages
    WHERE visits_count > 0
    ORDER BY visits_count DESC, last_seen DESC
    LIMIT 20
  `);

  const [countries] = await pool.query(`
    SELECT
      COALESCE(NULLIF(cf_country, ''), 'sin_dato') AS country,
      COUNT(DISTINCT visitor_id) AS visitors,
      COUNT(*) AS events
    FROM traffic_events
    WHERE event_time >= UTC_TIMESTAMP() - INTERVAL ${days} DAY
    GROUP BY COALESCE(NULLIF(cf_country, ''), 'sin_dato')
    ORDER BY visitors DESC, events DESC
    LIMIT 20
  `);

  const [referrers] = await pool.query(`
    SELECT
      COALESCE(NULLIF(referrer, ''), 'directo') AS referrer,
      COUNT(DISTINCT session_id) AS sessions,
      COUNT(*) AS pageviews
    FROM traffic_events
    WHERE event_type = 'pageview'
      AND event_time >= UTC_TIMESTAMP() - INTERVAL ${days} DAY
    GROUP BY COALESCE(NULLIF(referrer, ''), 'directo')
    ORDER BY pageviews DESC
    LIMIT 20
  `);

  const [eventsByType] = await pool.query(`
    SELECT
      event_type,
      COUNT(*) AS events
    FROM traffic_events
    WHERE event_time >= UTC_TIMESTAMP() - INTERVAL ${days} DAY
    GROUP BY event_type
    ORDER BY events DESC
  `);

  return {
    totals,
    last24h: firstRow(last24Rows, { visitors: 0, sessions: 0, events: 0, pageviews: 0 }),
    byDay,
    topPages,
    countries,
    referrers,
    eventsByType,
  };
};

const lienzoDashboard = async (days) => {
  const [[totals]] = await pool.query(`
    SELECT
      COUNT(*) AS sessions,
      COUNT(DISTINCT NULLIF(firebase_uid, '')) AS unique_authenticated_users,
      COALESCE(SUM(user_type = 'authenticated'), 0) AS authenticated_sessions,
      COALESCE(SUM(user_type = 'guest'), 0) AS guest_sessions,
      COALESCE(SUM(logout_at IS NULL AND last_seen_at >= UTC_TIMESTAMP(3) - INTERVAL 30 MINUTE), 0) AS active_sessions,
      COALESCE(SUM(stroke_count), 0) AS strokes,
      COALESCE(SUM(draw_event_count), 0) AS draw_events
    FROM lienzo_analytics.login_sessions
  `);

  const [last24Rows] = await pool.query(`
    SELECT
      COUNT(*) AS sessions,
      COUNT(DISTINCT NULLIF(firebase_uid, '')) AS unique_authenticated_users,
      COALESCE(SUM(user_type = 'authenticated'), 0) AS authenticated_sessions,
      COALESCE(SUM(user_type = 'guest'), 0) AS guest_sessions,
      COALESCE(SUM(stroke_count), 0) AS strokes,
      COALESCE(SUM(draw_event_count), 0) AS draw_events
    FROM lienzo_analytics.login_sessions
    WHERE login_at >= UTC_TIMESTAMP(3) - INTERVAL 1 DAY
  `);

  const [byDay] = await pool.query(`
    SELECT
      DATE(CONVERT_TZ(login_at, '+00:00', '-05:00')) AS day,
      COUNT(*) AS sessions,
      COUNT(DISTINCT NULLIF(firebase_uid, '')) AS unique_authenticated_users,
      COALESCE(SUM(user_type = 'authenticated'), 0) AS authenticated_sessions,
      COALESCE(SUM(user_type = 'guest'), 0) AS guest_sessions,
      COALESCE(SUM(stroke_count), 0) AS strokes,
      COALESCE(SUM(draw_event_count), 0) AS draw_events
    FROM lienzo_analytics.login_sessions
    WHERE DATE(CONVERT_TZ(login_at, '+00:00', '-05:00')) >=
      DATE_SUB(DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '-05:00')), INTERVAL ${days - 1} DAY)
    GROUP BY DATE(CONVERT_TZ(login_at, '+00:00', '-05:00'))
    ORDER BY day ASC
  `);

  const [byCanvas] = await pool.query(`
    SELECT
      canvas_id,
      COUNT(*) AS sessions,
      COUNT(DISTINCT NULLIF(firebase_uid, '')) AS unique_authenticated_users,
      COALESCE(SUM(stroke_count), 0) AS strokes,
      COALESCE(SUM(draw_event_count), 0) AS draw_events,
      MAX(CONVERT_TZ(last_seen_at, '+00:00', '-05:00')) AS last_seen_colombia
    FROM lienzo_analytics.login_sessions
    WHERE login_at >= UTC_TIMESTAMP(3) - INTERVAL ${days} DAY
    GROUP BY canvas_id
    ORDER BY sessions DESC, last_seen_colombia DESC
    LIMIT 20
  `);

  const [sessionTypes] = await pool.query(`
    SELECT
      user_type,
      COUNT(*) AS sessions
    FROM lienzo_analytics.login_sessions
    WHERE login_at >= UTC_TIMESTAMP(3) - INTERVAL ${days} DAY
    GROUP BY user_type
    ORDER BY sessions DESC
  `);

  const [recentSessions] = await pool.query(`
    SELECT
      user_type,
      canvas_id,
      CONVERT_TZ(login_at, '+00:00', '-05:00') AS login_at_colombia,
      CONVERT_TZ(last_seen_at, '+00:00', '-05:00') AS last_seen_colombia,
      logout_at IS NULL AS open_session,
      stroke_count,
      draw_event_count
    FROM lienzo_analytics.login_sessions
    ORDER BY login_at DESC
    LIMIT 25
  `);

  return {
    totals,
    last24h: firstRow(last24Rows, {
      sessions: 0,
      unique_authenticated_users: 0,
      authenticated_sessions: 0,
      guest_sessions: 0,
      strokes: 0,
      draw_events: 0,
    }),
    byDay,
    byCanvas,
    sessionTypes,
    recentSessions,
  };
};

const dashboard = async (days) => {
  const [traffic, lienzo] = await Promise.all([
    trafficDashboard(days),
    lienzoDashboard(days),
  ]);
  const [[clock]] = await pool.query(`
    SELECT CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '-05:00') AS generated_at_colombia
  `);

  return {
    generatedAt: clock.generated_at_colombia,
    timezone: 'America/Bogota',
    days,
    traffic,
    lienzo,
  };
};

const router = async (req, res) => {
  const url = new URL(req.url || '/', `http://${firstHeader(req.headers, 'host') || 'localhost'}`);
  const cors = corsHeaders(req);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors);
    res.end();
    return;
  }

  if (req.method === 'GET' && url.pathname === '/healthz') {
    const [[ping]] = await pool.query('SELECT 1 AS ok');
    jsonResponse(res, 200, { ok: ping.ok === 1 }, cors);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/collect') {
    const payload = await parseJsonBody(req);
    await collectEvent(req, payload);
    res.writeHead(204, cors);
    res.end();
    return;
  }

  if (req.method === 'GET' && url.pathname === '/admin/summary.json') {
    if (!adminAllowed(req, url)) {
      jsonResponse(res, 401, { error: 'No autorizado.' }, cors);
      return;
    }
    jsonResponse(res, 200, await summary(), cors);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/admin/dashboard.json') {
    if (!adminAllowed(req, url)) {
      jsonResponse(res, 401, { error: 'No autorizado.' }, cors);
      return;
    }
    jsonResponse(res, 200, await dashboard(clampDays(url.searchParams.get('days'))), cors);
    return;
  }

  const csvMatch = url.pathname.match(/^\/admin\/(visitors|sessions|events|pages)\.csv$/);
  if (req.method === 'GET' && csvMatch) {
    if (!adminAllowed(req, url)) {
      jsonResponse(res, 401, { error: 'No autorizado.' }, cors);
      return;
    }
    const csv = await adminCsv(csvMatch[1]);
    textResponse(res, 200, csv || '', 'text/csv; charset=utf-8', {
      ...cors,
      'Content-Disposition': `attachment; filename="${csvMatch[1]}.csv"`,
    });
    return;
  }

  jsonResponse(res, 404, { error: 'Ruta no encontrada.' }, cors);
};

await initDb();

const server = http.createServer((req, res) => {
  router(req, res).catch((error) => {
    console.error(error);
    const status = error.status || 500;
    jsonResponse(res, status, { error: status === 500 ? 'Error interno.' : error.message }, corsHeaders(req));
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`traffic tracker listening on :${PORT}`);
});
