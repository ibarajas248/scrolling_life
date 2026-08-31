(() => {
  const VISITOR_KEY = 'sl_visitor_id';
  const SESSION_KEY = 'sl_session_v1';
  const SESSION_TTL_MS = 30 * 60 * 1000;
  const startedAt = Date.now();

  const randomId = () => {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID().replace(/-/g, '');
    }
    const values = new Uint32Array(4);
    window.crypto?.getRandomValues?.(values);
    return [...values].map((value) => value.toString(16).padStart(8, '0')).join('') || `${Date.now()}${Math.random()}`;
  };

  const readCookie = (name) => {
    const prefix = `${name}=`;
    return document.cookie
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix))
      ?.slice(prefix.length) || '';
  };

  const writeCookie = (name, value) => {
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=34560000; Path=/; SameSite=Lax${secure}`;
  };

  const readStorage = (key) => {
    try {
      return window.localStorage.getItem(key) || '';
    } catch {
      return '';
    }
  };

  const writeStorage = (key, value) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      return;
    }
  };

  const getVisitorId = () => {
    const existing = readCookie(VISITOR_KEY) || readStorage(VISITOR_KEY);
    if (existing) {
      writeCookie(VISITOR_KEY, existing);
      return existing;
    }
    const next = randomId();
    writeCookie(VISITOR_KEY, next);
    writeStorage(VISITOR_KEY, next);
    return next;
  };

  const getSessionId = () => {
    const raw = readStorage(SESSION_KEY);
    const now = Date.now();

    if (raw) {
      try {
        const session = JSON.parse(raw);
        if (session.id && now - Number(session.lastSeen || 0) < SESSION_TTL_MS) {
          session.lastSeen = now;
          writeStorage(SESSION_KEY, JSON.stringify(session));
          return session.id;
        }
      } catch {
        // Ignore corrupted session values.
      }
    }

    const next = { id: randomId(), lastSeen: now };
    writeStorage(SESSION_KEY, JSON.stringify(next));
    return next.id;
  };

  const endpointForLocation = () => {
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      return '/traffic/collect';
    }
    if (location.hostname.endsWith('scrollinglife.com')) {
      return `${location.origin}/traffic/collect`;
    }
    return 'https://test.scrollinglife.com/traffic/collect';
  };

  const compactUrl = (value) => {
    try {
      const parsed = new URL(value, location.href);
      parsed.hash = '';
      parsed.search = '';
      return `${parsed.origin}${parsed.pathname}`;
    } catch {
      return '';
    }
  };

  const basePayload = (eventType, details = {}) => ({
    eventType,
    eventTime: new Date().toISOString(),
    visitorId: getVisitorId(),
    sessionId: getSessionId(),
    url: compactUrl(location.href),
    title: document.title || '',
    referrer: compactUrl(document.referrer),
    language: navigator.language || '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    screenWidth: window.screen?.width || null,
    screenHeight: window.screen?.height || null,
    viewportWidth: window.innerWidth || null,
    viewportHeight: window.innerHeight || null,
    devicePixelRatio: window.devicePixelRatio || null,
    connectionType: navigator.connection?.effectiveType || '',
    details,
  });

  const send = (eventType, details) => {
    const payload = JSON.stringify(basePayload(eventType, details));
    const endpoint = endpointForLocation();

    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'text/plain;charset=UTF-8' });
      if (navigator.sendBeacon(endpoint, blob)) return;
    }

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: payload,
      keepalive: true,
      mode: 'cors',
    }).catch(() => {});
  };

  window.ScrollingLifeTrack = send;

  const sendPageview = () => {
    send('pageview', {
      colorScheme: window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sendPageview, { once: true });
  } else {
    window.setTimeout(sendPageview, 0);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      send('page_hide', { durationMs: Date.now() - startedAt });
    }
  });
})();
