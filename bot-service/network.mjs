import { mkdir, readFile, writeFile, readdir, stat, unlink, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import CachePolicy from 'http-cache-semantics';
import { allowedResource, parseRobots, retryDelay, HOSTS } from './policy.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const MAX_BODY = 8 * 1024 * 1024;

// All browser traffic passes this one queue, including robots and media.
// Playwright routing disables Chromium's cache, so HTTP cache lives here on disk.
export class WikimediaNetwork {
  constructor({ userAgent, dataDir, log = console.log }) {
    this.userAgent = userAgent;
    this.dataDir = dataDir;
    this.log = log;
    this.tail = Promise.resolve();
    this.pending = 0;
    this.next = 0;
    this.pauseUntil = 0;
    this.failures = 0;
    this.robots = new Map();
    this.cancelled = new WeakSet();
    this.controller = new AbortController();
  }
  async init() {
    await mkdir(path.join(this.dataDir, 'cache'), { recursive: true });
    try { this.pauseUntil = JSON.parse(await readFile(path.join(this.dataDir, 'cooldown.json'), 'utf8')).until || 0; } catch {}
    await this.prune();
  }
  async prune() {
    const dir = path.join(this.dataDir, 'cache');
    const files = await Promise.all((await readdir(dir)).map(async name => ({ name, ...await stat(path.join(dir, name)) })));
    let total = files.reduce((n, f) => n + f.size, 0);
    let count = files.length;
    for (const f of files.sort((a, b) => a.mtimeMs - b.mtimeMs)) {
      if (total <= 192 * 1024 * 1024 && count <= 3000) break;
      await unlink(path.join(dir, f.name)); total -= f.size; count--;
    }
  }
  async pause(status, header) {
    this.pauseUntil = Math.max(this.pauseUntil, Date.now() + retryDelay(status, header, this.failures++));
    await writeFile(path.join(this.dataDir, 'cooldown.json'), JSON.stringify({ until: this.pauseUntil }));
    this.log(JSON.stringify({ event: 'upstream-pause', status, until: new Date(this.pauseUntil).toISOString() }));
  }
  async ready() {
    while (Date.now() < this.pauseUntil) {
      this.controller.signal.throwIfAborted();
      await sleep(Math.min(1000, this.pauseUntil - Date.now()));
    }
  }
  async wire(url, headers) {
    try { return await this.fetchWire(url, headers); }
    catch (error) {
      if (!this.controller.signal.aborted && Date.now() >= this.pauseUntil) await this.pause(0, null);
      throw error;
    }
  }
  async fetchWire(url, headers) {
    await this.ready();
    await sleep(Math.max(0, this.next - Date.now()));
    this.controller.signal.throwIfAborted();
    const started = Date.now();
    const response = await fetch(url, {
      headers: { ...headers, 'user-agent': this.userAgent, 'accept-encoding': 'gzip' },
      redirect: 'manual', signal: AbortSignal.any([this.controller.signal, AbortSignal.timeout(45_000)])
    });
    if (response.status === 429 || response.status === 403 || response.status >= 500) {
      await response.body?.cancel();
      await this.pause(response.status, response.headers.get('retry-after'));
      throw new Error(`Wikimedia HTTP ${response.status}`);
    }
    const chunks = []; let size = 0;
    for await (const chunk of response.body || []) {
      size += chunk.length;
      if (size > MAX_BODY) throw new Error('Recurso supera 8 MiB');
      chunks.push(chunk);
      // <= 1 MiB/s globally, below the 25 Mbps media limit, even over 10 seconds.
      await sleep(Math.max(0, started + size / 1024 - Date.now()));
    }
    this.next = Date.now() + 1000;
    const resultHeaders = Object.fromEntries(response.headers);
    delete resultHeaders['content-encoding']; delete resultHeaders['content-length'];
    delete resultHeaders['transfer-encoding'];
    if (process.env.BOT_LOG_RESOURCES === '1') this.log(JSON.stringify({ event: 'resource', url, status: response.status, bytes: size,
      cacheControl: resultHeaders['cache-control'], setsCookie: Boolean(resultHeaders['set-cookie']), location: resultHeaders.location }));
    return { status: response.status, headers: resultHeaders, body: Buffer.concat(chunks) };
  }
  async getRobots(origin) {
    const current = this.robots.get(origin);
    if (current && current.until > Date.now()) return current.rules;
    let target = `${origin}/robots.txt`;
    let response;
    for (let redirects = 0; redirects <= 5; redirects++) {
      response = await this.cached(target, { accept: 'text/plain' });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const next = new URL(response.headers.location, target);
      if (redirects === 5 || next.protocol !== 'https:' || next.port || next.username || next.password ||
          !HOSTS.has(next.hostname)) throw new Error(`Redirección de robots no permitida: ${next.href}`);
      target = next.href;
    }
    if (![200, 404, 410].includes(response.status)) throw new Error(`robots.txt HTTP ${response.status}`);
    // RFC 9309: a missing file imposes no rules. Challenges, 403, 429 and 5xx
    // are never interpreted as missing. Redirected rules apply to the original origin.
    let rules;
    try {
      rules = parseRobots(origin, response.status === 200 ? response.body.toString() : 'User-agent: *\nDisallow:');
    } catch (error) {
      // A malformed robots response denies this origin for one hour, rather than
      // continually retrying it or stopping unrelated, permitted article access.
      this.robots.set(origin, { rules: parseRobots(origin, 'User-agent: *\nDisallow: /'), until: Date.now() + 3_600_000 });
      this.log(JSON.stringify({ event: 'robots-unverifiable', origin, target, message: error.message }));
      return this.robots.get(origin).rules;
    }
    this.robots.set(origin, { rules, until: Date.now() + 3_600_000 });
    return rules;
  }
  async cached(url, headers) {
    const req = { url, method: 'GET', headers: { ...headers, 'user-agent': this.userAgent } };
    const file = path.join(this.dataDir, 'cache', createHash('sha256').update(url).digest('hex') + '.json');
    let old;
    try {
      old = JSON.parse(await readFile(file, 'utf8'));
      const policy = CachePolicy.fromObject(old.policy);
      if (policy.satisfiesWithoutRevalidation(req)) return { status: old.status, headers: policy.responseHeaders(), body: Buffer.from(old.body, 'base64') };
      headers = policy.revalidationHeaders(req);
    } catch { old = null; }
    let result = await this.wire(url, headers);
    // Set-Cookie does not forbid caching the representation (RFC 9111).
    // Do not persist/replay cookie headers; this is one anonymous, read-only client.
    const policyHeaders = { ...result.headers };
    delete policyHeaders['set-cookie'];
    const cacheResponse = { ...result, headers: policyHeaders };
    let policy;
    if (old) {
      const revalidated = CachePolicy.fromObject(old.policy).revalidatedPolicy(req, cacheResponse);
      policy = revalidated.policy;
      if (!revalidated.modified) result = { status: old.status, headers: policy.responseHeaders(), body: Buffer.from(old.body, 'base64') };
    } else policy = new CachePolicy(req, cacheResponse, { shared: false });
    if (policy.storable() && result.status === 200) {
      await writeFile(file + '.tmp', JSON.stringify({ status: result.status, policy: policy.toObject(), body: result.body.toString('base64') }));
      await rename(file + '.tmp', file);
      await this.prune();
    }
    return result;
  }
  async route(route) {
    const request = route.request();
    if (request.method() !== 'GET' || !allowedResource(request.url(), request.resourceType()) ||
        /prefetch/i.test(request.headers()['sec-purpose'] || request.headers().purpose || '') || this.pending >= 128) {
      if (process.env.BOT_LOG_RESOURCES === '1') this.log(JSON.stringify({ event: 'resource-blocked', url: request.url(), type: request.resourceType() }));
      return route.abort().catch(() => {});
    }
    const frame = request.frame();
    const originalPage = frame.page();
    const stale = () => originalPage.isClosed() || frame.isDetached() || this.cancelled.has(request);
    this.pending++;
    const job = this.tail.then(async () => {
      try {
        await this.ready();
        if (stale()) return await route.abort();
        const rules = await this.getRobots(new URL(request.url()).origin);
        if (rules.isAllowed(request.url(), this.userAgent) !== true) return await route.abort();
        const delay = rules.getCrawlDelay(this.userAgent);
        if (delay) this.next = Math.max(this.next, Date.now() + delay * 1000);
        const headers = { accept: request.headers().accept || '*/*', 'accept-language': 'es' };
        if (stale()) return await route.abort();
        const response = await this.cached(request.url(), headers);
        if (response.status >= 300 && response.status < 400) {
          const target = new URL(response.headers.location, request.url()).href;
          if (!allowedResource(target, request.resourceType())) return await route.abort();
        }
        await route.fulfill(response);
      } catch (error) {
        await route.abort().catch(() => {});
        this.log(JSON.stringify({ event: 'request-error', message: error.message }));
      } finally { this.pending--; }
    });
    this.tail = job.catch(() => {});
    return job;
  }
  stop() { this.controller.abort(); }
}
